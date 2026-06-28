"use client";

import * as React from "react";
import api, { clearTokens, getAccessToken, setTokens } from "@/lib/api";
import type {
  LoginCredentials,
  RegisterCredentials,
  TokenResponse,
  User,
} from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  updateUser: (payload: { username: string; email: string }) => Promise<User>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

// Best-effort: make sure the logged-in user has a mock wallet so the trading
// card works end-to-end. A 404 means none exists yet, so create one.
async function ensureWallet(): Promise<void> {
  try {
    await api.get("/wallet");
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 404) {
      try {
        await api.post("/wallet");
      } catch {
        // Non-fatal: trading card will surface its own error if needed.
      }
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadUser = React.useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<User>("/users/me");
      setUser(data);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = React.useCallback(async (credentials: LoginCredentials) => {
    const { data } = await api.post<TokenResponse>("/auth/login", credentials);
    setTokens(data.access_token, data.refresh_token);
    const { data: me } = await api.get<User>("/users/me");
    setUser(me);
    await ensureWallet();
  }, []);

  const register = React.useCallback(
    async (credentials: RegisterCredentials) => {
      await api.post("/auth/register", credentials);
      await login({
        username: credentials.username,
        password: credentials.password,
      });
    },
    [login]
  );

  const logout = React.useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const updateUser = React.useCallback(
    async (payload: { username: string; email: string }) => {
      const { data } = await api.put<User>("/users/update", payload);
      setUser(data);
      return data;
    },
    []
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      loading,
      login,
      register,
      updateUser,
      logout,
    }),
    [user, loading, login, register, updateUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
