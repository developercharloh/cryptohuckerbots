import { useState, ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Sun, Moon } from "lucide-react";

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
      className="fixed top-4 right-4 z-[60] w-9 h-9 rounded-full bg-card border border-border/40 flex items-center justify-center shadow-md hover:bg-muted transition-colors"
      style={{ maxWidth: "calc(430px - 1rem)", right: "max(1rem, calc(50% - 215px + 1rem))" }}
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
  return (
    <div className="max-w-[430px] mx-auto min-h-[100dvh] bg-background text-foreground relative overflow-x-hidden shadow-2xl">
      <ThemeToggle />
      <div className={showNav ? "pb-[72px]" : ""}>
        {children}
      </div>
      {showNav && <BottomNav />}
    </div>
  );
}
