import { describe, expect, it } from 'vitest';
import type { EloHistory, Match, Player } from '../types';
import {
  buildLeaderboard,
  currentElo,
  headToHead,
  lastMatchAt,
  recordFor,
  setsWonPct,
  streakFor,
} from './stats';

const player = (id: string, name: string): Player => ({
  id,
  user_id: `u-${id}`,
  display_name: name,
  avatar_color: '#5B54E8',
  created_at: '2025-01-01T00:00:00Z',
});

const a = player('a', 'Ahmed');
const b = player('b', 'Zara');
const c = player('c', 'Marcus');
const players = [a, b, c];

// a beats b (Jan 2), a beats c (Jan 3), b beats a (Jan 4)
const matches: Match[] = [
  {
    id: 'm1',
    player1_id: 'a',
    player2_id: 'b',
    sets: [{ p1: 6, p2: 3 }, { p1: 6, p2: 4 }],
    winner_id: 'a',
    logged_by: 'a',
    created_at: '2025-01-02T00:00:00Z',
  },
  {
    id: 'm2',
    player1_id: 'a',
    player2_id: 'c',
    sets: [{ p1: 6, p2: 0 }, { p1: 6, p2: 0 }],
    winner_id: 'a',
    logged_by: 'a',
    created_at: '2025-01-03T00:00:00Z',
  },
  {
    id: 'm3',
    player1_id: 'b',
    player2_id: 'a',
    sets: [{ p1: 6, p2: 4 }, { p1: 7, p2: 5 }],
    winner_id: 'b',
    logged_by: 'b',
    created_at: '2025-01-04T00:00:00Z',
  },
];

const eloHistory: EloHistory[] = [
  { id: 'h1', player_id: 'a', match_id: 'm1', elo_before: 1000, elo_after: 1011, delta: 11, created_at: '2025-01-02T00:00:00Z' },
  { id: 'h2', player_id: 'b', match_id: 'm1', elo_before: 1000, elo_after: 989, delta: -11, created_at: '2025-01-02T00:00:00Z' },
  { id: 'h3', player_id: 'a', match_id: 'm2', elo_before: 1011, elo_after: 1035, delta: 24, created_at: '2025-01-03T00:00:00Z' },
  { id: 'h4', player_id: 'c', match_id: 'm2', elo_before: 1000, elo_after: 976, delta: -24, created_at: '2025-01-03T00:00:00Z' },
  { id: 'h5', player_id: 'b', match_id: 'm3', elo_before: 989, elo_after: 1003, delta: 14, created_at: '2025-01-04T00:00:00Z' },
  { id: 'h6', player_id: 'a', match_id: 'm3', elo_before: 1035, elo_after: 1021, delta: -14, created_at: '2025-01-04T00:00:00Z' },
];

describe('currentElo', () => {
  it('returns the latest elo_after', () => {
    expect(currentElo('a', eloHistory)).toBe(1021);
    expect(currentElo('b', eloHistory)).toBe(1003);
  });
  it('defaults to 1000 with no history', () => {
    expect(currentElo('nobody', eloHistory)).toBe(1000);
  });
});

describe('recordFor', () => {
  it('counts wins and losses', () => {
    expect(recordFor('a', matches)).toEqual({ wins: 2, losses: 1 });
    expect(recordFor('b', matches)).toEqual({ wins: 1, losses: 1 });
    expect(recordFor('c', matches)).toEqual({ wins: 0, losses: 1 });
  });
});

describe('streakFor', () => {
  it('reads the current run from the most recent match', () => {
    expect(streakFor('a', matches)).toBe('L1'); // last match was a loss
    expect(streakFor('c', matches)).toBe('L1');
    expect(streakFor('b', matches)).toBe('W1');
  });
  it('is null with no matches', () => {
    expect(streakFor('nobody', matches)).toBeNull();
  });
});

describe('lastMatchAt', () => {
  it('returns the newest match time', () => {
    expect(lastMatchAt('a', matches)).toBe('2025-01-04T00:00:00Z');
  });
});

describe('setsWonPct', () => {
  it('computes sets won over sets played', () => {
    // a: m1 won 2, m2 won 2, m3 lost 2 -> 4/6 = 67%
    expect(setsWonPct('a', matches)).toBe(67);
    expect(setsWonPct('c', matches)).toBe(0);
    expect(setsWonPct('nobody', matches)).toBeNull();
  });
});

describe('headToHead', () => {
  it('summarizes record and avg delta per opponent', () => {
    const h2h = headToHead('a', matches, players, eloHistory);
    const vsB = h2h.find((r) => r.opponent.id === 'b')!;
    const vsC = h2h.find((r) => r.opponent.id === 'c')!;
    expect(vsB).toMatchObject({ wins: 1, losses: 1 });
    expect(vsB.avgDelta).toBe(Math.round((11 + -14) / 2)); // -2
    expect(vsC).toMatchObject({ wins: 1, losses: 0, avgDelta: 24 });
  });
});

describe('buildLeaderboard', () => {
  it('ranks by ELO descending', () => {
    const rows = buildLeaderboard(players, matches, eloHistory);
    expect(rows.map((r) => r.player.id)).toEqual(['a', 'b', 'c']);
    expect(rows[0]).toMatchObject({ rank: 1, elo: 1021, wins: 2, losses: 1, streak: 'L1' });
    expect(rows[2]).toMatchObject({ rank: 3, elo: 976 });
  });
});
