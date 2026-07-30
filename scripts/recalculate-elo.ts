/**
 * One-off maintenance script: rebuild all historical ELO from scratch.
 *
 * Why this exists
 * ───────────────
 * `calculateElo` had an inverted loser delta (`k * expected` instead of
 * `k * (1 - expected)`). Every rating ever written by log-match used the buggy
 * formula, and because each match's ELO inputs are the outputs of the prior
 * matches, the error is path-dependent — it cannot be patched row by row. The
 * only correct repair is a full chronological replay.
 *
 * What holds ELO in this schema
 * ─────────────────────────────
 * `elo_history` (elo_before / elo_after / delta, one row per player per match)
 * is the ONLY persisted ELO state. There is no `players.elo` column and no
 * view or materialized view that caches ratings: the leaderboard, the profile
 * chart, and the log-match opponent list all derive current ELO at read time
 * from the latest `elo_history.elo_after` (see src/lib/stats.ts `currentElo`
 * and supabase/functions/log-match/index.ts `currentElo`), falling back to
 * DEFAULT_ELO when a player has no rows.
 *
 * So "reset every player to DEFAULT_ELO" is accomplished by clearing
 * `elo_history`: with no rows, every player reads as DEFAULT_ELO. The replay
 * then rewrites the full per-match snapshot set, which regenerates the profile
 * charts and head-to-head average deltas at the same time as the final totals.
 *
 * The math is imported from the shared module — this script deliberately does
 * not reimplement it, so it can never drift from the Edge Functions.
 *
 * Usage
 * ─────
 *   npm run recalc:elo          # dry run — prints the diff, writes nothing
 *   npm run recalc:elo -- --apply
 *
 * The apply path backs `elo_history` up to a timestamped JSON file first.
 */

import { writeFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_ELO,
  deriveWinner,
  eloFromSets,
  type SetScore,
} from '../supabase/functions/_shared/elo.ts';

// ── Config ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
// Secret / service-role key: required because elo_history grants no client
// write policy (RLS allows SELECT only; all writes go through the service role).
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const APPLY = process.argv.includes('--apply');

/** Supabase caps a single response at 1000 rows (supabase/config.toml max_rows). */
const PAGE = 1000;
const INSERT_BATCH = 500;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error(
    'Missing SUPABASE_URL / SUPABASE_SECRET_KEY.\n' +
      'Run via npm run recalc:elo (which loads .env), or export them yourself.',
  );
  process.exit(1);
}

// ── Types (mirror the 0001_init.sql schema) ─────────────────────────────

interface PlayerRow {
  id: string;
  display_name: string;
}

interface MatchRow {
  id: string;
  player1_id: string;
  player2_id: string;
  sets: SetScore[];
  winner_id: string;
  created_at: string;
}

interface HistoryRow {
  id: string;
  player_id: string;
  match_id: string;
  elo_before: number;
  elo_after: number;
  delta: number;
  created_at: string;
}

