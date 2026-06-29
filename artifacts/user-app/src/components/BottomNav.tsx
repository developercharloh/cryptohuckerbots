import { Link, useLocation } from "wouter";
import { Home, Bot, Wallet, BarChart2, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home",    icon: Home     },
  { href: "/bots",      label: "Bots",    icon: Bot      },
  { href: "/trade",     label: "Trade",   icon: BarChart2 },
  { href: "/cashier",   label: "Wallet",  icon: Wallet   },
  { href: "/profile",   label: "Account", icon: User     },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[430px]"
      style={{
        background: "rgba(10,8,28,0.92)",
        borderTop: "1px solid rgba(124,58,237,0.15)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", height: 68 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/dashboard" && location.startsWith(`${item.href}/`));
          const Icon = item.icon;

          if (item.label === "Trade") {
            return (
              <Link key={item.href} href={item.href} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 16,
                  background: isActive
                    ? "linear-gradient(135deg, #7C3AED, #4F46E5)"
                    : "rgba(124,58,237,0.12)",
                  border: isActive ? "none" : "1px solid rgba(124,58,237,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isActive ? "0 4px 20px rgba(124,58,237,0.5)" : "none",
                  transition: "all 0.2s ease",
                  marginBottom: 2,
                }}>
                  <Icon size={20} style={{ color: isActive ? "#fff" : "#A78BFA" }} />
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: "0.02em",
                  color: isActive ? "#A78BFA" : "#475569",
                  transition: "color 0.2s ease",
                }}>{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, textDecoration: "none", padding: "8px 0" }}
            >
              <div style={{ position: "relative" }}>
                {isActive && (
                  <div style={{
                    position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)",
                    width: 4, height: 4, borderRadius: "50%",
                    background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
                  }} />
                )}
                <Icon
                  size={20}
                  style={{
                    color: isActive ? "#A78BFA" : "#475569",
                    transition: "color 0.2s ease",
                    filter: isActive ? "drop-shadow(0 0 6px rgba(167,139,250,0.6))" : "none",
                  }}
                />
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: "0.02em",
                color: isActive ? "#A78BFA" : "#475569",
                transition: "color 0.2s ease",
              }}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
