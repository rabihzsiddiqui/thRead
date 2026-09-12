import type { Fragment } from "./fragments";

export type WovenParagraph = {
  /** the seam tick in the left margin: the time the paragraph starts from */
  tick: string;
  text: string;
};

/**
 * INTEGRATION POINT — composition.
 *
 * The prototype shipped a hard-coded WOVEN array of finished prose. Real
 * weaving is a composition step: it turns short spoken scraps into continuous
 * writing, which means either a language model or the user editing by hand.
 * Neither exists yet, so this does the one honest thing available offline:
 * it groups the day's fragments by when they happened and stitches them,
 * unchanged, into paragraphs.
 *
 * That is a weave in structure but not in voice. The result reads as a list
 * with the seams filed down, not as the prose in the design screenshots.
 * Swapping in real composition means replacing the body of `weave` and
 * nothing else on the calling side, which is why it is async already.
 */

/** Fragments further apart than this start a new paragraph. */
const GAP_MINUTES = 150;

export async function weave(fragments: Fragment[]): Promise<WovenParagraph[]> {
  return groupByTimeOfDay(fragments);
}

export function groupByTimeOfDay(fragments: Fragment[]): WovenParagraph[] {
  if (fragments.length === 0) return [];

  const groups: Fragment[][] = [];
  let current: Fragment[] = [];

  for (const fragment of fragments) {
    if (current.length === 0) {
      current.push(fragment);
      continue;
    }
    const previous = current[current.length - 1];
    if (minutesBetween(previous.time, fragment.time) > GAP_MINUTES) {
      groups.push(current);
      current = [fragment];
    } else {
      current.push(fragment);
    }
  }
  if (current.length > 0) groups.push(current);

  return groups.map((group) => ({
    tick: group[0].time,
    text: group.map((f) => sentence(f.text)).join(" "),
  }));
}

function minutesBetween(a: string, b: string): number {
  return Math.abs(toMinutes(b) - toMinutes(a));
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Fragments are logged in a lowercase register. Prose is not, and a fragment
 * often holds more than one sentence, so every sentence in it gets lifted,
 * not just the first.
 */
function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const spoken = trimmed.replace(/\bi\b/g, "I");
  const lifted = spoken.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
  );

  return /[.!?]$/.test(lifted) ? lifted : `${lifted}.`;
}
