import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentUser, login as loginRequest, logout as logoutRequest, type LoginPayload } from "@/api/auth";
import { extractErrorMessage } from "@/api/client";
import type { User, UserRole } from "@/api/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setError(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    try {
      setLoading(true);
      const loggedUser = await loginRequest(payload);
      setUser(loggedUser);
      setError(null);
      return loggedUser;
    } catch (authError) {
      const message = extractErrorMessage(authError);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  }, []);

  const hasAnyRole = useCallback(
    (roles: UserRole[]) => {
      if (!user) {
        return false;
      }

      return roles.includes(user.role);
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      login,
      logout,
      refreshUser,
      hasAnyRole,
    }),
    [user, loading, error, login, logout, refreshUser, hasAnyRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
