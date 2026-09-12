import { dayKey } from "./date";

export type Fragment = {
  /** local clock at the moment it was saved, "07:12" */
  time: string;
  text: string;
};

const PREFIX = "thread:v1:";

/**
 * Fragments live in localStorage, one entry per calendar day, and never leave
 * the device. The copy on screen says so, so this has to stay true: no network
 * call belongs in this module.
 *
 * It is shaped as an external store rather than component state because
 * localStorage IS the source of truth. React subscribes to it through
 * useSyncExternalStore, which keeps the server render empty and the client
 * render correct without an effect that writes state on mount.
 *
 * Every access is guarded. Safari in private mode throws on both read and
 * write, and a thrown quota error should cost you the fragment you just said,
 * not the whole screen.
 */

const listeners = new Set<() => void>();

/** Stable empty array: a fresh [] each read would spin useSyncExternalStore. */
const EMPTY: Fragment[] = [];

let cache: { day: string; value: Fragment[] } | null = null;

function keyFor(day: string) {
  return PREFIX + day;
}

function read(day: string): Fragment[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(keyFor(day));
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const fragments = parsed.filter(isFragment);
    return fragments.length > 0 ? fragments : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(fragments: Fragment[], day: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(keyFor(day), JSON.stringify(fragments));
    return true;
  } catch {
    return false;
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Cached so repeated reads return the same reference until something writes. */
export function snapshot(day: string): Fragment[] {
  if (cache && cache.day === day) return cache.value;
  const value = read(day);
  cache = { day, value };
  return value;
}

export function serverSnapshot(): Fragment[] {
  return EMPTY;
}

export function append(
  fragment: Fragment,
  day: string = dayKey(),
): Fragment[] {
  const next = [...snapshot(day), fragment];
  cache = { day, value: next };
  write(next, day);
  for (const listener of listeners) listener();
  return next;
}

/** Every day that has fragments, newest first. */
export function days(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
    return out.sort().reverse();
  } catch {
    return [];
  }
}

function isFragment(v: unknown): v is Fragment {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return typeof f.time === "string" && typeof f.text === "string";
}
