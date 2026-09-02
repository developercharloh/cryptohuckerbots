import { useState, ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Sun, Moon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { VixusLogo } from "./VixusLogo";

const DESKTOP_NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/markets", label: "Markets" },
  { href: "/news", label: "News" },
  { href: "/trade", label: "Trade" },
  { href: "/orders", label: "Orders" },
  { href: "/bots", label: "VIP Levels" },
  { href: "/cashier", label: "Wallet" },
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
      className="fixed top-4 right-4 lg:right-8 z-[60] w-9 h-9 rounded-full bg-card border border-border/40 flex items-center justify-center shadow-md hover:bg-muted transition-colors"
    >
      {isDark
        ? <Sun  className="w-4 h-4 text-amber-400" />
        : <Moon className="w-4 h-4 text-primary" />}
    </button>
  );
}

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function Layout({ children, showNav = false }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="user-layout min-h-[100dvh] bg-background text-foreground relative overflow-x-hidden">
      <ThemeToggle />
      {showNav && (
        <nav className="desktop-user-nav hidden lg:flex fixed top-0 left-0 right-0 z-50 h-16 items-center border-b border-border/60 bg-background/90 px-8 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[1440px] items-center gap-10 pr-20">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2 text-foreground no-underline">
              <VixusLogo className="h-9 w-9 rounded-xl border border-amber-300/30 object-cover shadow-lg shadow-blue-950/40" />
              <span className="text-sm font-extrabold tracking-tight">VIXUS</span>
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {DESKTOP_NAV.map((item) => {
                const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(`${item.href}/`));
                return (
                  <Link key={item.href} href={item.href} className={`rounded-xl px-4 py-2 text-sm font-semibold no-underline transition-colors ${active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}>
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <Link href="/profile" className="rounded-xl border border-border/60 bg-card px-4 py-2 text-xs font-semibold text-muted-foreground no-underline hover:text-foreground">
              Account
            </Link>
          </div>
        </nav>
      )}
      <div className={`${showNav ? "pb-[72px] lg:pb-0 lg:pt-16" : ""} user-layout-content`}>
        {children}
      </div>
      {showNav && <BottomNav />}
    </div>
  );
}
