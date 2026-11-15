import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError, tokenStore } from "./api";
import { queryClient } from "./query";
import {
  cacheUser,
  clearCachedUser,
  clearUserScopedState,
  readCachedUser,
} from "./persistence/storage";
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

function hasSession() {
  return Boolean(tokenStore.access() || tokenStore.refresh());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedUser = hasSession() ? readCachedUser() : null;
  const [user, setUser] = useState<User | null>(cachedUser);
  const [initializing, setInitializing] = useState(() => hasSession() && !cachedUser);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    clearUserScopedState();
    queryClient.clear();
    setUser(null);
  }, []);

  const applyUser = useCallback((next: User | null) => {
    if (next) cacheUser(next);
    else clearCachedUser();
    setUser(next);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!hasSession()) {
      clearCachedUser();
      setUser(null);
      return;
    }
    try {
      const me = await api.get<User>("/auth/me/");
      applyUser(me);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        clearSession();
      }
    }
  }, [applyUser, clearSession]);

  useEffect(() => {
    refreshUser().finally(() => setInitializing(false));
  }, [refreshUser]);

  useEffect(() => {
    const handle = () => clearSession();
    window.addEventListener("nattyrex:session-expired", handle);
    return () => window.removeEventListener("nattyrex:session-expired", handle);
  }, [clearSession]);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await api.anonymousPost<AuthResponse>("/auth/login/", { identifier, password });
    tokenStore.set(data.access, data.refresh);
    queryClient.clear();
    applyUser(data.user);
    return data.user;
  }, [applyUser]);

  const acceptInvitation = useCallback(async (token: string, password: string, email?: string) => {
    const data = await api.anonymousPost<AuthResponse>("/auth/invitations/accept/", {
      token,
      password,
      ...(email ? { email } : {}),
    });
    tokenStore.set(data.access, data.refresh);
    queryClient.clear();
    applyUser(data.user);
    return data.user;
  }, [applyUser]);

  const logout = useCallback(async () => {
    const refresh = tokenStore.refresh();
    try {
      if (refresh) await api.post("/auth/logout/", { refresh });
    } catch {
      // Local sign-out must still succeed if the network is unavailable.
    }
    clearSession();
  }, [clearSession]);

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
