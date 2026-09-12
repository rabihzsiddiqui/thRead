"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Capture from "@/components/thread/capture";
import Timeline from "@/components/thread/timeline";
import TheDay from "@/components/thread/the-day";
import Toast from "@/components/thread/toast";
import styles from "@/components/thread/thread.module.css";
import {
  clock,
  dateShort,
  dayKey,
  dayLong,
  daySub,
  dayTitle,
} from "@/lib/date";
import {
  append,
  insertAt,
  move,
  removeAt,
  serverSnapshot,
  snapshot,
  subscribe,
  type Fragment,
} from "@/lib/fragments";
import {
  installLocal,
  record,
  support,
  type Failure,
  type Recorder,
  type Support,
} from "@/lib/transcribe";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { weave, type WovenParagraph } from "@/lib/weave";

type Screen = "capture" | "timeline" | "woven";

/* these were tweak chips on the prototype artboard. constants here. */
const WEAVE_SECONDS = 1.9;
const SHOW_SEAMS = true;
const LAMP_INK = "#e3b77c";

const GROUND = { day: "#e8e9e4", night: "#0d1e22" };

const DISCLOSED_KEY = "thread:v1:disclosed";

/* said plainly, in the app's register, when a recording produces nothing */
const EXCUSE: Record<Failure, string> = {
  "no-speech": "didn't catch anything",
  denied: "the microphone is blocked",
  "no-mic": "no microphone here",
  unsupported: "this browser can't listen yet",
  network: "couldn't transcribe that",
  failed: "couldn't transcribe that",
};

