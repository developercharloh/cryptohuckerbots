import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

// Set synchronously at module load — before any component or TanStack Query
// fires a request — so the first fetch always carries the bearer token.
setAuthTokenGetter(() => localStorage.getItem("vixus_token"));

interface AuthContextType {
  user: User | null;
  token: string | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("vixus_token");
  });
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Set the token getter for api-client-react
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("vixus_token"));
  }, []);

  // If there's no token, we don't need to wait for any API call
  useEffect(() => {
    if (!token) {
      setIsInitializing(false);
    }
  }, [token]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: meData, isError } = useGetMe({ query: { enabled: !!token, retry: false } as any });

  useEffect(() => {
    if (!token) return;

    if (meData) {
      setUser(meData);
      setIsInitializing(false);
    } else if (isError) {
      setUser(null);
      localStorage.removeItem("vixus_token");
      setToken(null);
      setIsInitializing(false);
    }
  }, [meData, isError, token]);

  const setAuth = (newToken: string, newUser: User) => {
    localStorage.setItem("vixus_token", newToken);
    setAuthTokenGetter(() => localStorage.getItem("vixus_token"));
    setToken(newToken);
    setUser(newUser);
    setIsInitializing(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("vixus_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout: handleLogout, isLoading: isInitializing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
