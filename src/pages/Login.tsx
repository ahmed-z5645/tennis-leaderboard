import { useState } from 'react';
import { supabase } from '../supabaseClient';
import PrimaryButton from '../components/PrimaryButton';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function sendLink() {
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
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
        {sent ? (
          <div
            className="rounded-2xl border-2 border-green-mid bg-green-light px-5 py-6 text-center"
            style={{ borderBottomWidth: 4, borderBottomColor: 'var(--color-green-shadow)', animation: 'popin 0.3s ease' }}
          >
            <p className="mb-1 text-lg font-black text-ink">Check your email</p>
            <p className="text-sm font-bold text-green-dark">
              We sent a login link to {email}. Open it on this device to sign in.
            </p>
          </div>
        ) : (
          <>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendLink()}
              placeholder="your@email.com"
              className="mb-3 w-full rounded-2xl border-2 border-edge bg-surface p-[17px] text-base font-bold text-ink"
              style={{ borderBottomWidth: 4, borderBottomColor: 'var(--color-edge-shadow)' }}
            />
            <PrimaryButton onClick={sendLink} disabled={!valid || sending} style={{ marginBottom: 18 }}>
              {sending ? 'Sending…' : 'Send magic link'}
            </PrimaryButton>
            {error && <p className="mb-2 text-center text-sm font-bold text-loss-dark">{error}</p>}
            <p className="text-center text-[13px] font-bold leading-relaxed text-muted">
              We'll email you a link — no password needed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
