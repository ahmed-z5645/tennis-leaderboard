// Domain types shared across the client.

export const DEFAULT_ELO = 1000;

/** Games won per side in a single set. */
export interface SetScore {
  p1: number;
  p2: number;
}

export interface Player {
  id: string;
  user_id: string;
  display_name: string;
  avatar_color: string;
  created_at: string;
}

export interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  sets: SetScore[];
  winner_id: string;
  logged_by: string;
  created_at: string;
}

export interface EloHistory {
  id: string;
  player_id: string;
  match_id: string;
  elo_before: number;
  elo_after: number;
  delta: number;
  created_at: string;
}

/** A player's current standing, derived client-side for the leaderboard. */
export interface LeaderboardRow {
  player: Player;
  rank: number;
  elo: number;
  wins: number;
  losses: number;
  /** e.g. "W3" / "L2", or null with no matches. */
  streak: string | null;
  lastMatchAt: string | null;
}

/** Head-to-head summary vs a single opponent. */
export interface HeadToHead {
  opponent: Player;
  wins: number;
  losses: number;
  /** Average ELO change this player saw per match against the opponent. */
  avgDelta: number;
}

// ── Edge Function I/O ───────────────────────────────────────────────────

export interface LogMatchRequest {
  player1_id: string;
  player2_id: string;
  sets: SetScore[];
  winner_id: string;
}

export interface LogMatchResponse {
  match_id: string;
  winner_delta: number;
  loser_delta: number;
  winner_elo_after: number;
  loser_elo_after: number;
}
