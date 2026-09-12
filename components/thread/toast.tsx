"use client";

import styles from "./thread.module.css";

type ToastProps = {
  text: string;
  visible: boolean;
};

/**
 * Text and visibility are separate so the chip keeps its message through the
 * fade out instead of emptying itself before it has finished leaving.
 */
export default function Toast({ text, visible }: ToastProps) {
  return (
    <div
      className={styles.toastWrap}
      aria-live="polite"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
      }}
    >
      <div className={styles.toast}>{text}</div>
    </div>
  );
}
