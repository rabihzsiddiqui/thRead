"use client";

import styles from "./thread.module.css";
import { countLine } from "./timeline";
import type { Fragment } from "@/lib/fragments";
import type { WovenParagraph } from "@/lib/weave";

type TheDayProps = {
  fragments: Fragment[];
  paragraphs: WovenParagraph[];
  dateLabel: string;
  title: string;
  subtitle: string;
  /** 0 before the weave starts, 1 once it is running */
  progress: 0 | 1;
  /** total weave duration in seconds, 0 when motion is reduced */
  duration: number;
  reduced: boolean;
  showSeams: boolean;
  lampInk: string;
  onBack: () => void;
  onExport: () => void;
};

/**
 * The weave, take "Gather".
 *
 * Every timing below is a fraction of the total duration so the whole
 * transition retimes from one number. The fractions are the prototype's and
 * are deliberate: the ground is most of the way dark before the first
 * paragraph arrives, and the chrome lands last.
 */
export default function TheDay({
  fragments,
  paragraphs,
  dateLabel,
  title,
  subtitle,
  progress,
  duration: d,
  reduced,
  showSeams,
  lampInk,
  onBack,
  onExport,
}: TheDayProps) {
  const on = progress === 1;

  // reduced motion is a cut, not a faster fade
  const tr = (spec: string) => (reduced ? "none" : spec);

  // rows converge on the middle of the list as they leave
  const centre = (fragments.length - 1) / 2;

  return (
    <div className={styles.day}>
      <div
        className={styles.night}
        style={{
          opacity: on ? 1 : 0,
          transition: tr(`opacity ${d * 0.75}s ease`),
        }}
      />

      <div className={styles.dayCenter}>
        <div className={styles.dayColumn}>
          <div
            className={styles.threadRule}
            style={{
              opacity: on ? 0.5 : 0.9,
              transform: `scaleY(${on ? 1 : 0})`,
              transition: tr(
                `transform ${d * 0.85}s cubic-bezier(.45,0,.2,1), opacity ${d}s ease`,
              ),
            }}
          />

          {/* the log, still where it was, being gathered out of view */}
          <div
            className={styles.raw}
            aria-hidden="true"
            style={{
              opacity: on ? 0 : 1,
              filter: on ? "blur(4px)" : "blur(0px)",
              transition: tr(
                `opacity ${d * 0.5}s ease, filter ${d * 0.6}s ease`,
              ),
            }}
          >
            <div className={styles.headRow}>
              <div className={styles.date}>{dateLabel}</div>
              <div className={styles.close}>close</div>
            </div>
            <div className={styles.meta}>{countLine(fragments.length)}</div>
            {fragments.map((fragment, i) => (
              <div
                className={styles.row}
                key={`${fragment.time}-${i}`}
                style={{
                  transform: on
                    ? `translateY(${(centre - i) * 9}px)`
                    : "translateY(0)",
                  opacity: on ? 0 : 1,
                  transition: tr(
                    `transform ${d * 0.8}s cubic-bezier(.3,.7,.2,1) ${i * 0.045}s, opacity ${d * 0.45}s ease ${i * 0.045}s`,
                  ),
                }}
              >
                <div className={styles.rowTime}>{fragment.time}</div>
                <div className={styles.rowText}>{fragment.text}</div>
              </div>
            ))}
          </div>

          <div className={styles.dayInner}>
            <div
              className={styles.chromeHead}
              style={{
                opacity: on ? 1 : 0,
                transition: tr(`opacity ${d * 0.5}s ease ${d * 0.65}s`),
              }}
            >
              <div className={styles.dayDate}>{dateLabel}</div>
              <button type="button" className={styles.dayLink} onClick={onBack}>
                fragments
              </button>
            </div>

            <div className={styles.dayScroll}>
              <div
                className={styles.titleBlock}
                style={{
                  opacity: on ? 1 : 0,
                  transform: on ? "translateY(0)" : "translateY(10px)",
                  transition: tr(
                    `opacity ${d * 0.5}s ease ${d * 0.3}s, transform ${d * 0.6}s ease ${d * 0.3}s`,
                  ),
                }}
              >
                <div className={styles.dayTitle}>{title}</div>
                <div className={styles.daySub}>{subtitle}</div>
              </div>

              {paragraphs.map((paragraph, j) => (
                <div
                  className={styles.para}
                  key={`${paragraph.tick}-${j}`}
                  style={{
                    opacity: on ? 1 : 0,
                    transform: on ? "translateY(0)" : "translateY(14px)",
                    transition: tr(
                      `opacity ${d * 0.55}s ease ${d * (0.4 + j * 0.09)}s, transform ${d * 0.7}s cubic-bezier(.2,.7,.2,1) ${d * (0.4 + j * 0.09)}s`,
                    ),
                  }}
                >
                  <div
                    className={styles.seam}
                    style={{ opacity: showSeams ? 0.85 : 0 }}
                  >
                    {showSeams ? paragraph.tick : ""}
                  </div>
                  <div className={styles.paraText} style={{ color: lampInk }}>
                    {paragraph.text}
                  </div>
                </div>
              ))}

              <div
                className={styles.chromeFoot}
                style={{
                  opacity: on ? 1 : 0,
                  transition: tr(`opacity ${d * 0.5}s ease ${d * 0.65}s`),
                }}
              >
                <button
                  type="button"
                  className={styles.dayLink}
                  onClick={onExport}
                >
                  keep this day · export .txt
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
