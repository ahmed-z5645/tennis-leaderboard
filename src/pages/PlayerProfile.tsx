import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useAuth } from '../auth';
import { supabase } from '../supabaseClient';
import { fetchCoreData } from '../lib/data';
import { currentElo, headToHead, recordFor, setsWonPct, streakFor } from '../lib/stats';
import { monthYear, scoreString, shortDate, signedDelta } from '../lib/format';
import { DEFAULT_ELO } from '../types';
import type { EloHistory, Match, Player } from '../types';
import BottomNav from '../components/BottomNav';
import AvatarCircle from '../components/AvatarCircle';
import Splash from '../components/Splash';

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { player: me } = useAuth();

  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [eloHistory, setEloHistory] = useState<EloHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchCoreData();
      setPlayers(data.players);
      setMatches(data.matches);
      setEloHistory(data.eloHistory);
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [id, load]);

  const player = players.find((p) => p.id === id) ?? null;
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // ── Derived stats ───────────────────────────────────────────────────────
  const elo = id ? currentElo(id, eloHistory) : DEFAULT_ELO;
  const { wins, losses } = id ? recordFor(id, matches) : { wins: 0, losses: 0 };
  const streak = id ? streakFor(id, matches) : null;
  const setsPct = id ? setsWonPct(id, matches) : null;
  const h2h = id ? headToHead(id, matches, players, eloHistory) : [];

  // ELO series: a starting baseline point + one point per match.
  const series = useMemo(() => {
    if (!id) return [];
    const hist = eloHistory
      .filter((h) => h.player_id === id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (hist.length === 0) return [];
    const start = Number(hist[0].elo_before);
    return [{ i: 0, elo: start }, ...hist.map((h, idx) => ({ i: idx + 1, elo: Number(h.elo_after) }))];
  }, [id, eloHistory]);

  const eloMin = series.length ? Math.min(...series.map((p) => p.elo)) : DEFAULT_ELO;
  const eloMax = series.length ? Math.max(...series.map((p) => p.elo)) : DEFAULT_ELO;
  const totalDelta = elo - DEFAULT_ELO;

  // This player's matches, newest first, with their per-match delta.
  const deltaByMatch = useMemo(() => {
    const m = new Map<string, number>();
    eloHistory.forEach((h) => {
      if (h.player_id === id) m.set(h.match_id, Number(h.delta));
    });
    return m;
  }, [eloHistory, id]);

  const myMatches = useMemo(
    () =>
      matches
        .filter((m) => m.player1_id === id || m.player2_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [matches, id],
  );

  async function handleDelete(matchId: string) {
    if (!window.confirm('Delete this match? Everyone’s ELO will be recalculated.')) return;
    setDeletingId(matchId);
    setError(null);
    const { error } = await supabase.functions.invoke('delete-match', { body: { match_id: matchId } });
    setDeletingId(null);
    if (error) {
      setError('Could not delete the match.');
      return;
    }
    await load();
  }

  if (loading) return <Splash />;
  if (!player) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="font-extrabold text-muted">Player not found.</p>
        <button onClick={() => navigate('/')} className="font-extrabold text-green-dark">
          Back to leaderboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3.5 border-b-2 border-edge bg-surface px-5 pb-3 pt-3.5">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border-2 border-edge bg-canvas text-ink"
          style={{ borderBottomWidth: 3, borderBottomColor: 'var(--color-edge-shadow)' }}
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-lg font-black text-ink">Profile</span>
      </div>

      <div className="flex-1 px-5 pb-4 pt-6">
        {/* Identity */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4">
            <AvatarCircle name={player.display_name} color={player.avatar_color} size={80} />
          </div>
          <h2 className="mb-2 text-[28px] font-black leading-none text-ink">{player.display_name}</h2>
          <div className="mb-1.5 flex items-baseline gap-1.5">
            <span className="text-[44px] font-black leading-none tabular-nums tracking-tighter text-ink">{elo}</span>
            <span className="text-[13px] font-extrabold uppercase tracking-wide text-muted">ELO</span>
          </div>
          <p className="text-[13px] font-bold text-muted">Joined {monthYear(player.created_at)}</p>
        </div>

        {/* Stats */}
        <div className="mb-5 flex gap-2">
          <StatCard label="Record" value={`${wins}–${losses}`} />
          <StatCard label="Streak" value={streak ?? '—'} highlight={streak?.startsWith('W') ? 'win' : streak?.startsWith('L') ? 'loss' : undefined} />
          <StatCard label="Sets" value={setsPct === null ? '—' : `${setsPct}%`} />
        </div>

        {/* ELO chart */}
        <div
          className="mb-5 rounded-[20px] border-2 border-edge bg-surface p-[18px]"
          style={{ borderBottomWidth: 3, borderBottomColor: 'var(--color-edge-shadow)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-base font-black text-ink">ELO history</p>
            {series.length > 1 && (
              <div className="rounded-full border-2 px-2.5 py-1" style={badgeStyle(totalDelta)}>
                <span className="text-xs font-extrabold tabular-nums" style={{ color: deltaColor(totalDelta) }}>
                  {signedDelta(totalDelta)} {totalDelta >= 0 ? '↑' : '↓'}
                </span>
              </div>
            )}
          </div>

          {series.length > 1 ? (
            <>
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={series} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="eloFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#58CC02" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#58CC02" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <ReferenceLine y={DEFAULT_ELO} stroke="#EBEBEB" strokeWidth={2} strokeDasharray="5 4" />
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={[eloMin - 22, eloMax + 22]} />
                  <Area
                    type="monotone"
                    dataKey="elo"
                    stroke="#58CC02"
                    strokeWidth={2.5}
                    fill="url(#eloFill)"
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-2.5 flex justify-between">
                <span className="text-[11px] font-bold tabular-nums text-muted">{eloMin}</span>
                <span className="text-[11px] font-bold text-muted">{series.length - 1} matches</span>
                <span className="text-[11px] font-extrabold tabular-nums text-green-dark">{eloMax}</span>
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm font-bold text-muted">Play a match to see your ELO trend.</p>
          )}
        </div>

        {/* Head to head */}
        {h2h.length > 0 && (
          <div className="mb-5">
            <p className="mb-2.5 text-lg font-black text-ink">Head to head</p>
            <div
              className="overflow-hidden rounded-[20px] border-2 border-edge bg-surface"
              style={{ borderBottomWidth: 3, borderBottomColor: 'var(--color-edge-shadow)' }}
            >
              {h2h.map((row) => (
                <button
                  key={row.opponent.id}
                  onClick={() => navigate(`/player/${row.opponent.id}`)}
                  className="flex w-full items-center gap-3 border-b-2 border-[#F5F5F5] px-4 py-3.5 text-left last:border-b-0"
                >
                  <AvatarCircle name={row.opponent.display_name} color={row.opponent.avatar_color} size={38} />
                  <span className="flex-1 text-[15px] font-extrabold text-ink">{row.opponent.display_name}</span>
                  <span className="text-xs font-bold tabular-nums text-muted">{signedDelta(row.avgDelta)}/match</span>
                  <div className="rounded-full border-2 px-3 py-1" style={badgeStyle(row.wins - row.losses)}>
                    <span className="text-[13px] font-extrabold tabular-nums" style={{ color: deltaColor(row.wins - row.losses) }}>
                      {row.wins}W {row.losses}L
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Match history */}
        {myMatches.length > 0 && (
          <div className="mb-5">
            <p className="mb-2.5 text-lg font-black text-ink">Recent matches</p>
            <div
              className="overflow-hidden rounded-[20px] border-2 border-edge bg-surface"
              style={{ borderBottomWidth: 3, borderBottomColor: 'var(--color-edge-shadow)' }}
            >
              {myMatches.map((m) => {
                const opponentId = m.player1_id === id ? m.player2_id : m.player1_id;
                const opponent = byId.get(opponentId);
                const won = m.winner_id === id;
                const delta = deltaByMatch.get(m.id) ?? 0;
                const canDelete = me?.id === m.logged_by;
                return (
                  <div key={m.id} className="flex items-center gap-2.5 border-b-2 border-[#F5F5F5] px-4 py-3.5 last:border-b-0">
                    <span className="w-11 flex-shrink-0 text-[11px] font-bold text-muted">{shortDate(m.created_at)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-extrabold text-ink">vs {opponent?.display_name ?? '—'}</div>
                      <div className="text-[11px] font-bold tabular-nums text-muted">{scoreString(m.sets)}</div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: won ? 'var(--color-green-light)' : 'var(--color-loss-light)' }}>
                      <span className="text-[11px] font-black" style={{ color: won ? 'var(--color-green-dark)' : 'var(--color-loss-dark)' }}>
                        {won ? 'W' : 'L'}
                      </span>
                      <span className="text-[13px] font-extrabold tabular-nums" style={{ color: won ? 'var(--color-green-dark)' : 'var(--color-loss-dark)' }}>
                        {signedDelta(delta)}
                      </span>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        className="flex-shrink-0 text-muted disabled:opacity-40"
                        aria-label="Delete match"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="mb-4 text-center text-sm font-bold text-loss-dark">{error}</p>}
      </div>

      <BottomNav />
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function deltaColor(n: number): string {
  return n >= 0 ? 'var(--color-green-dark)' : 'var(--color-loss-dark)';
}

function badgeStyle(n: number): React.CSSProperties {
  return n >= 0
    ? { background: 'var(--color-green-light)', borderColor: 'var(--color-green-mid)' }
    : { background: 'var(--color-loss-light)', borderColor: '#F5B5B5' };
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'win' | 'loss';
}) {
  const bg = highlight === 'win' ? 'var(--color-green-light)' : highlight === 'loss' ? 'var(--color-loss-light)' : 'var(--color-surface)';
  const border = highlight === 'win' ? 'var(--color-green-mid)' : highlight === 'loss' ? '#F5B5B5' : 'var(--color-edge)';
  const valueColor = highlight === 'win' ? 'var(--color-green-dark)' : highlight === 'loss' ? 'var(--color-loss-dark)' : 'var(--color-ink)';
  return (
    <div
      className="flex-1 rounded-2xl border-2 px-2 py-3.5 text-center"
      style={{ background: bg, borderColor: border, borderBottomWidth: 3, borderBottomColor: highlight ? border : 'var(--color-edge-shadow)' }}
    >
      <p className="text-base font-black tabular-nums" style={{ color: valueColor }}>{value}</p>
      <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
