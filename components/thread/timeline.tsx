"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./thread.module.css";
import type { Fragment } from "@/lib/fragments";

type TimelineProps = {
  fragments: Fragment[];
  dateLabel: string;
  onClose: () => void;
  onExport: () => void;
  onWeave: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
};

export function countLine(n: number): string {
  return `${n} ${n === 1 ? "fragment" : "fragments"} · stays on this phone`;
}

export function weaveLabel(n: number): string {
  return `weave ${n} ${n === 1 ? "fragment" : "fragments"} into today`;
}

type Drag = { from: number; to: number; dy: number; height: number };

/** A plain log of the day, and the only way through to the weave. */
export default function Timeline({
  fragments,
  dateLabel,
  onClose,
  onExport,
  onWeave,
  onRemove,
  onMove,
}: TimelineProps) {
  const [editRequested, setEditRequested] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);

  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const metrics = useRef<{ tops: number[]; heights: number[] }>({
    tops: [],
    heights: [],
  });
  const startY = useRef(0);

  const isEmpty = fragments.length === 0;
  /* derived, so deleting the last fragment leaves edit mode on its own */
  const editing = editRequested && !isEmpty;

  const beginDrag = useCallback(
    (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      const measured = rows.current
        .slice(0, fragments.length)
        .map((el) => el?.getBoundingClientRect());
      metrics.current = {
        tops: measured.map((r) => r?.top ?? 0),
        heights: measured.map((r) => r?.height ?? 0),
      };
      startY.current = event.clientY;
      setDrag({
        from: index,
        to: index,
        dy: 0,
        height: metrics.current.heights[index] ?? 0,
      });
    },
    [fragments.length],
  );

  const duringDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      setDrag((current) => {
        if (!current) return current;
        const { tops, heights } = metrics.current;
        const dy = event.clientY - startY.current;
        const centre = tops[current.from] + heights[current.from] / 2 + dy;

        let to = current.from;
        for (let i = 0; i < tops.length; i++) {
          if (i === current.from) continue;
          const middle = tops[i] + heights[i] / 2;
          if (i < current.from && centre < middle) to = Math.min(to, i);
          if (i > current.from && centre > middle) to = Math.max(to, i);
        }
        return { from: current.from, to, dy, height: current.height };
      });
    },
    [],
  );

  const endDrag = useCallback(() => {
    setDrag((current) => {
      if (current && current.to !== current.from) {
        onMove(current.from, current.to);
      }
      return null;
    });
  }, [onMove]);

  /* rows slide out of the way to show where the dragged one will land */
  const shiftFor = (index: number): number => {
    if (!drag) return 0;
    if (index === drag.from) return drag.dy;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) {
      return -drag.height;
    }
    if (drag.from > drag.to && index < drag.from && index >= drag.to) {
      return drag.height;
    }
    return 0;
  };

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineScroll}>
        <div className={styles.headRow}>
          <div className={styles.date}>{dateLabel}</div>
          <div className={styles.headActions}>
            {!isEmpty && (
              <>
                <button
                  type="button"
                  className={styles.close}
                  onClick={() => setEditRequested((e) => !e)}
                >
                  {editing ? "done" : "edit"}
                </button>
                <span className={styles.headDot} />
              </>
            )}
            <button type="button" className={styles.close} onClick={onClose}>
              close
            </button>
          </div>
        </div>

        <div className={styles.meta}>{countLine(fragments.length)}</div>

        {fragments.map((fragment, i) => (
          <div
            key={`${fragment.time}-${i}`}
            ref={(el) => {
              rows.current[i] = el;
            }}
            className={`${styles.row} ${editing ? styles.rowEditing : ""} ${
              drag?.from === i ? styles.rowDragging : ""
            }`}
            style={{
              transform: `translateY(${shiftFor(i)}px)`,
              transition: drag?.from === i ? "none" : "transform .18s ease",
            }}
          >
            {editing && (
              <button
                type="button"
                className={styles.remove}
                onClick={() => onRemove(i)}
                aria-label={`delete the fragment from ${fragment.time}`}
              >
                <span className={styles.removeGlyph} />
              </button>
            )}

            <div className={styles.rowTime}>{fragment.time}</div>
            <div className={styles.rowText}>{fragment.text}</div>

            {editing && (
              <button
                type="button"
                className={styles.grip}
                onPointerDown={(e) => beginDrag(i, e)}
                onPointerMove={drag ? duringDrag : undefined}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" && i > 0) {
                    e.preventDefault();
                    onMove(i, i - 1);
                  }
                  if (e.key === "ArrowDown" && i < fragments.length - 1) {
                    e.preventDefault();
                    onMove(i, i + 1);
                  }
                }}
                aria-label={`move the fragment from ${fragment.time}`}
              >
                <span className={styles.gripGlyph} />
              </button>
            )}
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
