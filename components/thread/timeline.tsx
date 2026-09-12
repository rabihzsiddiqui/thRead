"use client";

import styles from "./thread.module.css";
import type { Fragment } from "@/lib/fragments";

type TimelineProps = {
  fragments: Fragment[];
  dateLabel: string;
  onClose: () => void;
  onExport: () => void;
  onWeave: () => void;
};

export function countLine(n: number): string {
  return `${n} ${n === 1 ? "fragment" : "fragments"} · stays on this phone`;
}

export function weaveLabel(n: number): string {
  return `weave ${n} ${n === 1 ? "fragment" : "fragments"} into today`;
}

/** A plain log of the day, and the only way through to the weave. */
export default function Timeline({
  fragments,
  dateLabel,
  onClose,
  onExport,
  onWeave,
}: TimelineProps) {
  const isEmpty = fragments.length === 0;

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineScroll}>
        <div className={styles.headRow}>
          <div className={styles.date}>{dateLabel}</div>
          <button type="button" className={styles.close} onClick={onClose}>
            close
          </button>
        </div>

        <div className={styles.meta}>{countLine(fragments.length)}</div>

        {fragments.map((fragment, i) => (
          <div className={styles.row} key={`${fragment.time}-${i}`}>
            <div className={styles.rowTime}>{fragment.time}</div>
            <div className={styles.rowText}>{fragment.text}</div>
          </div>
        ))}

        {isEmpty && <div className={styles.empty}>Say the first thing.</div>}

        <button type="button" className={styles.export} onClick={onExport}>
          export · .txt · stays on this phone
        </button>
      </div>

      {/*
        The prototype always showed this bar because it seeded six fragments.
        A real first run has none, and "weave 0 fragments into today" is not
        a thing to offer.
      */}
      {!isEmpty && (
        <div className={styles.weaveBar}>
          <button
            type="button"
            className={styles.weaveButton}
            onClick={onWeave}
          >
            <span>{weaveLabel(fragments.length)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
