// Display formatting helpers. Pure functions, unit-tested.

import type { SetScore } from '../types';

const MINUS = '−'; // − true minus sign, matches the design
const EN_DASH = '–'; // – for set scores

/** "+18" / "−14" / "0", with a real minus sign for negatives. */
export function signedDelta(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${MINUS}${Math.abs(n)}`;
  return '0';
}

/** "6–3, 4–6, 7–5" from a set list. */
export function scoreString(sets: SetScore[]): string {
  return sets.map((s) => `${s.p1}${EN_DASH}${s.p2}`).join(', ');
}

/** Relative time: "just now", "5m ago", "3h ago", "2d ago", else a short date. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return shortDate(iso);
}

/** "Jun 22" — month + day, no year. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Joined March 2025" style month + year. */
export function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
