import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { setBaseUrl, setAuthTokenGetter, ApiError } from "@workspace/api-client-react";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Layout from "@/components/Layout";
import { useLoginAlarm } from "@/hooks/useLoginAlarm";
import { usePushSubscription } from "@/hooks/usePushSubscription";
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

setBaseUrl(
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://vixus.ai"
    : null
);

// Set token getter at module load so React Query has auth on the very first request.
setAuthTokenGetter(() => localStorage.getItem("vixus_admin_token"));

// Global logout callback — set by App once it mounts.
let _forceLogout: (() => void) | null = null;

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        localStorage.removeItem("vixus_admin_token");
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

function Router({ onLogout, adminToken }: { onLogout: () => void; adminToken: string | null }) {
  useLoginAlarm();
  usePushSubscription(adminToken);
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
  const [authed, setAuthed] = useState(() => !!localStorage.getItem("vixus_admin_token"));
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem("vixus_admin_token"));

  useEffect(() => {
    _forceLogout = () => { setAuthed(false); setAdminToken(null); };
    return () => { _forceLogout = null; };
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
    setAuthTokenGetter(() => localStorage.getItem("vixus_admin_token"));
    setAdminToken(localStorage.getItem("vixus_admin_token"));
    setAuthed(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("vixus_admin_token");
    setAuthTokenGetter(() => null);
    setAdminToken(null);
    setAuthed(false);
  };

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
          <Router onLogout={handleLogout} adminToken={adminToken} />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
