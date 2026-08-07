import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from './api';
import type { State, Dashboard } from './types';

interface Ctx {
  user: State | null;
  dashboard: Dashboard | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  refreshDash: () => Promise<void>;
  toast: (msg: string, kind?: 'good' | 'bad') => void;
  mutate: (patch: any) => Promise<State>;
}

const Store = createContext<Ctx>(null as any);
export const useStore = () => useContext(Store);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<State | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);

  const toast = useCallback((msg: string, kind: 'good' | 'bad' = 'good') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      const s = await api.state();
      setUser(s);
    } catch {
      /* server down — keep last state */
    }
  }, []);

  const refreshDash = useCallback(async () => {
    if (!getToken()) return;
    try {
      setDashboard(await api.dashboard());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const s = await api.state();
          setUser(s);
          try { setDashboard(await api.dashboard()); } catch {}
        } catch {
          setToken('');
        }
      }
      setLoading(false);
    })();
    const iv = setInterval(refreshDash, 8000);
    return () => clearInterval(iv);
  }, [refreshDash]);

  const login = async (email: string, password: string) => {
    const { token } = await api.login(email, password);
    setToken(token);
    await refresh();
    await refreshDash();
  };
  const register = async (name: string, email: string, password: string) => {
    const { token } = await api.register(name, email, password);
    setToken(token);
    await refresh();
    await refreshDash();
  };
  const logout = () => {
    setToken('');
    setUser(null);
    setDashboard(null);
  };

  const mutate = async (patch: Partial<State>) => {
    const s = await api.updateState(patch);
    setUser(s);
    return s;
  };

  return (
    <Store.Provider value={{ user, dashboard, loading, login, register, logout, refresh, refreshDash, toast, mutate }}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>
        ))}
      </div>
    </Store.Provider>
  );
}
