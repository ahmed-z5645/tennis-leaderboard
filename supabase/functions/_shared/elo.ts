// Shared ELO logic — the single source of truth for match scoring.
// Pure TypeScript (no Deno/Node APIs) so it is imported by both the
// log-match / delete-match Edge Functions and the Vitest unit tests.

export const BASE_K = 32;
export const DEFAULT_ELO = 1000;

export type SetScore = { p1: number; p2: number };

/** A set is valid if both scores are integers in [0, 7] and not tied. */
export function isValidSet(set: SetScore): boolean {
  const { p1, p2 } = set;
  if (!Number.isInteger(p1) || !Number.isInteger(p2)) return false;
  if (p1 < 0 || p1 > 7 || p2 < 0 || p2 > 7) return false;
  return p1 !== p2;
}

/** Validates the full set list: 1–5 sets, each individually valid. */
export function validateSets(sets: SetScore[]): boolean {
  if (!Array.isArray(sets) || sets.length < 1 || sets.length > 5) return false;
  return sets.every(isValidSet);
}

/**
 * Determines the winning side from set scores.
 * Returns 'p1' | 'p2', or null if sets are tied / invalid (no conclusive winner).
 */
export function deriveWinner(sets: SetScore[]): 'p1' | 'p2' | null {
  if (!validateSets(sets)) return null;
  let p1Sets = 0;
  let p2Sets = 0;
  for (const s of sets) {
    if (s.p1 > s.p2) p1Sets++;
    else p2Sets++;
  }
  if (p1Sets === p2Sets) return null;
  return p1Sets > p2Sets ? 'p1' : 'p2';
}

/**
 * Margin-of-victory multiplier based on total games won.
 * Ranges from 0.5 (a nail-biter) to 1.5 (a blowout); clamped defensively.
 */
export function getMarginMultiplier(winnerGames: number, loserGames: number): number {
  const totalGames = winnerGames + loserGames;
  if (totalGames <= 0) return 1;
  const margin = winnerGames - loserGames;
  const mult = 0.5 + margin / totalGames;
  return Math.min(1.5, Math.max(0.5, mult));
}

/** Total games won by each side across all sets. */
export function totalGames(sets: SetScore[]): { p1: number; p2: number } {
  return sets.reduce(
    (acc, s) => ({ p1: acc.p1 + s.p1, p2: acc.p2 + s.p2 }),
    { p1: 0, p2: 0 },
  );
}

/** Standard ELO expected-score + margin-weighted K. Deltas are integers. */
export function calculateElo(
  winnerElo: number,
  loserElo: number,
  marginMultiplier: number,
): { winnerDelta: number; loserDelta: number } {
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const k = BASE_K * marginMultiplier;
  const winnerDelta = Math.round(k * (1 - expected));
  const loserDelta = -Math.round(k * expected);
  return { winnerDelta, loserDelta };
}

/**
 * Convenience: compute deltas straight from set scores given the winner side.
 * Used by both Edge Functions so the math lives in exactly one place.
 */
export function eloFromSets(
  sets: SetScore[],
  winnerSide: 'p1' | 'p2',
  p1Elo: number,
  p2Elo: number,
): {
  winnerDelta: number;
  loserDelta: number;
  p1Delta: number;
  p2Delta: number;
} {
  const games = totalGames(sets);
  const winnerGames = winnerSide === 'p1' ? games.p1 : games.p2;
  const loserGames = winnerSide === 'p1' ? games.p2 : games.p1;
  const winnerElo = winnerSide === 'p1' ? p1Elo : p2Elo;
  const loserElo = winnerSide === 'p1' ? p2Elo : p1Elo;

  const mult = getMarginMultiplier(winnerGames, loserGames);
  const { winnerDelta, loserDelta } = calculateElo(winnerElo, loserElo, mult);

  return {
    winnerDelta,
    loserDelta,
    p1Delta: winnerSide === 'p1' ? winnerDelta : loserDelta,
    p2Delta: winnerSide === 'p2' ? winnerDelta : loserDelta,
  };
}
