/**
 * Speech to text, local first.
 *
 * Chrome 139+ exposes on-device recognition through `processLocally`, with
 * `available()` and `install()` to check for and fetch the language pack.
 * When that path is taken, neither the audio nor the transcript leaves the
 * device, guaranteed by the API rather than by a privacy policy.
 *
 * Where it is not offered (Safari, older Chrome) the browser decides how to
 * recognise. Apple processes on device "whenever possible" but falls back to
 * its servers for unsupported languages, older hardware, or when Improve Siri
 * is on, and Safari does not tell us which happened. So we report that
 * locality honestly as "provider" and let the UI say so once, rather than
 * claiming something we cannot verify.
 *
 * Nothing in here ever invents text. A failed or silent recording returns a
 * reason, never a plausible sentence. This is a journal: a fabricated entry
 * is worse than no entry.
 */

export type Locality = "on-device" | "provider";

export type Availability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

export type Support =
  | { supported: false }
  | { supported: true; local: Availability };

export type Failure =
  | "no-speech"
  | "denied"
  | "no-mic"
  | "unsupported"
  | "network"
  | "failed";

export type Outcome =
  | { ok: true; text: string; locality: Locality }
  | { ok: false; reason: Failure };

export type Recorder = {
  /** Resolves with what was heard between start and stop. */
  stop: () => Promise<Outcome>;
  /** Abandons the session without producing a fragment. */
  cancel: () => void;
};

/* --- minimal typings: SpeechRecognition is not in lib.dom --- */

type Alternative = { transcript: string };
type Result = { isFinal: boolean; 0: Alternative };
type ResultEvent = {
  resultIndex: number;
  results: { length: number; [i: number]: Result };
};
type ErrorEvent = { error: string };

type Options = { langs: string[]; processLocally?: boolean };

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  processLocally?: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: ResultEvent) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = {
  new (): Recognition;
  available?: (o: Options) => Promise<Availability>;
  install?: (o: Options) => Promise<boolean>;
};

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function language(): string {
  return typeof navigator !== "undefined" ? navigator.language : "en-US";
}

/** What this browser can do, and whether a local pack needs fetching. */
export async function support(): Promise<Support> {
  const C = ctor();
  if (!C) return { supported: false };
  if (typeof C.available !== "function") {
    // no on-device API: the browser picks the method
    return { supported: true, local: "unavailable" };
  }
  try {
    const local = await C.available({
      langs: [language()],
      processLocally: true,
    });
    return { supported: true, local };
  } catch {
    return { supported: true, local: "unavailable" };
  }
}

/** Fetches the on-device language pack. Resolves false if it could not. */
export async function installLocal(): Promise<boolean> {
  const C = ctor();
  if (!C || typeof C.install !== "function") return false;
  try {
    return await C.install({ langs: [language()], processLocally: true });
  } catch {
    return false;
  }
}

type Handlers = { onPartial?: (text: string) => void };

/**
 * Starts listening. `local` should come from a prior `support()` check: when
 * true the recogniser is pinned on-device and will error rather than reach
 * the network.
 */
export function record(local: boolean, handlers: Handlers = {}): Recorder {
  const C = ctor();

  if (!C) {
    return {
      stop: async () => ({ ok: false, reason: "unsupported" as const }),
      cancel: () => {},
    };
  }

  const recognition = new C();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = language();
  if (local) recognition.processLocally = true;

  let final = "";
  let heardAnything = false;
  let listening = true;
  let failure: Failure | null = null;

  /*
   * Restarts are not capped by a count, because a long recording with many
   * pauses legitimately needs a lot of them. What is guarded against is a
   * recogniser that ends immediately and hears nothing, over and over, which
   * is a broken engine rather than a thoughtful pause.
   */
  let startedAt = Date.now();
  let heardSinceStart = false;
  let emptyCycles = 0;
  const MAX_EMPTY_CYCLES = 5;
  const TOO_FAST_MS = 300;

  let settled = false;
  const waiters: Array<() => void> = [];
  const settle = () => {
    if (settled) return;
    settled = true;
    while (waiters.length) waiters.shift()?.();
  };

  recognition.onresult = (event) => {
    let partial = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;
      heardAnything = true;
      heardSinceStart = true;
      if (result.isFinal) final += text;
      else partial += text;
    }
    if (partial && handlers.onPartial) handlers.onPartial(partial);
  };

  recognition.onerror = (event) => {
    switch (event.error) {
      case "not-allowed":
      case "service-not-allowed":
        failure = "denied";
        break;
      case "audio-capture":
        failure = "no-mic";
        break;
      case "network":
        // on a local-pinned recogniser this means it tried to leave the device
        failure = "network";
        break;
      case "no-speech":
        // recoverable: the restart below keeps the session alive
        return;
      case "aborted":
        return;
      default:
        failure = "failed";
    }
    listening = false;
    settle();
  };

  /*
   * The recogniser stops itself after a stretch of silence even with
   * `continuous` set. Someone pausing mid-thought should not lose the rest of
   * the sentence, so restart while the user still has the button held open.
   */
  recognition.onend = () => {
    if (!listening) {
      settle();
      return;
    }

    const cycledFast = Date.now() - startedAt < TOO_FAST_MS;
    emptyCycles = !heardSinceStart && cycledFast ? emptyCycles + 1 : 0;
    if (emptyCycles >= MAX_EMPTY_CYCLES) {
      settle();
      return;
    }

    heardSinceStart = false;
    startedAt = Date.now();
    try {
      recognition.start();
    } catch {
      settle();
    }
  };

  try {
    recognition.start();
  } catch {
    failure = "failed";
    listening = false;
    settled = true;
  }

  return {
    stop: async () => {
      listening = false;
      if (!settled) {
        recognition.stop();
        // the last final result can arrive with the end event
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 2000);
          waiters.push(() => {
            clearTimeout(timer);
            resolve();
          });
        });
      }

      if (failure) return { ok: false, reason: failure };

      const text = tidy(final);
      if (!text) {
        return { ok: false, reason: heardAnything ? "failed" : "no-speech" };
      }
      return {
        ok: true,
        text,
        locality: local ? "on-device" : "provider",
      };
    },

    cancel: () => {
      listening = false;
      try {
        recognition.abort();
      } catch {
        /* already gone */
      }
      settle();
    },
  };
}

/**
 * Fragments are logged in the app's lowercase register. Recognition returns
 * sentence case, so lower the first character only, leaving names alone.
 */
function tidy(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}
