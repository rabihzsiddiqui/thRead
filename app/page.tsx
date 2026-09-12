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
import { append, serverSnapshot, snapshot, subscribe } from "@/lib/fragments";
import { record, type Recorder } from "@/lib/transcribe";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { weave, type WovenParagraph } from "@/lib/weave";

type Screen = "capture" | "timeline" | "woven";

/* these were tweak chips on the prototype artboard. constants here. */
const WEAVE_SECONDS = 1.9;
const SHOW_SEAMS = true;
const LAMP_INK = "#e3b77c";

const GROUND = { day: "#e8e9e4", night: "#0d1e22" };

export default function Page() {
  const [screen, setScreen] = useState<Screen>("capture");
  const [day, setDay] = useState<string>(() => dayKey());
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [toast, setToast] = useState({ text: "", visible: false });
  const [progress, setProgress] = useState<0 | 1>(0);
  const [paragraphs, setParagraphs] = useState<WovenParagraph[]>([]);

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

  const flash = useCallback((text: string, ms: number) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, visible: true });
    toastTimer.current = setTimeout(
      () => setToast((t) => ({ ...t, visible: false })),
      ms,
    );
  }, []);

  const onMic = useCallback(async () => {
    if (recording) {
      if (ticker.current) clearInterval(ticker.current);
      ticker.current = null;
      setRecording(false);
      setSeconds(0);

      const active = recorder.current;
      recorder.current = null;
      if (!active) return;

      const { text } = await active.stop();
      if (!text) return;

      const time = clock();
      const today = dayKey();
      append({ time, text }, today);
      if (today !== day) setDay(today);

      flash(`saved, ${time}`, 1800);
      return;
    }

    recorder.current = record();
    setRecording(true);
    setSeconds(0);
    setToast((t) => ({ ...t, visible: false }));
    ticker.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, [recording, day, flash]);

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

      <Toast text={toast.text} visible={toast.visible} />
    </main>
  );
}
