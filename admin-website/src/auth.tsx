import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, clearTokens, getToken, setTokens, type AdminUser } from './api';

interface AuthState {
  admin: AdminUser | null;
  ready: boolean;
  /** null = unknown yet; true = a super admin already exists; false = first-use setup needed */
  hasSuperAdmin: boolean | null;
  login: (email: string, password: string) => Promise<void>;
  setup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function decodeRole(token: string): AdminUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload && (payload.email || payload.sub)) {
      return {
        id: String(payload.sub ?? payload.id ?? ''),
        name: String(payload.name ?? payload.email ?? 'Admin'),
        email: String(payload.email ?? ''),
        role: payload.role === 'admin' ? 'admin' : 'super_admin',
      };
    }
  } catch { /* not a decodable JWT — fall through */ }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);
  const [hasSuperAdmin, setHasSuperAdmin] = useState<boolean | null>(null);

  // On load: if a token is stored, treat the session as alive (the backend
  // is the source of truth — any call with a bad token gets a 401 and the
  // UI falls back to the login screen). Probe setup state via a setup call
  // only when there is no token: a 403 from setup means a super admin exists.
  useEffect(() => {
    const token = getToken();
    if (token) {
      setAdmin(decodeRole(token) ?? { id: '', name: 'Admin', email: '', role: 'super_admin' });
      setHasSuperAdmin(true);
      setReady(true);
      return;
    }
    // No token: check whether first-use setup is still open by asking the
    // backend indirectly — GET /api/admin/stats without auth returns 401
    // when an admin exists, 404/401 either way; the reliable signal is the
    // setup endpoint itself, which we do NOT call speculatively (it would
    // create nothing without a body, but a POST with empty body is still a
    // write-shaped probe). Instead default to "login" and let the login
    // screen offer setup when the backend says no admin exists.
    setHasSuperAdmin(null);
    setReady(true);
  }, []);

  const value = useMemo<AuthState>(() => ({
    admin,
    ready,
    hasSuperAdmin,
    async login(email, password) {
      const res = await api.login({ email, password });
      setTokens(res.accessToken, res.refreshToken ?? null);
      setAdmin(res.admin);
      setHasSuperAdmin(true);
    },
    async setup(name, email, password) {
      const res = await api.setup({ name, email, password });
      if (res.accessToken) setTokens(res.accessToken, res.refreshToken ?? null);
      setAdmin(res.admin);
      setHasSuperAdmin(true);
    },
    logout() {
      clearTokens();
      setAdmin(null);
    },
  }), [admin, ready, hasSuperAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
