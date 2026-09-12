"use client";

import styles from "./thread.module.css";
import { elapsed } from "@/lib/date";

type CaptureProps = {
  recording: boolean;
  seconds: number;
  count: number;
  onMic: () => void;
  onOpenTimeline: () => void;
};

/**
 * The one instrument. Tap to record, tap to stop.
 * The glyph is a loose thread at rest and a straight one while listening.
 */
export default function Capture({
  recording,
  seconds,
  count,
  onMic,
  onOpenTimeline,
}: CaptureProps) {
  const strand = recording ? "var(--thread)" : "var(--overcast)";

  return (
    <div className={styles.capture}>
      <div className={styles.captureBody}>
        <div className={styles.micWrap}>
          <div className={styles.micRing}>
            <div
              className={`${styles.pulse} ${recording ? styles.pulseOn : ""}`}
            />
          </div>

          <button
            type="button"
            className={styles.mic}
            onClick={onMic}
            aria-label={recording ? "stop recording" : "record a fragment"}
            aria-pressed={recording}
          >
            <div
              className={styles.glyph}
              style={{
                background: strand,
                transform: recording ? "rotate(0deg)" : "rotate(-11deg)",
              }}
            />
            <div
              className={styles.dot}
              style={{
                background: strand,
                left: recording ? "calc(50% + 28px)" : "calc(50% + 27px)",
                top: recording ? "calc(50% - 1px)" : "calc(50% + 4px)",
              }}
            />
          </button>
        </div>

        <div className={styles.labels} aria-live="polite">
          <div className={styles.label}>
            {recording ? "listening. tap to stop." : "tap. say one thing."}
          </div>
          <div className={`${styles.sub} ${recording ? styles.timer : ""}`}>
            {recording ? elapsed(seconds) : "it saves. you're done."}
          </div>
        </div>
      </div>

      <button
        type="button"
        className={styles.todayRow}
        onClick={onOpenTimeline}
      >
        <span>today</span>
        <span className={styles.todayDot} />
        <span>{count}</span>
      </button>
    </div>
  );
}
