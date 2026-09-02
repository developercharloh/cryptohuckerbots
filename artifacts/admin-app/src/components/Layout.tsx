import { useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Bot, CircleDollarSign, LifeBuoy, Settings, Megaphone, Sun, Moon, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

const navItems = [
  { path: "/",           label: "Dashboard", icon: LayoutDashboard },
  { path: "/users",      label: "Users",     icon: Users           },
  { path: "/bots",       label: "Bots",      icon: Bot             },
  { path: "/finance",    label: "Wallet",    icon: CircleDollarSign},
  { path: "/broadcast",  label: "Broadcast", icon: Megaphone       },
  { path: "/support",    label: "Support",   icon: LifeBuoy        },
  { path: "/settings",   label: "Settings",  icon: Settings        },
];

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() =>
    (localStorage.getItem("vixus_theme") ?? "dark") === "dark"
  );

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("vixus_theme", next ? "dark" : "light");
    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="w-8 h-8 rounded-full bg-background border border-border/40 flex items-center justify-center hover:bg-muted transition-colors"
    >
      {isDark
        ? <Sun  className="w-4 h-4 text-amber-400" />
        : <Moon className="w-4 h-4 text-primary"   />}
    </button>
  );
}

export default function Layout({ children, onLogout }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground overflow-hidden">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 lg:h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:pl-[18rem] lg:pr-8 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none tracking-tight">VIXUS</p>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Admin Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <ThemeToggle />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">AD</span>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium leading-none">Admin</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Internal Access</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </header>

      {/* Scrollable Content */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-50 w-64 flex-col border-r border-border bg-card px-4 py-6">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight">VIXUS</p>
            <p className="text-[10px] text-muted-foreground">Admin workspace</p>
          </div>
        </div>
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">Workspace</p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path} className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors", isActive ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-background hover:text-foreground")} data-testid={`desktop-nav-${item.label.toLowerCase()}`}>
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold">Trading operations</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Manage users, bots, finance, and support from one workspace.</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto mt-14 lg:mt-16 mb-16 lg:mb-0 lg:ml-64">
        {children}
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border lg:hidden">
        <nav className="flex items-center justify-around h-16 px-1">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-xl transition-colors duration-200 relative",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                {isActive && (
                  <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-primary/30" />
                )}
                <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
                <span className={cn("text-[10px] font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
