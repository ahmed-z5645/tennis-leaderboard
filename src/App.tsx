/**
 * Phase 1 placeholder — confirms Tailwind tokens + Nunito font render.
 * Replaced with the router in Phase 4.
 */
export default function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[375px] flex-col items-center justify-center gap-4 bg-canvas px-7">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-green shadow-[0_5px_0_var(--color-green-dark)]">
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
          <circle cx="21" cy="21" r="16" stroke="white" strokeWidth="2.5" />
          <path d="M9 21c3-6.5 7-10 12-10s9 3.5 12 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M9 21c3 6.5 7 10 12 10s9-3.5 12-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="9" y1="21" x2="33" y2="21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-[40px] font-black tracking-tight text-ink">ACES</h1>
      <p className="font-bold text-muted">Track every win.</p>
    </div>
  )
}
