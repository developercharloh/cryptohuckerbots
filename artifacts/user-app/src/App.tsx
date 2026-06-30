import { useEffect, Component, ReactNode } from "react";
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

// Pages
import Landing from "@/pages/Landing";
import Splash from "@/pages/Splash";
import Onboarding from "@/pages/Onboarding";
import About from "@/pages/legal/About";
import Terms from "@/pages/legal/Terms";
import Privacy from "@/pages/legal/Privacy";
import Risk from "@/pages/legal/Risk";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Bots from "@/pages/bots/Bots";
import BotDetail from "@/pages/bots/BotDetail";
import BotAnalytics from "@/pages/bots/BotAnalytics";
import StartBot from "@/pages/bots/StartBot";
import Cashier from "@/pages/cashier/Cashier";
import Deposit from "@/pages/cashier/Deposit";
import DepositStatus from "@/pages/cashier/DepositStatus";
import Withdraw from "@/pages/cashier/Withdraw";
import Transactions from "@/pages/cashier/Transactions";
import PaymentMethods from "@/pages/cashier/PaymentMethods";
import Markets from "@/pages/Markets";
import TradePairPage from "@/pages/TradePairPage";
import Trade from "@/pages/Trade";
import Orders from "@/pages/Orders";
import Rewards from "@/pages/Rewards";
import Profile from "@/pages/profile/Profile";
import PersonalInfo from "@/pages/profile/PersonalInfo";
import Security from "@/pages/profile/Security";
import KYC from "@/pages/profile/KYC";
import Notifications from "@/pages/profile/Notifications";
import Support from "@/pages/support/Support";
import SupportTicket from "@/pages/support/SupportTicket";
import LiveChat from "@/pages/support/LiveChat";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

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
      <Route path="/trade">
        <AuthGuard><Trade /></AuthGuard>
      </Route>
      <Route path="/trade/:symbol">
        <AuthGuard><TradePairPage /></AuthGuard>
      </Route>
      <Route path="/orders">
        <AuthGuard><Orders /></AuthGuard>
      </Route>
      <Route path="/rewards">
        <AuthGuard><Rewards /></AuthGuard>
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
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ErrorBoundary>
              <div className="max-w-[430px] mx-auto min-h-screen bg-background relative overflow-x-hidden shadow-2xl">
                <Router />
              </div>
            </ErrorBoundary>
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
