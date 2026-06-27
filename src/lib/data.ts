// Thin data-access helpers over Supabase. The leaderboard and profile both
// derive everything from these three tables client-side (see lib/stats.ts).

import { supabase } from '../supabaseClient';
import type { EloHistory, Match, Player } from '../types';

export async function fetchCoreData(): Promise<{
  players: Player[];
  matches: Match[];
  eloHistory: EloHistory[];
}> {
  const [players, matches, eloHistory] = await Promise.all([
    supabase.from('players').select('*'),
    supabase.from('matches').select('*').order('created_at', { ascending: false }),
    supabase.from('elo_history').select('*'),
  ]);

  if (players.error) throw players.error;
  if (matches.error) throw matches.error;
  if (eloHistory.error) throw eloHistory.error;

  return {
    players: (players.data as Player[]) ?? [],
    matches: (matches.data as Match[]) ?? [],
    eloHistory: (eloHistory.data as EloHistory[]) ?? [],
  };
}
