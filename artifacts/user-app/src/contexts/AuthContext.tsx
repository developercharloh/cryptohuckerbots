import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useGetMe, setAuthTokenGetter, ApiError } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { API_BASE } from "@/lib/api-base";
import { useLocation } from "wouter";

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

function needsSessionValidation(pathname: string) {
  return ![
    "/",
    "/splash",
    "/onboarding",
    "/about",
    "/legal/terms",
    "/legal/privacy",
    "/legal/risk",
    "/contact",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/news",
  ].includes(pathname);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const shouldValidateSession = needsSessionValidation(location);
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
  const { data: meData, error: meError, isError } = useGetMe({
    query: {
      enabled: Boolean(token && shouldValidateSession),
      retry: (failureCount: number, error: unknown) => {
        // A missing/expired session is definitive. Network, server, and
        // transient proxy failures must not log a real user out.
        if (error instanceof ApiError && error.status === 401) return false;
        return failureCount < 2;
      },
    } as any,
  });

  useEffect(() => {
    if (!token || !shouldValidateSession) {
      setIsInitializing(false);
      return;
    }

    if (meData) {
      sessionWasValidated.current = true;
      setUser(meData);
      setIsInitializing(false);
    } else if (isError) {
      setIsInitializing(false);
      if (meError instanceof ApiError && meError.status === 401) {
        setUser(null);
        setToken(null);
      }
    } else {
      setIsInitializing(true);
    }
  }, [meData, meError, isError, token, user, shouldValidateSession]);

  const setAuth = (newUser: User) => {
    setAuthTokenGetter(null);
    setToken("cookie-session");
    setUser(newUser);
    setIsInitializing(false);
  };

  const handleLogout = () => {
    void fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {
      // Local state is still cleared if the server is temporarily unreachable.
    });
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
