// Pure helpers that derive standings from raw players / matches / elo_history.
// The dataset is tiny (a friend group), so computing on the client keeps the
// SQL surface minimal and these functions trivially testable.

import { DEFAULT_ELO } from '../types';
import type { EloHistory, HeadToHead, LeaderboardRow, Match, Player } from '../types';

/** Newest-first copy of matches the given player took part in. */
function playerMatchesDesc(playerId: string, matches: Match[]): Match[] {
  return matches
    .filter((m) => m.player1_id === playerId || m.player2_id === playerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Latest elo_after for a player, defaulting to 1000 if they have no history. */
export function currentElo(playerId: string, eloHistory: EloHistory[]): number {
  let latest: EloHistory | null = null;
  for (const h of eloHistory) {
    if (h.player_id !== playerId) continue;
    if (!latest || h.created_at.localeCompare(latest.created_at) > 0) latest = h;
  }
  return latest ? Number(latest.elo_after) : DEFAULT_ELO;
}

export function recordFor(playerId: string, matches: Match[]): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  for (const m of matches) {
    if (m.player1_id !== playerId && m.player2_id !== playerId) continue;
    if (m.winner_id === playerId) wins++;
    else losses++;
  }
  return { wins, losses };
}

/** Current streak as "W3" / "L2", or null when the player has no matches. */
export function streakFor(playerId: string, matches: Match[]): string | null {
  const mine = playerMatchesDesc(playerId, matches);
  if (mine.length === 0) return null;
  const won = (m: Match) => m.winner_id === playerId;
  const type = won(mine[0]) ? 'W' : 'L';
  let count = 0;
  for (const m of mine) {
    if ((won(m) ? 'W' : 'L') !== type) break;
    count++;
  }
  return `${type}${count}`;
}

export function lastMatchAt(playerId: string, matches: Match[]): string | null {
  const mine = playerMatchesDesc(playerId, matches);
  return mine.length > 0 ? mine[0].created_at : null;
}

/** Percentage of individual sets won (0–100), or null with no sets played. */
export function setsWonPct(playerId: string, matches: Match[]): number | null {
  let won = 0;
  let total = 0;
  for (const m of matches) {
    const isP1 = m.player1_id === playerId;
    const isP2 = m.player2_id === playerId;
    if (!isP1 && !isP2) continue;
    for (const s of m.sets) {
      total++;
      const mine = isP1 ? s.p1 : s.p2;
      const theirs = isP1 ? s.p2 : s.p1;
      if (mine > theirs) won++;
    }
  }
  return total === 0 ? null : Math.round((won / total) * 100);
}

/** Head-to-head rows vs every opponent the player has faced, by win count. */
export function headToHead(
  playerId: string,
  matches: Match[],
  players: Player[],
  eloHistory: EloHistory[],
): HeadToHead[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const deltaByMatch = new Map<string, number>();
  for (const h of eloHistory) {
    if (h.player_id === playerId) deltaByMatch.set(h.match_id, Number(h.delta));
  }

  const acc = new Map<string, { wins: number; losses: number; deltaSum: number; games: number }>();
  for (const m of matches) {
    const isP1 = m.player1_id === playerId;
    const isP2 = m.player2_id === playerId;
    if (!isP1 && !isP2) continue;
    const opponentId = isP1 ? m.player2_id : m.player1_id;
    const entry = acc.get(opponentId) ?? { wins: 0, losses: 0, deltaSum: 0, games: 0 };
    if (m.winner_id === playerId) entry.wins++;
    else entry.losses++;
    entry.deltaSum += deltaByMatch.get(m.id) ?? 0;
    entry.games++;
    acc.set(opponentId, entry);
  }

  const rows: HeadToHead[] = [];
  for (const [opponentId, e] of acc) {
    const opponent = byId.get(opponentId);
    if (!opponent) continue;
    rows.push({
      opponent,
      wins: e.wins,
      losses: e.losses,
      avgDelta: e.games === 0 ? 0 : Math.round(e.deltaSum / e.games),
    });
  }
  return rows.sort((a, b) => b.wins - a.wins || a.opponent.display_name.localeCompare(b.opponent.display_name));
}

/** Ranked leaderboard rows, highest ELO first. */
export function buildLeaderboard(
  players: Player[],
  matches: Match[],
  eloHistory: EloHistory[],
): LeaderboardRow[] {
  const rows = players.map((player) => {
    const { wins, losses } = recordFor(player.id, matches);
    return {
      player,
      rank: 0,
      elo: currentElo(player.id, eloHistory),
      wins,
      losses,
      streak: streakFor(player.id, matches),
      lastMatchAt: lastMatchAt(player.id, matches),
    } satisfies LeaderboardRow;
  });

  rows.sort(
    (a, b) => b.elo - a.elo || b.wins - a.wins || a.player.display_name.localeCompare(b.player.display_name),
  );
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}
