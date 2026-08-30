import { useState, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { setBaseUrl, setAuthTokenGetter, ApiError } from "@workspace/api-client-react";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Layout from "@/components/Layout";
import { useLoginAlarm } from "@/hooks/useLoginAlarm";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { API_BASE } from "@/lib/api-base";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Users from "@/pages/Users";
import UserDetail from "@/pages/UserDetail";
import Bots from "@/pages/Bots";
import Finance from "@/pages/Finance";
import Support from "@/pages/Support";
import Settings from "@/pages/Settings";
import Broadcast from "@/pages/Broadcast";
import NotFound from "@/pages/not-found";

setBaseUrl(API_BASE || null);

// Admin authentication is carried by an HttpOnly cookie.
setAuthTokenGetter(null);

// Global logout callback — set by App once it mounts.
let _forceLogout: (() => void) | null = null;

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        setAuthTokenGetter(null);
        queryClient.clear();
        _forceLogout?.();
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Never retry auth errors — they won't resolve without a new token.
        if (error instanceof ApiError && error.status === 401) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
    },
  },
});

function Router({ onLogout, adminSession }: { onLogout: () => void; adminSession: boolean }) {
  useLoginAlarm();
  usePushSubscription(adminSession);
  return (
    <Layout onLogout={onLogout}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/users" component={Users} />
        <Route path="/users/:id" component={UserDetail} />
        <Route path="/bots" component={Bots} />
        <Route path="/finance" component={Finance} />
        <Route path="/support" component={Support} />
        <Route path="/settings" component={Settings} />
        <Route path="/broadcast" component={Broadcast} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const [authed, setAuthed] = useState(false);
  const [adminSession, setAdminSession] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const authCheckVersion = useRef(0);

  useEffect(() => {
    _forceLogout = () => { setAuthed(false); setAdminSession(false); };
    return () => { _forceLogout = null; };
  }, []);

  useEffect(() => {
    const requestVersion = ++authCheckVersion.current;
    let active = true;
    fetch(`${API_BASE}/api/admin/session`, { credentials: "include" })
      .then((response) => {
        if (!active || requestVersion !== authCheckVersion.current) return;
        setAuthed(response.ok);
        setAdminSession(response.ok);
        setAuthChecked(true);
      })
      .catch(() => {
        if (!active || requestVersion !== authCheckVersion.current) return;
        setAuthed(false);
        setAdminSession(false);
        setAuthChecked(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("vixus_theme") ?? "dark";
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const handleLogin = () => {
    // Ignore the unauthenticated startup probe if it resolves after login.
    authCheckVersion.current += 1;
    setAuthTokenGetter(null);
    setAdminSession(true);
    setAuthed(true);
    setAuthChecked(true);
  };

  const handleLogout = () => {
    authCheckVersion.current += 1;
    void fetch(`${API_BASE}/api/admin/logout`, {
      method: "POST",
      credentials: "include",
    });
    setAuthTokenGetter(() => null);
    queryClient.clear();
    setAdminSession(false);
    setAuthed(false);
  };

  if (!authChecked) {
    return <div className="min-h-screen bg-[#08061a]" />;
  }

  if (!authed) {
    return (
      <QueryClientProvider client={queryClient}>
        <Login onLogin={handleLogin} />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router onLogout={handleLogout} adminSession={adminSession} />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
