/** Subtle pill toast pinned above the bottom nav. Visibility is parent-managed. */
export default function Toast({ message }: { message: string }) {
  return (
    <div
      className="fixed bottom-[88px] left-1/2 z-40 -translate-x-1/2 rounded-full border-2 border-green-mid bg-green-light px-4 py-2.5"
      style={{ borderBottomWidth: 3, borderBottomColor: 'var(--color-green-shadow)', animation: 'popin 0.3s ease' }}
    >
      <span className="whitespace-nowrap text-[13px] font-extrabold text-green-dark">{message}</span>
    </div>
  );
}