interface NewHistoryRow {
  player_id: string;
  match_id: string;
  elo_before: number;
  elo_after: number;
  delta: number;
  created_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Reads a whole table, paging past max_rows. `order` must be a total ordering
 * so paging is stable — otherwise rows can be skipped or repeated between pages.
 */
async function fetchAll<T>(
  db: SupabaseClient,
  table: string,
  columns: string,
  order: string[],
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(columns).range(from, from + PAGE - 1);
    for (const col of order) q = q.order(col, { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

function fmt(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

// ── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = createClient(SUPABASE_URL!, SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${SUPABASE_URL}\n`);

  // 1. Load everything.
  //
  // Ordering: `matches.created_at` is the only temporal column (timestamptz,
  // default now()). It is not unique, so `id` is appended as a deterministic
  // tie-break — without it, two matches sharing a timestamp could replay in a
  // different order on every run and produce different ratings.
  const [players, matches, oldHistory] = await Promise.all([
    fetchAll<PlayerRow>(db, 'players', 'id, display_name', ['display_name']),
    fetchAll<MatchRow>(
      db,
      'matches',
      'id, player1_id, player2_id, sets, winner_id, created_at',
      ['created_at', 'id'],
    ),
    fetchAll<HistoryRow>(
      db,
      'elo_history',
      'id, player_id, match_id, elo_before, elo_after, delta, created_at',
      ['created_at', 'id'],
    ),
  ]);

  const nameOf = new Map(players.map((p) => [p.id, p.display_name]));
  console.log(
    `Loaded ${players.length} players, ${matches.length} matches, ${oldHistory.length} elo_history rows.`,
  );

  // Flag same-timestamp matches: current ELO is read as "latest elo_after by
  // created_at" with no tie-break, so these are ambiguous for readers too.
  const byTimestamp = new Map<string, number>();
  for (const m of matches) byTimestamp.set(m.created_at, (byTimestamp.get(m.created_at) ?? 0) + 1);
  const collisions = [...byTimestamp.values()].filter((c) => c > 1).length;
  if (collisions > 0) {
    console.warn(
      `\n⚠ ${collisions} timestamp(s) shared by multiple matches. Replay order is ` +
        `made deterministic here via (created_at, id), but readers that pick the ` +
        `"latest" row by created_at alone may still resolve those ties arbitrarily.`,
    );
  }

  // 2. Replay. Every player starts at DEFAULT_ELO.
  const elo = new Map<string, number>();
  const eloOf = (id: string) => elo.get(id) ?? DEFAULT_ELO;
  const rebuilt: NewHistoryRow[] = [];
  const skipped: string[] = [];

  for (const m of matches) {
    const winnerSide = deriveWinner(m.sets);
    if (!winnerSide) {
      skipped.push(m.id);
      continue;
    }

    // Trust the scores over the stored winner_id, but surface any disagreement:
    // log-match validates the two agree, so a mismatch means tampered data.
    const derivedWinnerId = winnerSide === 'p1' ? m.player1_id : m.player2_id;
    if (derivedWinnerId !== m.winner_id) {
      console.warn(
        `⚠ match ${m.id}: winner_id disagrees with sets; replaying per sets ` +
          `(${nameOf.get(derivedWinnerId) ?? derivedWinnerId} won).`,
      );
    }

    const p1Before = eloOf(m.player1_id);
    const p2Before = eloOf(m.player2_id);
    const { p1Delta, p2Delta } = eloFromSets(m.sets, winnerSide, p1Before, p2Before);
    const p1After = p1Before + p1Delta;
    const p2After = p2Before + p2Delta;
    elo.set(m.player1_id, p1After);
    elo.set(m.player2_id, p2After);

    // created_at is stamped with the MATCH time (not now()), so that
    // "latest elo_after" and the profile chart's ordering stay meaningful.
    rebuilt.push(
      {
        player_id: m.player1_id,
        match_id: m.id,
        elo_before: p1Before,
        elo_after: p1After,
        delta: p1Delta,
        created_at: m.created_at,
      },
      {
        player_id: m.player2_id,
        match_id: m.id,
        elo_before: p2Before,
        elo_after: p2After,
        delta: p2Delta,
        created_at: m.created_at,
      },
    );
  }

  if (skipped.length > 0) {
    console.warn(`\n⚠ Skipped ${skipped.length} match(es) with inconclusive sets: ${skipped.join(', ')}`);
  }

  // 3. Report the diff, using the same "latest elo_after wins" rule the app uses.
  const oldFinal = new Map<string, number>();
  for (const h of oldHistory) oldFinal.set(h.player_id, Number(h.elo_after)); // ascending, so last write wins

  console.log(`\nFinal ELO (old → new):`);
  const report = players
    .map((p) => ({
      name: p.display_name,
      before: oldFinal.get(p.id) ?? DEFAULT_ELO,
      after: elo.get(p.id) ?? DEFAULT_ELO,
    }))
    .sort((a, b) => b.after - a.after);

  const width = Math.max(4, ...report.map((r) => r.name.length));
  for (const r of report) {
    const shift = r.after - r.before;
    console.log(
      `  ${r.name.padEnd(width)}  ${String(r.before).padStart(5)} → ${String(r.after).padStart(5)}` +
        `  (${fmt(shift)})${shift === 0 ? '' : ' *'}`,
    );
  }
  console.log(
    `\nelo_history rows: ${oldHistory.length} existing → ${rebuilt.length} rebuilt` +
      `  |  players whose rating changes: ${report.filter((r) => r.after !== r.before).length}`,
  );

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to commit.');
    return;
  }

  // 4. Back up before destroying anything.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `elo_history-backup-${stamp}.json`;
  writeFileSync(backup, JSON.stringify(oldHistory, null, 2));
  console.log(`\nBacked up ${oldHistory.length} rows to ${backup}`);

  // 5. Replace elo_history wholesale.
  const { error: wipeErr } = await db
    .from('elo_history')
    .delete()
    .gte('created_at', '1970-01-01'); // delete-all guard; PostgREST requires a filter
  if (wipeErr) throw new Error(`wipe elo_history: ${wipeErr.message}`);
  console.log('Cleared elo_history (all players now read as DEFAULT_ELO).');

  for (let i = 0; i < rebuilt.length; i += INSERT_BATCH) {
    const batch = rebuilt.slice(i, i + INSERT_BATCH);
    const { error } = await db.from('elo_history').insert(batch);
    if (error) {
      throw new Error(
        `insert rows ${i}–${i + batch.length - 1}: ${error.message}\n` +
          `elo_history is now PARTIALLY REBUILT. Restore from ${backup} or re-run this script.`,
      );
    }
    console.log(`  inserted ${Math.min(i + batch.length, rebuilt.length)}/${rebuilt.length}`);
  }

  // 6. Verify what actually landed.
  const check = await fetchAll<HistoryRow>(
    db,
    'elo_history',
    'id, player_id, match_id, elo_before, elo_after, delta, created_at',
    ['created_at', 'id'],
  );
  if (check.length !== rebuilt.length) {
    throw new Error(`Verify failed: expected ${rebuilt.length} rows, found ${check.length}.`);
  }
  const drift = players.filter((p) => {
    const persisted = [...check].reverse().find((h) => h.player_id === p.id);
    return Number(persisted?.elo_after ?? DEFAULT_ELO) !== (elo.get(p.id) ?? DEFAULT_ELO);
  });
  if (drift.length > 0) {
    throw new Error(`Verify failed: ${drift.map((p) => p.display_name).join(', ')} disagree.`);
  }

  console.log(`\n✓ Rebuilt ${rebuilt.length} rows across ${matches.length} matches; verified.`);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
