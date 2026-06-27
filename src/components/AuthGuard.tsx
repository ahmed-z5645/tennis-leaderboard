import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import Splash from './Splash';

/**
 * Guards the main app routes: requires a session AND a player profile.
 * - no session → /login
 * - session but no profile → /onboarding
 */
export function RequirePlayer() {
  const { session, player, loading, playerLoading } = useAuth();
  if (loading || (session && playerLoading)) return <Splash />;
  if (!session) return <Navigate to="/login" replace />;
  if (!player) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/**
 * Guards the onboarding route: requires a session but NO profile yet.
 * - no session → /login
 * - profile already exists → /
 */
export function RequireOnboarding() {
  const { session, player, loading, playerLoading } = useAuth();
  if (loading || (session && playerLoading)) return <Splash />;
  if (!session) return <Navigate to="/login" replace />;
  if (player) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Login route: if already fully signed in, skip straight to the leaderboard. */
export function RedirectIfAuthed() {
  const { session, player, loading, playerLoading } = useAuth();
  if (loading || (session && playerLoading)) return <Splash />;
  if (session && player) return <Navigate to="/" replace />;
  if (session && !player) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
