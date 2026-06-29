import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLogout, useGetProfile } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User as UserIcon, Shield, FileCheck, Bell, HelpCircle, LogOut,
  ChevronRight, Copy, Check, CreditCard, Settings, Bot, Gift,
  History, MessageSquare, BadgeCheck, Pencil, BarChart2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, setAuth } = useAuth();
  const { data: profile, isLoading } = useGetProfile();
  const [copied, setCopied] = useState(false);
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleCopyUid = async () => {
    const uid = profile?.accountUid;
    if (!uid) return;
    await navigator.clipboard.writeText(uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { setAuth("", null as any); queryClient.clear(); setLocation("/login"); },
      onError:   () => { setAuth("", null as any); queryClient.clear(); setLocation("/login"); },
    });
  };

  const getKycColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "verified": case "approved": return { bg: "rgba(34,197,94,0.12)", color: "#22c55e", border: "rgba(34,197,94,0.2)" };
      case "pending":                   return { bg: "rgba(234,179,8,0.12)",  color: "#eab308", border: "rgba(234,179,8,0.2)"  };
      default:                          return { bg: "rgba(239,68,68,0.12)",  color: "#ef4444", border: "rgba(239,68,68,0.2)"  };
    }
  };

  const joinedDate = profile?.createdAt ? format(new Date(profile.createdAt), "MMM d, yyyy") : "—";
  const kycColors  = getKycColor(profile?.kycStatus ?? "unverified");

  const QUICK_TILES = [
    { label: "AI Bots",     icon: Bot,      href: "/bots",                iconBg: "linear-gradient(135deg,#7C3AED,#4F46E5)", color: "#fff" },
    { label: "Rewards",     icon: Gift,     href: "/rewards",             iconBg: "linear-gradient(135deg,#F59E0B,#EF4444)", color: "#fff" },
    { label: "History",     icon: History,  href: "/cashier/transactions",iconBg: "linear-gradient(135deg,#3B82F6,#06B6D4)", color: "#fff" },
    { label: "Live Chat",   icon: MessageSquare, href: "/support/chat",   iconBg: "linear-gradient(135deg,#10B981,#22C55E)", color: "#fff" },
  ];

  const MENU_ITEMS = [
    { label: "Personal Info",     icon: UserIcon,    href: "/profile/personal-info", color: "#A78BFA", bg: "rgba(124,58,237,0.12)" },
    { label: "Security",          icon: Shield,       href: "/profile/security",      color: "#60A5FA", bg: "rgba(59,130,246,0.12)"  },
    { label: "KYC Verification",  icon: FileCheck,    href: "/profile/kyc",           color: "#FB923C", bg: "rgba(249,115,22,0.12)"  },
    { label: "Notifications",     icon: Bell,         href: "/profile/notifications", color: "#4ADE80", bg: "rgba(34,197,94,0.12)"   },
    { label: "Payment Methods",   icon: CreditCard,   href: "/cashier",               color: "#22D3EE", bg: "rgba(6,182,212,0.12)"   },
    { label: "Trading Settings",  icon: BarChart2,    href: "/trade",                 color: "#FACC15", bg: "rgba(234,179,8,0.12)"   },
    { label: "Support",           icon: HelpCircle,   href: "/support",               color: "#34D399", bg: "rgba(16,185,129,0.12)"  },
    { label: "Account Settings",  icon: Settings,     href: "/profile/personal-info", color: "#818CF8", bg: "rgba(99,102,241,0.12)"  },
  ];

  return (
    <Layout showNav>
      <div style={{ background: "#07091A", minHeight: "100vh", paddingBottom: 88 }}>

        {/* ── Profile Hero ── */}
        <div style={{ background: "linear-gradient(180deg, #1a0833 0%, #07091A 100%)", padding: "28px 16px 24px", textAlign: "center" }}>
          {isLoading ? (
            <Skeleton className="w-20 h-20 rounded-full mx-auto mb-3" />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, fontWeight: 800, color: "#fff",
              margin: "0 auto 12px",
              boxShadow: "0 0 28px rgba(124,58,237,0.45)",
            }}>
              {(profile?.fullName || user?.fullName || "U").charAt(0).toUpperCase()}
            </div>
          )}

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-44" />
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 2 }}>
                {profile?.fullName || user?.fullName}
              </h2>
              <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>
                {profile?.email || user?.email}
              </p>

              {/* Verified badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "4px 12px", marginBottom: 10 }}>
                <BadgeCheck style={{ width: 13, height: 13, color: "#4ade80" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>Verified Account</span>
              </div>

              {/* Account UID */}
              {profile?.accountUid && (
                <button
                  onClick={handleCopyUid}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "5px 12px", cursor: "pointer", marginBottom: 12 }}
                >
                  <span style={{ fontSize: 10, color: "#6B7280", fontFamily: "monospace" }}>ID: {profile.accountUid}</span>
                  {copied
                    ? <Check style={{ width: 11, height: 11, color: "#4ade80" }} />
                    : <Copy style={{ width: 11, height: 11, color: "#6B7280" }} />
                  }
                </button>
              )}

              {/* Stats row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 14 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 9, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Account</p>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Standard</p>
                </div>
                <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.08)" }} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 9, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Joined</p>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{joinedDate}</p>
                </div>
                <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.08)" }} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 9, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>KYC</p>
                  <span style={{ fontSize: 10, fontWeight: 700, color: kycColors.color }}>
                    {profile?.kycStatus === "unverified" || !profile?.kycStatus ? "Pending" : profile.kycStatus}
                  </span>
                </div>
              </div>

              {/* Edit button */}
              <button
                onClick={() => setLocation("/profile/personal-info")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#7C3AED,#4338CA)", borderRadius: 12, padding: "9px 20px", border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.4)" }}
              >
                <Pencil style={{ width: 13, height: 13, color: "#fff" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Edit Profile</span>
              </button>
            </>
          )}
        </div>

        {/* ── Quick Tiles ── */}
        <div style={{ padding: "16px 16px 8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {QUICK_TILES.map(tile => {
              const Icon = tile.icon;
              return (
                <button key={tile.href} onClick={() => setLocation(tile.href)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: tile.iconBg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                    <Icon style={{ width: 22, height: 22, color: tile.color }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textAlign: "center" }}>{tile.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Settings Menu ── */}
        <div style={{ padding: "8px 16px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingLeft: 4 }}>Account & Settings</p>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
            {MENU_ITEMS.map((item, i) => {
              const Icon = item.icon;
              const isKyc = item.href === "/profile/kyc";
              return (
                <button
                  key={i}
                  onClick={() => setLocation(item.href)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 14px", background: "none", border: "none", cursor: "pointer", borderBottom: i < MENU_ITEMS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon style={{ width: 17, height: 17, color: item.color }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#E5E7EB" }}>{item.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isKyc && profile?.kycStatus && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: kycColors.color, background: kycColors.bg, borderRadius: 6, padding: "2px 6px" }}>
                        {profile.kycStatus === "unverified" ? "Pending" : profile.kycStatus}
                      </span>
                    )}
                    <ChevronRight style={{ width: 14, height: 14, color: "#4B5563" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Logout ── */}
        <div style={{ padding: "8px 16px 16px" }}>
          <button
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, cursor: "pointer" }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut style={{ width: 17, height: 17, color: "#f87171" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>
              {logoutMutation.isPending ? "Logging out..." : "Log Out"}
            </span>
          </button>
        </div>
      </div>
    </Layout>
  );
}
