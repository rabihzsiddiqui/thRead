"use client";

import styles from "./thread.module.css";

type ToastProps = {
  text: string;
  visible: boolean;
  /** when present the chip becomes tappable, for undoing what it announced */
  action?: { label: string; onAction: () => void };
};

/**
 * Text and visibility are separate so the chip keeps its message through the
 * fade out instead of emptying itself before it has finished leaving.
 */
export default function Toast({ text, visible, action }: ToastProps) {
  const body = (
    <>
      {text}
      {action ? (
        <>
          <span className={styles.toastDot} />
          <span className={styles.toastAction}>{action.label}</span>
        </>
      ) : null}
    </>
  );

  return (
    <div
      className={styles.toastWrap}
      aria-live="polite"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
      }}
    >
      {action && visible ? (
        <button type="button" className={styles.toastButton} onClick={action.onAction}>
          {body}
        </button>
      ) : (
        <div className={styles.toast}>{body}</div>
      )}
    </div>
  );
}
