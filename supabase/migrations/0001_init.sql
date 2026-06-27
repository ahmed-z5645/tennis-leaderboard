-- ACES Tennis ELO Tracker — initial schema
-- Players, matches, and per-match ELO history, with RLS and realtime.

-- ── Tables ────────────────────────────────────────────────────────────

-- Players (one per user account)
create table players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade unique not null,
  display_name text not null unique,
  avatar_color text not null default '#5B54E8',
  created_at timestamptz default now()
);

-- Matches. Written ONLY by the log-match Edge Function (service role).
create table matches (
  id uuid primary key default gen_random_uuid(),
  player1_id uuid references players (id) not null,
  player2_id uuid references players (id) not null,
  sets jsonb not null, -- array of {p1: number, p2: number}
  winner_id uuid references players (id) not null,
  logged_by uuid references players (id) not null,
  created_at timestamptz default now()
);

-- ELO history (one row per player per match). Written ONLY by Edge Functions.
create table elo_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players (id) not null,
  match_id uuid references matches (id) on delete cascade not null,
  elo_before numeric not null,
  elo_after numeric not null,
  delta numeric not null,
  created_at timestamptz default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────
create index elo_history_player_created_idx on elo_history (player_id, created_at desc);
create index elo_history_match_idx on elo_history (match_id);
create index matches_created_idx on matches (created_at desc);

-- ── Row Level Security ────────────────────────────────────────────────

-- Players: any authenticated user can read; only the owner can insert/update their row.
alter table players enable row level security;
create policy "players_read" on players for select using (auth.role() = 'authenticated');
create policy "players_insert" on players for insert with check (auth.uid() = user_id);
create policy "players_update" on players for update using (auth.uid() = user_id);

-- Matches: any authenticated user can read.
-- Inserts and deletes go through Edge Functions using the service role
-- (which bypasses RLS), so no client insert/delete policy is granted.
alter table matches enable row level security;
create policy "matches_read" on matches for select using (auth.role() = 'authenticated');

-- ELO history: read-only for authenticated users; only Edge Functions write.
alter table elo_history enable row level security;
create policy "elo_read" on elo_history for select using (auth.role() = 'authenticated');

-- ── Realtime ──────────────────────────────────────────────────────────
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table players;
