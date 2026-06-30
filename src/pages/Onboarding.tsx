import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { AVATAR_COLORS, DEFAULT_AVATAR_COLOR, initialOf, shadowFor } from '../lib/theme';
import PrimaryButton from '../components/PrimaryButton';

export default function Onboarding() {
  const { session, refreshPlayer } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(session?.user.user_metadata?.username ?? '');
  const [avatarColor, setAvatarColor] = useState(DEFAULT_AVATAR_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = displayName.trim();
  const valid = trimmed.length >= 2;

  async function join() {
    if (!valid || saving || !session) return;
    setSaving(true);
    setError(null);

    // Pre-check uniqueness for a friendly message (the column is also unique in the DB).
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .ilike('display_name', trimmed)
      .maybeSingle();
    if (existing) {
      setError('That name is taken — pick another.');
      setSaving(false);
      return;
    }

    const { error: insertErr } = await supabase.from('players').insert({
      user_id: session.user.id,
      display_name: trimmed,
      avatar_color: avatarColor,
    });
    if (insertErr) {
      setError(insertErr.code === '23505' ? 'That name is taken — pick another.' : insertErr.message);
      setSaving(false);
      return;
    }

    await refreshPlayer();
    navigate('/', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas px-7">
      <div className="pb-8 pt-14">
        <div
          className="mb-4 inline-block rounded-full border-2 border-green-mid bg-green-light px-3.5 py-1.5"
        >
          <span className="text-[13px] font-extrabold text-green-dark">You're in!</span>
        </div>
        <h1 className="text-[30px] font-black leading-tight text-ink">
          Set up your
          <br />
          profile.
        </h1>
      </div>

      <div className="mb-7 flex justify-center">
        <div
          className="flex h-22 w-22 items-center justify-center rounded-full font-black text-white"
          style={{
            width: 88,
            height: 88,
            background: avatarColor,
            fontSize: 36,
            boxShadow: `0 5px 0 ${shadowFor(avatarColor)}`,
          }}
        >
          {initialOf(displayName)}
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-muted">Display name</p>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Ahmed"
          maxLength={20}
          className="w-full rounded-2xl border-2 border-edge bg-surface p-4 text-[17px] font-extrabold text-ink"
          style={{ borderBottomWidth: 4, borderBottomColor: 'var(--color-edge-shadow)' }}
        />
      </div>

      <div className="mb-9">
        <p className="mb-3.5 text-xs font-extrabold uppercase tracking-wide text-muted">Pick a color</p>
        <div className="flex flex-wrap gap-2.5">
          {AVATAR_COLORS.map(({ color }) => {
            const selected = color === avatarColor;
            return (
              <button
                key={color}
                onClick={() => setAvatarColor(color)}
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{
                  background: color,
                  boxShadow: `0 3px 0 ${shadowFor(color)}`,
                  border: selected ? '3px solid var(--color-ink)' : '3px solid transparent',
                }}
                aria-label={`Pick ${color}`}
              >
                {selected && (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3 9l5 5 7-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mb-3 text-center text-sm font-bold text-loss-dark">{error}</p>}

      <PrimaryButton onClick={join} disabled={!valid || saving} style={{ marginBottom: 32 }}>
        {saving ? 'Setting up…' : "Let's play"}
      </PrimaryButton>
    </div>
  );
}
