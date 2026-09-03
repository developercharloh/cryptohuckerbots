import { Link, useLocation } from "wouter";
import { Home, BarChart2, Wallet, LayoutGrid, TrendingUp } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home",    icon: Home,          center: false },
  { href: "/markets",   label: "Markets", icon: BarChart2,     center: false },
  { href: "/trade",     label: "Trade",  icon: TrendingUp,    center: true  },
  { href: "/portfolio", label: "Portfolio", icon: Wallet,       center: false },
  { href: "/profile",   label: "More",    icon: LayoutGrid,    center: false },
];

export function BottomNav() {
  const [location] = useLocation();

  const isActive = (href: string) =>
    location === href ||
    (href !== "/dashboard" && location.startsWith(`${href}/`));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-none lg:hidden"
      style={{
        background: "rgba(7,9,26,0.97)",
        borderTop: "1px solid rgba(245,185,66,0.22)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", height: 64 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          if (item.center) {
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
              >
                <div style={{
                  width: 50, height: 50, borderRadius: "50%",
                  background: active
                    ? "linear-gradient(135deg, #F5B942 0%, #D99B18 100%)"
                    : "linear-gradient(135deg, #2B2415 0%, #111827 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: active
                    ? "0 0 24px rgba(245,185,66,0.45), 0 4px 16px rgba(245,185,66,0.25)"
                    : "0 4px 16px rgba(0,0,0,0.3)",
                  marginBottom: 2,
                  border: "2px solid rgba(255,216,107,0.35)",
                }}>
                  <Icon size={22} style={{ color: "#fff" }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: active ? "#FFD86B" : "#64748B", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, textDecoration: "none", padding: "8px 0" }}
            >
              <div style={{ position: "relative" }}>
                {active && (
                  <div style={{
                    position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)",
                    width: 16, height: 2, borderRadius: 1,
                    background: "linear-gradient(90deg, #F5B942, #FFD86B)",
                  }} />
                )}
                <Icon
                  size={20}
                  style={{
                    color: active ? "#FFD86B" : "#64748B",
                    transition: "color 0.2s ease",
                    filter: active ? "drop-shadow(0 0 8px rgba(245,185,66,0.55))" : "none",
                  }}
                />
              </div>
              <span style={{
                fontSize: 9, fontWeight: active ? 700 : 500,
                letterSpacing: "0.04em", textTransform: "uppercase",
                color: active ? "#FFD86B" : "#64748B",
                transition: "color 0.2s ease",
              }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
