import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { supabase } from '../supabaseClient';
import { fetchCoreData } from '../lib/data';
import { buildLeaderboard } from '../lib/stats';
import { scoreString, signedDelta } from '../lib/format';
import { shadowFor } from '../lib/theme';
import { deriveWinner, isValidSet } from '../../supabase/functions/_shared/elo';
import type { LogMatchResponse, Player, SetScore } from '../types';
import AvatarCircle from '../components/AvatarCircle';
import BottomNav from '../components/BottomNav';
import PrimaryButton from '../components/PrimaryButton';

const MAX_SETS = 5;

interface PlayerStat {
  elo: number;
  wins: number;
  losses: number;
}

type SetInput = { p1: string; p2: string };

interface Result {
  winner: Player;
  loser: Player;
  scores: SetScore[];
  res: LogMatchResponse;
}

export default function LogMatch() {
  const { player: me } = useAuth();
  const navigate = useNavigate();

  const [players, setPlayers] = useState<Player[]>([]);
  const [statsById, setStatsById] = useState<Map<string, PlayerStat>>(new Map());
  const [p1, setP1] = useState<Player | null>(null);
  const [p2, setP2] = useState<Player | null>(null);
  const [sets, setSets] = useState<SetInput[]>([{ p1: '', p2: '' }]);
  const [sheetFor, setSheetFor] = useState<1 | 2 | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Load players (+ derived ELO/record for the picker subtitles). Default P1 to me.
  useEffect(() => {
    (async () => {
      try {
        const { players, matches, eloHistory } = await fetchCoreData();
        const rows = buildLeaderboard(players, matches, eloHistory);
        const map = new Map<string, PlayerStat>();
        rows.forEach((r) => map.set(r.player.id, { elo: r.elo, wins: r.wins, losses: r.losses }));
        setPlayers(players);
        setStatsById(map);
        if (me) setP1(players.find((p) => p.id === me.id) ?? null);
      } catch (err) {
        console.error('Failed to load players', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setScore(idx: number, side: 'p1' | 'p2', raw: string) {
    const clean = raw.replace(/\D/g, '').slice(0, 2);
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [side]: clean } : s)));
  }

  // ── Derived validity / preview ────────────────────────────────────────
  const { completed, anyPartial, winnerSide, p1Sets, p2Sets } = useMemo(() => {
    const completed: SetScore[] = [];
    let anyPartial = false;
    for (const s of sets) {
      const hasP1 = s.p1 !== '';
      const hasP2 = s.p2 !== '';
      if (!hasP1 && !hasP2) continue; // blank row, ignore
      if (hasP1 !== hasP2) {
        anyPartial = true;
        continue;
      }
      const score: SetScore = { p1: Number(s.p1), p2: Number(s.p2) };
      if (!isValidSet(score)) {
        anyPartial = true;
        continue;
      }
      completed.push(score);
    }
    let p1Sets = 0;
    let p2Sets = 0;
    completed.forEach((s) => (s.p1 > s.p2 ? p1Sets++ : p2Sets++));
    return { completed, anyPartial, winnerSide: deriveWinner(completed), p1Sets, p2Sets };
  }, [sets]);

  const playersChosen = !!p1 && !!p2 && p1.id !== p2.id;
  const canAddSet = sets.length < MAX_SETS;
  const valid = playersChosen && !anyPartial && completed.length >= 1 && winnerSide !== null;

  const previewText = (() => {
    if (!playersChosen || completed.length === 0) return '';
    if (winnerSide === null) return 'Sets tied — finish the match';
    const winnerName = winnerSide === 'p1' ? p1!.display_name : p2!.display_name;
    const lead = Math.max(p1Sets, p2Sets);
    const trail = Math.min(p1Sets, p2Sets);
    return `${winnerName} wins ${lead}–${trail}`;
  })();

  async function submit() {
    if (!valid || submitting || !p1 || !p2 || winnerSide === null) return;
    setSubmitting(true);
    setError(null);
    const winner = winnerSide === 'p1' ? p1 : p2;
    const loser = winnerSide === 'p1' ? p2 : p1;

    const { data, error } = await supabase.functions.invoke<LogMatchResponse>('log-match', {
      body: { player1_id: p1.id, player2_id: p2.id, sets: completed, winner_id: winner.id },
    });
    setSubmitting(false);

    if (error || !data) {
      setError('Could not log the match. Check the scores and try again.');
      return;
    }
    setResult({ winner, loser, scores: completed, res: data });
  }

  const pickable = (slot: 1 | 2) => players.filter((p) => (slot === 1 ? p.id !== p2?.id : p.id !== p1?.id));

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3.5 border-b-2 border-edge bg-surface px-5 pb-3 pt-3.5">
        <button
          onClick={() => navigate('/')}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border-2 border-edge bg-canvas text-ink"
          style={{ borderBottomWidth: 3, borderBottomColor: 'var(--color-edge-shadow)' }}
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-lg font-black text-ink">Log match</span>
      </div>

      <div className="flex-1 px-5 pb-2 pt-5">
        <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-muted">Players</p>

        {/* You are always one side of the match — this slot is locked. */}
        <YouSlot player={p1} />
        <div className="my-2.5 flex items-center justify-center">
          <div className="rounded-full border-2 border-edge bg-[#F5F5F5] px-[18px] py-1.5">
            <span className="text-xs font-extrabold tracking-[1.5px] text-muted">VS</span>
          </div>
        </div>
        <PlayerSlot player={p2} onClick={() => setSheetFor(2)} />

        <p className="mb-2 mt-6 text-xs font-extrabold uppercase tracking-wide text-muted">Score</p>

        {sets.map((s, i) => (
          <div key={i} className="mb-2">
            <p className="mb-2 text-[13px] font-bold text-muted">Set {i + 1}</p>
            <div className="flex items-center justify-center gap-3">
              <ScoreInput value={s.p1} onChange={(v) => setScore(i, 'p1', v)} />
              <span className="select-none text-2xl font-black leading-none text-edge-shadow">–</span>
              <ScoreInput value={s.p2} onChange={(v) => setScore(i, 'p2', v)} />
            </div>
          </div>
        ))}

        {canAddSet && (
          <button
            onClick={() => setSets((prev) => [...prev, { p1: '', p2: '' }])}
            className="block cursor-pointer border-none bg-transparent py-2.5 text-sm font-extrabold text-muted"
          >
            + Add set
          </button>
        )}

        {previewText && (
          <div
            className="mt-4 rounded-2xl border-2 border-green-mid bg-green-light px-5 py-4 text-center"
            style={{ borderBottomWidth: 4, borderBottomColor: 'var(--color-green-shadow)', animation: 'popin 0.3s ease' }}
          >
            <p className="mb-0.5 text-[11px] font-extrabold uppercase tracking-wide text-green-dark">Live result</p>
            <p className="text-xl font-black text-ink">{previewText}</p>
          </div>
        )}

        {error && <p className="mt-4 text-center text-sm font-bold text-loss-dark">{error}</p>}
      </div>

      <div>
        <div className="px-5 pb-2.5 pt-3.5">
          <PrimaryButton onClick={submit} disabled={!valid || submitting}>
            {submitting ? 'Logging…' : 'Log match'}
          </PrimaryButton>
        </div>
        <BottomNav />
      </div>

      {/* Player picker sheet */}
      {sheetFor && (
        <>
          <div
            className="fixed inset-0 z-40 mx-auto max-w-[375px] bg-ink/50"
            style={{ animation: 'fadein 0.15s ease' }}
            onClick={() => setSheetFor(null)}
          />
          <div
            className="fixed bottom-0 left-1/2 z-50 w-[375px] -translate-x-1/2 rounded-t-3xl border-t-2 border-edge bg-surface pb-8"
            style={{ animation: 'sheetup 0.22s cubic-bezier(0.32,0.72,0,1)' }}
          >
            <div className="mx-auto mb-4 mt-3.5 h-[5px] w-10 rounded-full bg-edge" />
            <p className="border-b-2 border-[#F0F0F0] px-5 pb-3.5 text-lg font-black text-ink">Pick a player</p>
            <div className="max-h-[50vh] overflow-y-auto">
              {pickable(sheetFor).map((p) => {
                const st = statsById.get(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (sheetFor === 1) setP1(p);
                      else setP2(p);
                      setSheetFor(null);
                    }}
                    className="flex w-full items-center gap-3.5 border-b-2 border-[#F5F5F5] px-5 py-3.5 text-left"
                  >
                    <AvatarCircle name={p.display_name} color={p.avatar_color} size={44} />
                    <div className="flex-1">
                      <div className="text-base font-extrabold text-ink">{p.display_name}</div>
                      <div className="mt-0.5 text-xs font-bold tabular-nums text-muted">
                        {st ? `${st.elo} ELO · ${st.wins}W ${st.losses}L` : 'New player'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Confirmation overlay */}
      {result && (
        <ConfirmationOverlay
          result={result}
          onClose={() =>
            navigate('/', {
              state: {
                winnerId: result.winner.id,
                loserId: result.loser.id,
                loggedMatchId: result.res.match_id,
              },
            })
          }
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

/** Locked slot showing the signed-in player — you're always in the match. */
function YouSlot({ player }: { player: Player | null }) {
  return (
    <div
      className="flex w-full items-center gap-3 rounded-2xl border-2 border-edge bg-surface px-4 py-3.5"
      style={{ borderBottomWidth: 3, borderBottomColor: 'var(--color-edge-shadow)' }}
    >
      {player ? (
        <AvatarCircle name={player.display_name} color={player.avatar_color} size={44} />
      ) : (
        <div className="h-11 w-11 flex-shrink-0 rounded-full border-2 border-dashed border-edge-shadow" />
      )}
      <span className="flex-1 text-base font-extrabold text-ink">{player?.display_name ?? 'You'}</span>
      <span className="rounded-full bg-green-light px-2.5 py-1 text-[11px] font-extrabold text-green-dark">You</span>
    </div>
  );
}

function PlayerSlot({ player, onClick }: { player: Player | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-edge bg-surface px-4 py-3.5 text-left"
      style={{ borderBottomWidth: 3, borderBottomColor: 'var(--color-edge-shadow)' }}
    >
      {player ? (
        <AvatarCircle name={player.display_name} color={player.avatar_color} size={44} />
      ) : (
        <div className="h-11 w-11 flex-shrink-0 rounded-full border-2 border-dashed border-edge-shadow" />
      )}
      <span className="flex-1 text-base font-extrabold" style={{ color: player ? 'var(--color-ink)' : 'var(--color-muted)' }}>
        {player?.display_name ?? 'Pick a player'}
      </span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-edge-shadow">
        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function ScoreInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      className="h-20 w-[84px] rounded-2xl border-2 border-edge bg-surface text-center text-[42px] font-black tabular-nums text-ink"
      style={{ borderBottomWidth: 4, borderBottomColor: 'var(--color-edge-shadow)' }}
    />
  );
}

function ConfirmationOverlay({ result, onClose }: { result: Result; onClose: () => void }) {
  const { winner, loser, scores, res } = result;
  return (
    <div
      className="fixed inset-0 z-[100] mx-auto flex max-w-[375px] flex-col overflow-y-auto bg-canvas px-6 pb-10 pt-12"
      style={{ animation: 'fadein 0.2s ease' }}
    >
      <div
        className="mb-6 flex h-[60px] w-[60px] items-center justify-center rounded-full border-[3px] border-green-mid bg-green-light"
        style={{ animation: 'popin 0.4s ease' }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M4 12l5.5 5.5L20 6" stroke="var(--color-green-dark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-muted">Match result</p>
      <h2 className="mb-1.5 text-[30px] font-black leading-tight tracking-tight text-ink">
        {winner.display_name} def. {loser.display_name}
      </h2>
      <p className="mb-9 text-[15px] font-bold tabular-nums text-muted">{scoreString(scores)}</p>

      <div className="mb-auto flex gap-3">
        <DeltaCard player={winner} delta={res.winner_delta} eloAfter={res.winner_elo_after} positive />
        <DeltaCard player={loser} delta={res.loser_delta} eloAfter={res.loser_elo_after} positive={false} />
      </div>

      <div className="mt-7">
        <PrimaryButton onClick={onClose}>Back to leaderboard</PrimaryButton>
      </div>
    </div>
  );
}

function DeltaCard({
  player,
  delta,
  eloAfter,
  positive,
}: {
  player: Player;
  delta: number;
  eloAfter: number;
  positive: boolean;
}) {
  return (
    <div
      className="flex-1 rounded-[20px] border-2 border-edge bg-surface px-3 py-[22px] text-center"
      style={{ borderBottomWidth: 4, borderBottomColor: 'var(--color-edge-shadow)' }}
    >
      <div
        className="mx-auto mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-full text-xl font-black text-white"
        style={{ background: player.avatar_color, boxShadow: `0 3px 0 ${shadowFor(player.avatar_color)}` }}
      >
        {player.display_name.charAt(0).toUpperCase()}
      </div>
      <p className="mb-2 text-sm font-extrabold text-ink">{player.display_name}</p>
      <p
        className="text-[42px] font-black leading-none tabular-nums tracking-tight"
        style={{ color: positive ? 'var(--color-green)' : 'var(--color-loss)' }}
      >
        {signedDelta(delta)}
      </p>
      <p className="mt-1 text-xs font-bold tabular-nums text-muted">→ {eloAfter}</p>
    </div>
  );
}
