/**
 * INTEGRATION POINT — speech to text.
 *
 * The prototype filled each fragment from a canned rotation. This wires the
 * browser's own SpeechRecognition where it exists and falls back to that
 * rotation where it does not.
 *
 * Read before shipping:
 *
 * 1. SpeechRecognition is NOT local on most browsers. Chrome streams audio to
 *    Google for recognition. That contradicts the "stays on this phone" copy
 *    the design repeats on two screens. Either move to on-device recognition
 *    (iOS 26 Safari exposes an on-device mode, Chrome does not), transcribe
 *    locally with a bundled model, or change the copy. Do not ship both the
 *    promise and the network call.
 * 2. Support is uneven, and worst exactly where a phone-first app lives.
 *    Safari on iOS has shipped it since 14.5 but drops sessions; Firefox has
 *    no support at all.
 * 3. A device with no support currently gets the stand-in text. That is fine
 *    for a demo and wrong for a release. The design has no text input on any
 *    screen, so the real answer needs a design decision: a typed fallback, or
 *    record audio now and transcribe later.
 */

export type TranscriptionSource = "speech" | "stand-in";

export type Transcription = {
  text: string;
  source: TranscriptionSource;
};

export type Recorder = {
  /** Resolves with whatever was heard between start and stop. */
  stop: () => Promise<Transcription>;
  /** Abandons the session without producing a fragment. */
  cancel: () => void;
};

const STAND_IN = [
  "said i'd call my mother back and then didn't.",
  "the bakery on the corner has changed its sign again.",
  "keep thinking about what she said about staying.",
  "bus was early for once and i missed it.",
];

let standInCursor = 0;

function nextStandIn(): string {
  const text = STAND_IN[standInCursor % STAND_IN.length];
  standInCursor += 1;
  return text;
}

/* --- minimal typings: SpeechRecognition is not in lib.dom --- */

type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSupported(): boolean {
  return getCtor() !== null;
}

/**
 * Starts listening. Always resolves to a usable recorder, so the mic button
 * never has to care whether recognition is real on this device.
 */
export function record(): Recorder {
  const Ctor = getCtor();

  if (!Ctor) {
    return {
      stop: async () => ({ text: nextStandIn(), source: "stand-in" as const }),
      cancel: () => {},
    };
  }

  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang =
    typeof navigator !== "undefined" ? navigator.language : "en-US";

  let transcript = "";
  let ended = false;
  let failed = false;
  const waiters: Array<() => void> = [];

  const settle = () => {
    ended = true;
    while (waiters.length) waiters.shift()?.();
  };

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) transcript += result[0].transcript;
    }
  };
  recognition.onerror = () => {
    failed = true;
    settle();
  };
  recognition.onend = settle;

  try {
    recognition.start();
  } catch {
    failed = true;
    ended = true;
  }

  return {
    stop: async () => {
      if (!ended) {
        recognition.stop();
        // onend fires asynchronously, and the last final result can land with it
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 1200);
          waiters.push(() => {
            clearTimeout(timer);
            resolve();
          });
        });
      }

      const text = transcript.trim();
      if (failed || !text) {
        return { text: nextStandIn(), source: "stand-in" as const };
      }
      return { text: tidy(text), source: "speech" as const };
    },
    cancel: () => {
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
 * sentence case, so this lowers the first character only, leaving names alone.
 */
function tidy(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}
