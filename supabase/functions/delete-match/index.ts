// delete-match — removes a match (only by the player who logged it), then
// rebuilds elo_history by replaying every remaining match in chronological
// order. Full replay keeps ELO perfectly consistent after a deletion.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { DEFAULT_ELO, deriveWinner, eloFromSets, type SetScore } from '../_shared/elo.ts';

interface DeleteMatchBody {
  match_id: string;
}

interface MatchRow {
  id: string;
  player1_id: string;
  player2_id: string;
  sets: SetScore[];
  created_at: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { match_id } = (await req.json()) as DeleteMatchBody;
    if (!match_id) return jsonResponse({ error: 'Missing match_id' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Only the player who logged the match may delete it.
    const { data: logger } = await admin
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!logger) return jsonResponse({ error: 'No player profile' }, 403);

    const { data: target, error: targetErr } = await admin
      .from('matches')
      .select('id, logged_by')
      .eq('id', match_id)
      .maybeSingle();
    if (targetErr) throw targetErr;
    if (!target) return jsonResponse({ error: 'Match not found' }, 404);
    if (target.logged_by !== logger.id) {
      return jsonResponse({ error: 'Only the logger can delete this match' }, 403);
    }

    // Delete the match (cascades its elo_history rows).
    const { error: delErr } = await admin.from('matches').delete().eq('id', match_id);
    if (delErr) throw delErr;

    // Replay: wipe all elo_history, recompute from scratch over remaining matches.
    const { error: wipeErr } = await admin
      .from('elo_history')
      .delete()
      .gte('created_at', '1970-01-01'); // delete-all guard (RLS-bypassed service role)
    if (wipeErr) throw wipeErr;

    const { data: matches, error: matchesErr } = await admin
      .from('matches')
      .select('id, player1_id, player2_id, sets, created_at')
      .order('created_at', { ascending: true });
    if (matchesErr) throw matchesErr;

    const elo = new Map<string, number>();
    const getElo = (id: string) => elo.get(id) ?? DEFAULT_ELO;
    const rows: Record<string, unknown>[] = [];

    for (const m of (matches ?? []) as MatchRow[]) {
      const winnerSide = deriveWinner(m.sets);
      if (!winnerSide) continue; // skip any malformed historical match defensively

      const p1Elo = getElo(m.player1_id);
      const p2Elo = getElo(m.player2_id);
      const { p1Delta, p2Delta } = eloFromSets(m.sets, winnerSide, p1Elo, p2Elo);
      const p1After = p1Elo + p1Delta;
      const p2After = p2Elo + p2Delta;
      elo.set(m.player1_id, p1After);
      elo.set(m.player2_id, p2After);

      // Stamp created_at with the match time so "latest by created_at" stays correct.
      rows.push(
        {
          player_id: m.player1_id,
          match_id: m.id,
          elo_before: p1Elo,
          elo_after: p1After,
          delta: p1Delta,
          created_at: m.created_at,
        },
        {
          player_id: m.player2_id,
          match_id: m.id,
          elo_before: p2Elo,
          elo_after: p2After,
          delta: p2Delta,
          created_at: m.created_at,
        },
      );
    }

    if (rows.length > 0) {
      const { error: insErr } = await admin.from('elo_history').insert(rows);
      if (insErr) throw insErr;
    }

    return jsonResponse({ deleted: match_id, replayed_matches: matches?.length ?? 0 });
  } catch (err) {
    console.error('delete-match error', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
