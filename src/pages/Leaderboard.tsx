import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { supabase } from '../supabaseClient';
import { fetchCoreData } from '../lib/data';
import { buildLeaderboard } from '../lib/stats';
import { relativeTime } from '../lib/format';
import type { LeaderboardRow } from '../types';
import AvatarCircle from '../components/AvatarCircle';
import BottomNav from '../components/BottomNav';
import Toast from '../components/Toast';

const RANK_COLORS = ['#FFB800', '#AFAFAF', '#A0856C'];

interface FlashState {
  winnerId: string;
  loserId: string;
}

export default function Leaderboard() {
  const { player, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // A match we just logged ourselves — refetch silently, no toast.
  const suppressMatchId = useRef<string | null>(
    (location.state as { loggedMatchId?: string } | null)?.loggedMatchId ?? null,
  );

  async function refetch() {
    try {
      const { players, matches, eloHistory } = await fetchCoreData();
      setRows(buildLeaderboard(players, matches, eloHistory));
    } catch (err) {
      console.error('Failed to load leaderboard', err);
    } finally {
      setLoading(false);
    }
  }

  // Initial load + realtime subscription to new matches.
  useEffect(() => {
    refetch();
    const channel = supabase
      .channel('matches-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, (payload) => {
        const newId = (payload.new as { id: string }).id;
        refetch();
        if (newId === suppressMatchId.current) {
          suppressMatchId.current = null;
        } else {
          setToast('New match logged — leaderboard updated');
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Flash the two affected rows when arriving from a just-logged match.
  useEffect(() => {
    const state = location.state as FlashState | null;
    if (state?.winnerId && state?.loserId) {
      setFlash({ winnerId: state.winnerId, loserId: state.loserId });
      navigate(location.pathname, { replace: true, state: null });
      const t = setTimeout(() => setFlash(null), 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function flashAnimation(playerId: string): string | undefined {
    if (!flash) return undefined;
    if (playerId === flash.winnerId) return 'flashgreen 1.5s ease';
    if (playerId === flash.loserId) return 'flashred 1.5s ease';
    return undefined;
  }

  const lastPlayed = latestMatch(rows);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-edge bg-surface px-5 pb-3 pt-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[22px] font-black leading-none tracking-tight text-ink">ACES</span>
          <div className="flex items-center gap-1.5 rounded-full bg-green-light px-2.5 py-1">
            <div
              className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green"
              style={{ animation: 'livepulse 2s ease-in-out infinite' }}
            />
            <span className="text-[11px] font-extrabold tracking-wide text-green-dark">Live</span>
          </div>
        </div>

        {player && (
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} aria-label="Account menu">
              <AvatarCircle name={player.display_name} color={player.avatar_color} size={38} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-[46px] z-30 w-44 rounded-2xl border-2 border-edge bg-surface p-2"
                  style={{ borderBottomWidth: 3, borderBottomColor: 'var(--color-edge-shadow)', animation: 'popin 0.15s ease' }}
                >
                  <p className="truncate px-3 py-1.5 text-sm font-extrabold text-ink">{player.display_name}</p>
                  <button
                    onClick={() => signOut()}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-extrabold text-loss-dark hover:bg-canvas"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="px-5 pb-2.5 pt-5">
        <h1 className="text-[28px] font-black leading-none tracking-tight text-ink">Leaderboard</h1>
        <p className="mt-1 text-[13px] font-bold text-muted">
          {rows.length} {rows.length === 1 ? 'player' : 'players'} · just updated
        </p>
      </div>

      {/* Rows */}
      <div className="flex-1 px-4 pb-3 pt-1">
        {loading ? (
          <p className="px-4 py-8 text-center font-bold text-muted">Loading…</p>
        ) : (
          rows.map((row) => {
            const isFirst = row.rank === 1;
            const isWin = row.streak?.startsWith('W');
            return (
              <button
                key={row.player.id}
                onClick={() => navigate(`/player/${row.player.id}`)}
                className="mb-2 flex w-full cursor-pointer items-center gap-3 rounded-[20px] border-2 border-edge bg-surface px-4 py-3.5 text-left"
                style={{
                  borderBottomWidth: 4,
                  borderBottomColor: isFirst ? 'var(--color-gold-edge)' : 'var(--color-edge-shadow)',
                  animation: flashAnimation(row.player.id),
                }}
              >
                <span
                  className="w-5 flex-shrink-0 text-center text-[13px] font-extrabold leading-none"
                  style={{ color: RANK_COLORS[row.rank - 1] ?? 'var(--color-muted)' }}
                >
                  {row.rank}
                </span>
                <AvatarCircle name={row.player.display_name} color={row.player.avatar_color} size={46} />
                <div className="flex-1">
                  <div className="text-base font-extrabold leading-tight text-ink">{row.player.display_name}</div>
                  <div className="mt-0.5 text-xs font-bold tabular-nums text-muted">
                    {row.wins}W {row.losses}L
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-2xl font-black leading-none tabular-nums tracking-tight text-ink">{row.elo}</span>
                  {row.streak && (
                    <div
                      className="rounded-full px-2.5 py-[3px]"
                      style={{ background: isWin ? 'var(--color-green-light)' : 'var(--color-loss-light)' }}
                    >
                      <span
                        className="text-xs font-extrabold"
                        style={{ color: isWin ? 'var(--color-green-dark)' : 'var(--color-loss-dark)' }}
                      >
                        {row.streak}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
        {!loading && lastPlayed && (
          <p className="mt-2 px-4 text-center text-xs font-bold text-muted">Last match {relativeTime(lastPlayed)}</p>
        )}
      </div>

      {toast && <Toast message={toast} />}
      <BottomNav />
    </div>
  );
}

/** Most recent match time across all rows, for the footer line. */
function latestMatch(rows: LeaderboardRow[]): string | undefined {
  return rows
    .map((r) => r.lastMatchAt)
    .filter((t): t is string => !!t)
    .sort((a, b) => b.localeCompare(a))[0];
}
