// log-match — the only path that writes a match.
// Validates input, computes margin-weighted ELO, then inserts the match plus
// one elo_history row per player using the service role (bypassing RLS).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import {
  DEFAULT_ELO,
  deriveWinner,
  eloFromSets,
  validateSets,
  type SetScore,
} from '../_shared/elo.ts';

interface LogMatchBody {
  player1_id: string;
  player2_id: string;
  sets: SetScore[];
  winner_id: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Latest ELO for a player, defaulting to 1000 if they have no history. */
async function currentElo(
  admin: ReturnType<typeof createClient>,
  playerId: string,
): Promise<number> {
  const { data, error } = await admin
    .from('elo_history')
    .select('elo_after')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.elo_after) : DEFAULT_ELO;
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // 1. Authenticate the caller from their JWT.
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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Resolve the caller's player row (used as logged_by).
    const { data: logger, error: loggerErr } = await admin
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (loggerErr) throw loggerErr;
    if (!logger) return jsonResponse({ error: 'No player profile' }, 403);

    // 2. Validate the body.
    const body = (await req.json()) as LogMatchBody;
    const { player1_id, player2_id, sets, winner_id } = body;

    if (!player1_id || !player2_id || !winner_id) {
      return jsonResponse({ error: 'Missing player or winner' }, 400);
    }
    if (player1_id === player2_id) {
      return jsonResponse({ error: 'Players must be different' }, 400);
    }
    if (!validateSets(sets)) {
      return jsonResponse({ error: 'Invalid set scores' }, 400);
    }

    const winnerSide = deriveWinner(sets);
    if (!winnerSide) {
      return jsonResponse({ error: 'Sets are not conclusive' }, 400);
    }
    const derivedWinnerId = winnerSide === 'p1' ? player1_id : player2_id;
    if (derivedWinnerId !== winner_id) {
      return jsonResponse({ error: 'winner_id does not match the score' }, 400);
    }

    // Confirm both players exist.
    const { data: foundPlayers, error: playersErr } = await admin
      .from('players')
      .select('id')
      .in('id', [player1_id, player2_id]);
    if (playersErr) throw playersErr;
    if (!foundPlayers || foundPlayers.length !== 2) {
      return jsonResponse({ error: 'Player not found' }, 400);
    }

    // 3. Current ELOs.
    const [p1Elo, p2Elo] = await Promise.all([
      currentElo(admin, player1_id),
      currentElo(admin, player2_id),
    ]);

    // 4. Compute deltas.
    const { winnerDelta, loserDelta, p1Delta, p2Delta } = eloFromSets(
      sets,
      winnerSide,
      p1Elo,
      p2Elo,
    );

    // 5. Insert the match.
    const { data: match, error: matchErr } = await admin
      .from('matches')
      .insert({
        player1_id,
        player2_id,
        sets,
        winner_id,
        logged_by: logger.id,
      })
      .select('id')
      .single();
    if (matchErr) throw matchErr;

    // 6. Insert one elo_history row per player.
    const p1After = p1Elo + p1Delta;
    const p2After = p2Elo + p2Delta;
    const { error: histErr } = await admin.from('elo_history').insert([
      {
        player_id: player1_id,
        match_id: match.id,
        elo_before: p1Elo,
        elo_after: p1After,
        delta: p1Delta,
      },
      {
        player_id: player2_id,
        match_id: match.id,
        elo_before: p2Elo,
        elo_after: p2After,
        delta: p2Delta,
      },
    ]);
    if (histErr) throw histErr;

    // 7. Respond with the winner/loser framing.
    const winnerEloAfter = winnerSide === 'p1' ? p1After : p2After;
    const loserEloAfter = winnerSide === 'p1' ? p2After : p1After;
    return jsonResponse({
      match_id: match.id,
      winner_delta: winnerDelta,
      loser_delta: loserDelta,
      winner_elo_after: winnerEloAfter,
      loser_elo_after: loserEloAfter,
    });
  } catch (err) {
    console.error('log-match error', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
