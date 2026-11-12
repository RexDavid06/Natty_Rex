import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, tokenStore } from "./api";
import type { AuthResponse, User } from "./types";

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  acceptInvitation: (token: string, password: string, email?: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.access() && !tokenStore.refresh()) {
      setUser(null);
      return;
    }
    try {
      const me = await api.get<User>("/auth/me/");
      setUser(me);
    } catch {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setInitializing(false));
  }, [refreshUser]);

  useEffect(() => {
    const handle = () => {
      tokenStore.clear();
      setUser(null);
    };
    window.addEventListener("nattyrex:session-expired", handle);
    return () => window.removeEventListener("nattyrex:session-expired", handle);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await api.anonymousPost<AuthResponse>("/auth/login/", { identifier, password });
    tokenStore.set(data.access, data.refresh);
    setUser(data.user);
    return data.user;
  }, []);

  const acceptInvitation = useCallback(async (token: string, password: string, email?: string) => {
    const data = await api.anonymousPost<AuthResponse>("/auth/invitations/accept/", {
      token,
      password,
      ...(email ? { email } : {}),
    });
    tokenStore.set(data.access, data.refresh);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStore.refresh();
    try {
      if (refresh) await api.post("/auth/logout/", { refresh });
    } catch {
      // Local sign-out must still succeed if the network is unavailable.
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, acceptInvitation, logout, refreshUser }),
    [user, initializing, login, acceptInvitation, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
