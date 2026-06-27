/** Full-screen loading state shown while auth/player data resolves. */
export default function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-3xl bg-green"
        style={{ boxShadow: '0 5px 0 var(--color-green-dark)', animation: 'popin 0.4s ease' }}
      >
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
          <circle cx="21" cy="21" r="16" stroke="white" strokeWidth="2.5" />
          <path d="M9 21c3-6.5 7-10 12-10s9 3.5 12 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M9 21c3 6.5 7 10 12 10s9-3.5 12-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="9" y1="21" x2="33" y2="21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="font-extrabold text-muted">Loading…</p>
    </div>
  );
}
