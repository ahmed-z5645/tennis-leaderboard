import { describe, expect, it } from 'vitest';
import {
  BASE_K,
  calculateElo,
  deriveWinner,
  eloFromSets,
  getMarginMultiplier,
  isValidSet,
  validateSets,
} from './elo';

describe('isValidSet / validateSets', () => {
  it('accepts conclusive sets within 0–15', () => {
    expect(isValidSet({ p1: 6, p2: 3 })).toBe(true);
    expect(isValidSet({ p1: 7, p2: 5 })).toBe(true);
    expect(isValidSet({ p1: 15, p2: 13 })).toBe(true);
  });
  it('rejects ties, out-of-range, and non-integers', () => {
    expect(isValidSet({ p1: 6, p2: 6 })).toBe(false);
    expect(isValidSet({ p1: 16, p2: 3 })).toBe(false);
    expect(isValidSet({ p1: -1, p2: 3 })).toBe(false);
    expect(isValidSet({ p1: 6.5, p2: 3 })).toBe(false);
  });
  it('requires 1–5 valid sets', () => {
    expect(validateSets([])).toBe(false);
    expect(validateSets([{ p1: 6, p2: 4 }])).toBe(true);
    expect(validateSets(Array(6).fill({ p1: 6, p2: 0 }))).toBe(false);
    expect(validateSets([{ p1: 6, p2: 4 }, { p1: 3, p2: 3 }])).toBe(false);
  });
});

describe('deriveWinner', () => {
  it('returns the side that won more sets', () => {
    expect(deriveWinner([{ p1: 6, p2: 3 }, { p1: 6, p2: 4 }])).toBe('p1');
    expect(deriveWinner([{ p1: 3, p2: 6 }, { p1: 4, p2: 6 }])).toBe('p2');
    expect(deriveWinner([{ p1: 6, p2: 3 }, { p1: 4, p2: 6 }, { p1: 7, p2: 5 }])).toBe('p1');
  });
  it('returns null when sets are split evenly or invalid', () => {
    expect(deriveWinner([{ p1: 6, p2: 3 }, { p1: 3, p2: 6 }])).toBeNull();
    expect(deriveWinner([{ p1: 6, p2: 6 }])).toBeNull();
  });
});

describe('getMarginMultiplier', () => {
  it('scales between 0.5 and 1.5', () => {
    expect(getMarginMultiplier(12, 0)).toBe(1.5); // blowout
    expect(getMarginMultiplier(12, 8)).toBeCloseTo(0.7); // 6-4,6-4
    expect(getMarginMultiplier(20, 19)).toBeCloseTo(0.5256, 3); // nail-biter
  });
  it('clamps when the winner wins fewer total games', () => {
    expect(getMarginMultiplier(14, 18)).toBe(0.5);
  });
});

describe('calculateElo', () => {
  it('splits symmetrically for equal ratings', () => {
    const { winnerDelta, loserDelta } = calculateElo(1000, 1000, 0.7);
    expect(winnerDelta).toBe(11);
    expect(loserDelta).toBe(-11);
  });
  it('awards the max swing for a blowout between equals', () => {
    const { winnerDelta } = calculateElo(1000, 1000, 1.5);
    expect(winnerDelta).toBe(24); // 32 * 1.5 * 0.5
  });
  it('rewards an upset more than an expected win (same margin)', () => {
    const upset = calculateElo(900, 1100, 1.0).winnerDelta;
    const expected = calculateElo(1100, 900, 1.0).winnerDelta;
    expect(upset).toBeGreaterThan(expected);
  });

  // ── Zero-sum property ───────────────────────────────────────────────
  // The loser's loss must always mirror the winner's gain. Regression guard
  // for a bug where loserDelta used `k * expected` instead of `k * (1 - expected)`,
  // which inverted the result: expected wins drained the favorite's rating and
  // upsets barely dented it.
  it('is zero-sum across a range of elo gaps and margins', () => {
    const gaps = [-400, -200, -100, -25, 0, 25, 100, 200, 400, 800];
    const margins = [0.5, 0.7, 1.0, 1.25, 1.5];
    for (const gap of gaps) {
      for (const mult of margins) {
        const { winnerDelta, loserDelta } = calculateElo(1000 + gap, 1000, mult);
        expect(loserDelta, `gap ${gap}, mult ${mult}`).toBe(-winnerDelta);
      }
    }
  });

  it('moves ratings only a little when the favorite wins as expected', () => {
    const { winnerDelta, loserDelta } = calculateElo(1200, 1000, 1.0);
    expect(winnerDelta).toBe(8); // 32 * (1 - 0.76) ≈ 7.7
    expect(loserDelta).toBe(-8);
    expect(winnerDelta).toBeLessThan(BASE_K / 2);
  });

  it('moves ratings a lot on a big upset', () => {
    const { winnerDelta, loserDelta } = calculateElo(1000, 1200, 1.0);
    expect(winnerDelta).toBe(24); // 32 * (1 - 0.24) ≈ 24.3
    expect(loserDelta).toBe(-24);
    expect(winnerDelta).toBeGreaterThan(BASE_K / 2);
  });

  it('trades the same magnitude both ways for a mirrored matchup', () => {
    // A beating B by X must cost B exactly what B beating A would cost A,
    // when the roles (and so the surprise) are swapped.
    const favoriteWins = calculateElo(1200, 1000, 1.0);
    const underdogWins = calculateElo(1000, 1200, 1.0);
    expect(favoriteWins.winnerDelta + underdogWins.winnerDelta).toBe(BASE_K);
    expect(favoriteWins.loserDelta).toBe(-favoriteWins.winnerDelta);
    expect(underdogWins.loserDelta).toBe(-underdogWins.winnerDelta);
  });

  it('keeps a match zero-sum end to end via eloFromSets', () => {
    const sets = [{ p1: 6, p2: 2 }, { p1: 6, p2: 1 }];
    const r = eloFromSets(sets, 'p2', 1350, 1010);
    expect(r.p1Delta + r.p2Delta).toBe(0);
    expect(r.loserDelta).toBe(-r.winnerDelta);
  });
});

describe('eloFromSets', () => {
  it('maps winner/loser deltas onto p1/p2 correctly', () => {
    const sets = [{ p1: 6, p2: 4 }, { p1: 6, p2: 4 }];
    const r = eloFromSets(sets, 'p1', 1000, 1000);
    expect(r.p1Delta).toBe(r.winnerDelta);
    expect(r.p2Delta).toBe(r.loserDelta);
    expect(r.winnerDelta).toBe(11);
  });
  it('handles p2 as the winner', () => {
    const sets = [{ p1: 4, p2: 6 }, { p1: 4, p2: 6 }];
    const r = eloFromSets(sets, 'p2', 1000, 1000);
    expect(r.p2Delta).toBe(r.winnerDelta);
    expect(r.p1Delta).toBe(r.loserDelta);
  });
});