export default function Page() {
  const [screen, setScreen] = useState<Screen>("capture");
  const [day, setDay] = useState<string>(() => dayKey());
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [toast, setToast] = useState({
    text: "",
    visible: false,
    undoable: false,
  });
  const [progress, setProgress] = useState<0 | 1>(0);
  const [paragraphs, setParagraphs] = useState<WovenParagraph[]>([]);
  const [speech, setSpeech] = useState<Support | null>(null);

  /* localStorage is the source of truth, so read from it rather than mirror it */
  const fragments = useSyncExternalStore(
    subscribe,
    useCallback(() => snapshot(day), [day]),
    serverSnapshot,
  );

  const reduced = useReducedMotion();
  const recorder = useRef<Recorder | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ask what this browser can do before the first tap, so tapping is instant */
  useEffect(() => {
    let cancelled = false;
    support().then((s) => {
      if (!cancelled) setSpeech(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Left open overnight, the app would otherwise keep filing today's words
   * under yesterday. Re-check whenever it comes back to the foreground.
   */
  useEffect(() => {
    const check = () => {
      const today = dayKey();
      setDay((current) => (current === today ? current : today));
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  /* the ground reaches the status bar once you have woven */
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute(
      "content",
      screen === "woven" ? GROUND.night : GROUND.day,
    );
  }, [screen]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (ticker.current) clearInterval(ticker.current);
      recorder.current?.cancel();
    };
  }, []);

  const flash = useCallback((text: string, ms: number, undoable = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, visible: true, undoable });
    toastTimer.current = setTimeout(
      () => setToast((t) => ({ ...t, visible: false })),
      ms,
    );
  }, []);

  /*
   * A deleted fragment is held until the toast goes, so a mistaken tap in
   * edit mode costs nothing. This is a diary: losing an entry for good on a
   * single tap is not a reasonable price for tidying.
   */
  const undone = useRef<{
    fragment: Fragment;
    index: number;
    day: string;
  } | null>(null);

  const onRemove = useCallback(
    (index: number) => {
      const fragment = fragments[index];
      if (!fragment) return;
      undone.current = { fragment, index, day };
      removeAt(index, day);
      flash("fragment removed", 5000, true);
    },
    [fragments, day, flash],
  );

  const onUndoRemove = useCallback(() => {
    const held = undone.current;
    if (!held) return;
    insertAt(held.fragment, held.index, held.day);
    undone.current = null;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast((t) => ({ ...t, visible: false }));
  }, []);

  const onMoveFragment = useCallback(
    (from: number, to: number) => {
      move(from, to, day);
    },
    [day],
  );

  const startRecording = useCallback(async () => {
    if (speech && !speech.supported) {
      flash(EXCUSE.unsupported, 2400);
      return;
    }

    let local = speech?.supported === true && speech.local === "available";

    /* the on-device pack is a one-time fetch, asked for by the first tap */
    if (speech?.supported && speech.local === "downloadable") {
      flash("getting ready to listen", 4000);
      local = await installLocal();
      setSpeech({ supported: true, local: local ? "available" : "unavailable" });
    }

    /*
     * Where the browser will not promise on-device recognition, say so once.
     * The fragments still never leave, but the audio might, and the app should
     * not quietly imply otherwise.
     */
    if (!local) {
      try {
        if (!window.localStorage.getItem(DISCLOSED_KEY)) {
          window.localStorage.setItem(DISCLOSED_KEY, "1");
          flash("words are transcribed by your browser", 3200);
        }
      } catch {
        /* private mode: skip the note rather than fail the recording */
      }
    }

    recorder.current = record(local);
    setRecording(true);
    setSeconds(0);
    ticker.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, [speech, flash]);

  const stopRecording = useCallback(async () => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    setRecording(false);
    setSeconds(0);

    const active = recorder.current;
    recorder.current = null;
    if (!active) return;

    const outcome = await active.stop();

    /* never invent a fragment: say what went wrong and save nothing */
    if (!outcome.ok) {
      flash(EXCUSE[outcome.reason], 2400);
      return;
    }

    const time = clock();
    const today = dayKey();
    append({ time, text: outcome.text }, today);
    if (today !== day) setDay(today);

    flash(`saved, ${time}`, 1800);
  }, [day, flash]);

  const onMic = useCallback(() => {
    if (recording) void stopRecording();
    else void startRecording();
  }, [recording, startRecording, stopRecording]);

  const onWeave = useCallback(async () => {
    const composed = await weave(fragments);
    setParagraphs(composed);
    setProgress(0);
    setScreen("woven");

    if (reduced) {
      setProgress(1);
      return;
    }
    // two frames, so the starting state is painted before it is changed
    requestAnimationFrame(() => requestAnimationFrame(() => setProgress(1)));
  }, [fragments, reduced]);

  const onExport = useCallback(async () => {
    const when = new Date();
    const composed = paragraphs.length ? paragraphs : await weave(fragments);

    const lines = [`thRead · ${dayTitle(when)} ${dayLong(when)}`, ""];
    if (composed.length > 0) {
      lines.push("THE DAY", "");
      for (const p of composed) lines.push(`${p.tick}  ${p.text}`, "");
    }
    lines.push("FRAGMENTS", "");
    for (const f of fragments) lines.push(`${f.time}  ${f.text}`);

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `thread-${dayKey(when)}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    flash("saved to your downloads", 2200);
  }, [fragments, paragraphs, flash]);

  const now = new Date();

  return (
    <main className={styles.app}>
      {screen === "capture" && (
        <Capture
          recording={recording}
          seconds={seconds}
          count={fragments.length}
          onMic={onMic}
          onOpenTimeline={() => setScreen("timeline")}
        />
      )}

      {screen === "timeline" && (
        <Timeline
          fragments={fragments}
          dateLabel={dateShort(now)}
          onClose={() => setScreen("capture")}
          onExport={onExport}
          onWeave={onWeave}
          onRemove={onRemove}
          onMove={onMoveFragment}
        />
      )}

      {screen === "woven" && (
        <TheDay
          fragments={fragments}
          paragraphs={paragraphs}
          dateLabel={dateShort(now)}
          title={dayTitle(now)}
          subtitle={daySub(now)}
          progress={progress}
          duration={reduced ? 0 : WEAVE_SECONDS}
          reduced={reduced}
          showSeams={SHOW_SEAMS}
          lampInk={LAMP_INK}
          onBack={() => {
            setProgress(0);
            setScreen("timeline");
          }}
          onExport={onExport}
        />
      )}

      <Toast
        text={toast.text}
        visible={toast.visible}
        action={
          toast.undoable
            ? { label: "undo", onAction: onUndoRemove }
            : undefined
        }
      />
    </main>
  );
}
