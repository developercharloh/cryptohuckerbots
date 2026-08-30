import { useEffect, lazy, Suspense, Component, ReactNode } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: Error) {
    return { error: err?.message ?? "Unknown error" };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6 gap-4">
          <p className="text-destructive font-semibold text-center">Something went wrong</p>
          <p className="text-xs text-muted-foreground text-center break-all">{this.state.error}</p>
          <button className="mt-2 px-4 py-2 rounded-lg bg-primary text-white text-sm" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";

// Keep the entry chunk small. Pages load only when their route is visited so
// login does not download charts, cashier forms, support, and bot analytics.
const Landing = lazy(() => import("@/pages/Landing"));
const Splash = lazy(() => import("@/pages/Splash"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const About = lazy(() => import("@/pages/legal/About"));
const Terms = lazy(() => import("@/pages/legal/Terms"));
const Privacy = lazy(() => import("@/pages/legal/Privacy"));
const Risk = lazy(() => import("@/pages/legal/Risk"));
const Contact = lazy(() => import("@/pages/legal/Contact"));
const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Bots = lazy(() => import("@/pages/bots/Bots"));
const BotDetail = lazy(() => import("@/pages/bots/BotDetail"));
const BotAnalytics = lazy(() => import("@/pages/bots/BotAnalytics"));
const StartBot = lazy(() => import("@/pages/bots/StartBot"));
const Cashier = lazy(() => import("@/pages/cashier/Cashier"));
const Deposit = lazy(() => import("@/pages/cashier/Deposit"));
const DepositStatus = lazy(() => import("@/pages/cashier/DepositStatus"));
const Withdraw = lazy(() => import("@/pages/cashier/Withdraw"));
const Transactions = lazy(() => import("@/pages/cashier/Transactions"));
const PaymentMethods = lazy(() => import("@/pages/cashier/PaymentMethods"));
const Markets = lazy(() => import("@/pages/Markets"));
const News = lazy(() => import("@/pages/News"));
const TradePairPage = lazy(() => import("@/pages/TradePairPage"));
const Trade = lazy(() => import("@/pages/Trade"));
const VipPackages = lazy(() => import("@/pages/VipPackages"));
const Orders = lazy(() => import("@/pages/Orders"));
const Profile = lazy(() => import("@/pages/profile/Profile"));
const PersonalInfo = lazy(() => import("@/pages/profile/PersonalInfo"));
const Security = lazy(() => import("@/pages/profile/Security"));
const KYC = lazy(() => import("@/pages/profile/KYC"));
const Notifications = lazy(() => import("@/pages/profile/Notifications"));
const Support = lazy(() => import("@/pages/support/Support"));
const SupportTicket = lazy(() => import("@/pages/support/SupportTicket"));
const LiveChat = lazy(() => import("@/pages/support/LiveChat"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      retryDelay: 500,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background text-muted-foreground">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-label="Loading page" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/splash" component={Splash} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/about" component={About} />
      <Route path="/legal/terms" component={Terms} />
      <Route path="/legal/privacy" component={Privacy} />
      <Route path="/legal/risk" component={Risk} />
      <Route path="/contact" component={Contact} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      
      {/* Authenticated Routes */}
      <Route path="/dashboard">
        <AuthGuard><Dashboard /></AuthGuard>
      </Route>
      <Route path="/bots">
        <AuthGuard><Bots /></AuthGuard>
      </Route>
      <Route path="/start-bot">
        <AuthGuard><StartBot /></AuthGuard>
      </Route>
      <Route path="/bots/:id/analytics">
        <AuthGuard><BotAnalytics /></AuthGuard>
      </Route>
      <Route path="/bots/:id">
        <AuthGuard><BotDetail /></AuthGuard>
      </Route>
      <Route path="/cashier">
        <AuthGuard><Cashier /></AuthGuard>
      </Route>
      <Route path="/cashier/deposit">
        <AuthGuard><Deposit /></AuthGuard>
      </Route>
      <Route path="/cashier/deposit/:id">
        <AuthGuard><DepositStatus /></AuthGuard>
      </Route>
      <Route path="/cashier/withdraw">
        <AuthGuard><Withdraw /></AuthGuard>
      </Route>
      <Route path="/cashier/transactions">
        <AuthGuard><Transactions /></AuthGuard>
      </Route>
      <Route path="/cashier/payment-methods">
        <AuthGuard><PaymentMethods /></AuthGuard>
      </Route>
      <Route path="/markets">
        <AuthGuard><Markets /></AuthGuard>
      </Route>
      <Route path="/news">
        <News />
      </Route>
      <Route path="/trade">
        <AuthGuard><Trade /></AuthGuard>
      </Route>
      <Route path="/vip-packages">
        <AuthGuard><VipPackages /></AuthGuard>
      </Route>
      <Route path="/trade/:symbol">
        <AuthGuard><TradePairPage /></AuthGuard>
      </Route>
      <Route path="/orders">
        <AuthGuard><Orders /></AuthGuard>
      </Route>
      <Route path="/profile">
        <AuthGuard><Profile /></AuthGuard>
      </Route>
      <Route path="/profile/personal-info">
        <AuthGuard><PersonalInfo /></AuthGuard>
      </Route>
      <Route path="/profile/security">
        <AuthGuard><Security /></AuthGuard>
      </Route>
      <Route path="/profile/kyc">
        <AuthGuard><KYC /></AuthGuard>
      </Route>
      <Route path="/profile/notifications">
        <AuthGuard><Notifications /></AuthGuard>
      </Route>
      <Route path="/support">
        <AuthGuard><Support /></AuthGuard>
      </Route>
      <Route path="/support/ticket">
        <AuthGuard><SupportTicket /></AuthGuard>
      </Route>
      <Route path="/support/chat">
        <AuthGuard><LiveChat /></AuthGuard>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    const saved = localStorage.getItem("vixus_theme") ?? "dark";
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
            <ErrorBoundary>
              <Suspense fallback={<RouteLoading />}>
                <div className="user-app-shell w-full max-w-[1440px] mx-auto min-h-screen bg-background relative overflow-x-hidden shadow-2xl">
                  <Router />
                </div>
              </Suspense>
            </ErrorBoundary>
            </AuthProvider>
          </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
