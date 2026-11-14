import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getAccessToken, getCachedUser, clearTokens } from '../api/client';
import type { User } from '../api/types';

interface AuthState { user: User | null; loading: boolean; signIn: (u: User) => void; signOut: () => Promise<void>; refreshUser: () => Promise<void>; }
const Ctx = createContext<AuthState>({ user: null, loading: true, signIn: () => {}, signOut: async () => {}, refreshUser: async () => {} });
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    const token = await getAccessToken();
    if (!token) { setLoading(false); return; }
    const cached = await getCachedUser(); if (cached) setUser(cached);
    try { const me = await api.me(); setUser(me); } catch { await clearTokens(); setUser(null); }
    setLoading(false);
  })(); }, []);
  const signIn = useCallback((u: User) => setUser(u), []);
  const signOut = useCallback(async () => { await api.logout(); setUser(null); }, []);
  const refreshUser = useCallback(async () => { try { setUser(await api.me()); } catch {} }, []);
  return <Ctx.Provider value={{ user, loading, signIn, signOut, refreshUser }}>{children}</Ctx.Provider>;
}
