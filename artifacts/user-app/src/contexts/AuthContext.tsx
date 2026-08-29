import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

// Web sessions are carried by an HttpOnly cookie. Never expose the session
// token to JavaScript or configure the shared client to add a bearer header.
setAuthTokenGetter(null);

interface AuthContextType {
  user: User | null;
  token: string | null;
  setAuth: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // This is only an in-memory authentication marker, not the session token.
  // The initial /auth/me request validates the HttpOnly cookie.
  const [token, setToken] = useState<string | null>("cookie-session");
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const sessionWasValidated = useRef(false);

  useEffect(() => {
    setAuthTokenGetter(null);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: meData, isError } = useGetMe({ query: { enabled: !!token, retry: false } as any });

  useEffect(() => {
    if (!token) return;

    if (meData) {
      sessionWasValidated.current = true;
      setUser(meData);
      setIsInitializing(false);
    } else if (isError && (sessionWasValidated.current || !user)) {
      setUser(null);
      setToken(null);
      setIsInitializing(false);
    }
  }, [meData, isError, token, user]);

  const setAuth = (newUser: User) => {
    setAuthTokenGetter(null);
    setToken("cookie-session");
    setUser(newUser);
    setIsInitializing(false);
  };

  const handleLogout = () => {
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
