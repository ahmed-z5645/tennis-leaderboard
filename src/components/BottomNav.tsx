import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const ACTIVE = 'var(--color-green)';
const INACTIVE = 'var(--color-muted)';

function RanksIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="1" y="10" width="4" height="9" rx="2" fill="currentColor" />
      <rect x="8" y="6" width="4" height="13" rx="2" fill="currentColor" />
      <rect x="15" y="2" width="4" height="17" rx="2" fill="currentColor" />
    </svg>
  );
}
function LogIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="2.2" />
      <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="2.2" />
      <path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function NavButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 cursor-pointer flex-col items-center gap-1 border-none bg-transparent px-0 pb-[18px] pt-3"
      style={{ color: active ? ACTIVE : INACTIVE }}
    >
      {icon}
      <span className="text-[11px] font-extrabold">{label}</span>
    </button>
  );
}

/** Sticky bottom tab bar shared by the leaderboard, log, and profile screens. */
export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { player } = useAuth();

  return (
    <div className="sticky bottom-0 flex border-t-2 border-edge bg-surface">
      <NavButton active={pathname === '/'} label="Ranks" icon={<RanksIcon />} onClick={() => navigate('/')} />
      <NavButton active={pathname === '/log'} label="Log" icon={<LogIcon />} onClick={() => navigate('/log')} />
      <NavButton
        active={pathname.startsWith('/player')}
        label="Profile"
        icon={<ProfileIcon />}
        onClick={() => player && navigate(`/player/${player.id}`)}
      />
    </div>
  );
}
