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

/** Every mutation goes through here, so the cache and listeners stay honest. */
export function replace(next: Fragment[], day: string = dayKey()): Fragment[] {
  const value = next.length > 0 ? next : EMPTY;
  cache = { day, value };
  write(value, day);
  for (const listener of listeners) listener();
  return value;
}

export function append(
  fragment: Fragment,
  day: string = dayKey(),
): Fragment[] {
  return replace([...snapshot(day), fragment], day);
}

/** Puts a fragment back where it was. Undo for a delete. */
export function insertAt(
  fragment: Fragment,
  index: number,
  day: string = dayKey(),
): Fragment[] {
  const current = snapshot(day);
  const at = Math.max(0, Math.min(index, current.length));
  return replace([...current.slice(0, at), fragment, ...current.slice(at)], day);
}

export function removeAt(index: number, day: string = dayKey()): Fragment[] {
  const current = snapshot(day);
  if (index < 0 || index >= current.length) return current;
  return replace([...current.slice(0, index), ...current.slice(index + 1)], day);
}

/**
 * Moves a fragment and gives it a time that matches where it landed, halfway
 * between its new neighbours. The list is a record of when things happened,
 * so position and timestamp have to agree.
 */
export function move(
  from: number,
  to: number,
  day: string = dayKey(),
): Fragment[] {
  const current = snapshot(day);
  if (from === to || from < 0 || from >= current.length) return current;
  if (to < 0 || to >= current.length) return current;

  const moved = current[from];
  const rest = [...current.slice(0, from), ...current.slice(from + 1)];
  const placed = [...rest.slice(0, to), moved, ...rest.slice(to)];

  const before = placed[to - 1];
  const after = placed[to + 1];
  const retimed: Fragment = {
    ...moved,
    time: between(before?.time, after?.time, moved.time),
  };

  return replace(
    [...placed.slice(0, to), retimed, ...placed.slice(to + 1)],
    day,
  );
}

const DAY_START = 0;
const DAY_END = 23 * 60 + 59;

function between(
  before: string | undefined,
  after: string | undefined,
  fallback: string,
): string {
  const lo = before ? toMinutes(before) : null;
  const hi = after ? toMinutes(after) : null;

  if (lo !== null && hi !== null) return toClock(Math.round((lo + hi) / 2));
  // at an edge, sit a few minutes outside the neighbour rather than jump
  if (lo !== null) return toClock(Math.min(DAY_END, lo + 5));
  if (hi !== null) return toClock(Math.max(DAY_START, hi - 5));
  return fallback;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function toClock(total: number): string {
  const clamped = Math.max(DAY_START, Math.min(DAY_END, total));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
