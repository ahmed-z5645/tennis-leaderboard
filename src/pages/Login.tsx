import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import PrimaryButton from '../components/PrimaryButton';
import { DEFAULT_AVATAR_COLOR } from '../lib/theme';

type Mode = 'signin' | 'signup';

export default function Login() {
  const { refreshPlayer } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit =
    emailValid &&
    password.length >= 6 &&
    (mode === 'signin' || username.trim().length >= 2);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      setLoading(false);
      return;
    }

    // Sign up
    const trimmedUsername = username.trim();

    // Check username uniqueness
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .ilike('display_name', trimmedUsername)
      .maybeSingle();
    if (existing) {
      setError('That username is taken — pick another.');
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: trimmedUsername } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      // Email confirmation disabled — create the player profile immediately.
      const { error: insertError } = await supabase.from('players').insert({
        user_id: data.session.user.id,
        display_name: trimmedUsername,
        avatar_color: DEFAULT_AVATAR_COLOR,
      });
      if (insertError) {
        setError(insertError.code === '23505' ? 'That username is taken — pick another.' : insertError.message);
        setLoading(false);
        return;
      }
      await refreshPlayer();
    } else {
      // Email confirmation required — user will complete profile in onboarding after confirming.
      setConfirmed(true);
    }

    setLoading(false);
  }

  if (confirmed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-7">
        <div
          className="w-full rounded-2xl border-2 border-green-mid bg-green-light px-5 py-6 text-center"
          style={{ borderBottomWidth: 4, borderBottomColor: 'var(--color-green-shadow)' }}
        >
          <p className="mb-1 text-lg font-black text-ink">Check your email</p>
          <p className="text-sm font-bold text-green-dark">
            We sent a confirmation link to {email}. Click it to activate your account, then sign in.
          </p>
        </div>
        <button
          className="mt-5 text-sm font-bold text-muted"
          onClick={() => { setConfirmed(false); setMode('signin'); }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas px-7">
      <div className="flex flex-1 flex-col items-center justify-center pb-6">
        <div
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-green"
          style={{ boxShadow: '0 5px 0 var(--color-green-dark)' }}
        >
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
            <circle cx="21" cy="21" r="16" stroke="white" strokeWidth="2.5" />
            <path d="M9 21c3-6.5 7-10 12-10s9 3.5 12 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M9 21c3 6.5 7 10 12 10s9-3.5 12-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="9" y1="21" x2="33" y2="21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="mb-2.5 text-[40px] font-black leading-none tracking-tight text-ink">ACES</h1>
        <p className="text-base font-bold text-muted">Track every win.</p>
      </div>

      <div className="pb-[52px]">
        {/* Tab toggle */}
        <div
          className="mb-6 flex rounded-2xl border-2 border-edge bg-surface p-1"
          style={{ borderBottomWidth: 4, borderBottomColor: 'var(--color-edge-shadow)' }}
        >
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="flex-1 rounded-xl py-2.5 text-sm font-extrabold transition-colors"
              style={
                mode === m
                  ? { background: 'var(--color-green)', color: 'white' }
                  : { color: 'var(--color-muted)' }
              }
            >
              {m === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-2xl border-2 border-edge bg-surface p-[17px] text-base font-bold text-ink"
            style={{ borderBottomWidth: 4, borderBottomColor: 'var(--color-edge-shadow)' }}
          />

          {mode === 'signup' && (
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              maxLength={20}
              className="w-full rounded-2xl border-2 border-edge bg-surface p-[17px] text-base font-bold text-ink"
              style={{ borderBottomWidth: 4, borderBottomColor: 'var(--color-edge-shadow)' }}
            />
          )}

          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="password (min 6 chars)"
            className="w-full rounded-2xl border-2 border-edge bg-surface p-[17px] text-base font-bold text-ink"
            style={{ borderBottomWidth: 4, borderBottomColor: 'var(--color-edge-shadow)' }}
          />
        </div>

        {error && <p className="mb-2 mt-4 text-center text-sm font-bold text-loss-dark">{error}</p>}

        <PrimaryButton onClick={submit} disabled={!canSubmit || loading} style={{ marginTop: 18 }}>
          {loading ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign in' : 'Create account')}
        </PrimaryButton>
      </div>
    </div>
  );
}
