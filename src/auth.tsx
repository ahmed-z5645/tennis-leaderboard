import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { Player } from './types';

interface AuthState {
  session: Session | null;
  player: Player | null;
  /** True while the initial session is being resolved. */
  loading: boolean;
  /** True while the player row for the current session is being fetched. */
  playerLoading: boolean;
  refreshPlayer: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerLoading, setPlayerLoading] = useState(false);

  async function loadPlayer(current: Session | null) {
    if (!current) {
      setPlayer(null);
      return;
    }
    setPlayerLoading(true);
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', current.user.id)
      .maybeSingle();
    setPlayer((data as Player) ?? null);
    setPlayerLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadPlayer(data.session).finally(() => setLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Defer Supabase calls out of the callback to avoid client deadlocks.
      setTimeout(() => loadPlayer(next), 0);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    player,
    loading,
    playerLoading,
    refreshPlayer: () => loadPlayer(session),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
