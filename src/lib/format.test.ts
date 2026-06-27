import { describe, expect, it } from 'vitest';
import { monthYear, relativeTime, scoreString, shortDate, signedDelta } from './format';

describe('signedDelta', () => {
  it('prefixes sign with a real minus for negatives', () => {
    expect(signedDelta(18)).toBe('+18');
    expect(signedDelta(-14)).toBe('−14');
    expect(signedDelta(0)).toBe('0');
  });
});

describe('scoreString', () => {
  it('joins sets with en-dashes', () => {
    expect(scoreString([{ p1: 6, p2: 3 }, { p1: 4, p2: 6 }, { p1: 7, p2: 5 }])).toBe('6–3, 4–6, 7–5');
  });
});

describe('relativeTime', () => {
  const now = new Date('2025-06-27T12:00:00Z');
  it('handles recent buckets', () => {
    expect(relativeTime('2025-06-27T11:59:30Z', now)).toBe('just now');
    expect(relativeTime('2025-06-27T11:30:00Z', now)).toBe('30m ago');
    expect(relativeTime('2025-06-27T09:00:00Z', now)).toBe('3h ago');
    expect(relativeTime('2025-06-25T12:00:00Z', now)).toBe('2d ago');
  });
  it('falls back to a short date past a week', () => {
    expect(relativeTime('2025-06-10T12:00:00Z', now)).toBe(shortDate('2025-06-10T12:00:00Z'));
  });
});

describe('date formatting', () => {
  it('formats month + year', () => {
    expect(monthYear('2025-03-15T00:00:00Z')).toMatch(/March 2025/);
  });
});
