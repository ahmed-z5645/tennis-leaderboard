import { describe, expect, it } from 'vitest';
import {
  calculateElo,
  deriveWinner,
  eloFromSets,
  getMarginMultiplier,
  isValidSet,
  validateSets,
} from './elo';

describe('isValidSet / validateSets', () => {
  it('accepts conclusive sets within 0–7', () => {
    expect(isValidSet({ p1: 6, p2: 3 })).toBe(true);
    expect(isValidSet({ p1: 7, p2: 5 })).toBe(true);
  });
  it('rejects ties, out-of-range, and non-integers', () => {
    expect(isValidSet({ p1: 6, p2: 6 })).toBe(false);
    expect(isValidSet({ p1: 8, p2: 3 })).toBe(false);
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
