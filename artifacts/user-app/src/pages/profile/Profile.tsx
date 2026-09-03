import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useGetProfile, useGetReferralSummary, useGetTradeAccess } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User as UserIcon, Shield, FileCheck, Bell, HelpCircle, LogOut,
  ChevronRight, Copy, Check, CreditCard, Settings,
  History, MessageSquare, BadgeCheck, Pencil, BarChart2, Users, Share2,
  Mail, Phone, MapPin, CircleCheck, CircleX,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { data: profile, isLoading } = useGetProfile();
  const { data: referralSummary, isLoading: referralsLoading } = useGetReferralSummary();
  const { data: tradeAccess, isLoading: tradeAccessLoading } = useGetTradeAccess();
  const [copied, setCopied] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const queryClient = useQueryClient();

  const handleCopyUid = async () => {
    const uid = profile?.accountUid;
    if (!uid) return;
    await navigator.clipboard.writeText(uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const referralLink = referralSummary?.referralCode
    ? `${window.location.origin}${import.meta.env.BASE_URL}register?ref=${encodeURIComponent(referralSummary.referralCode)}`
    : "";
  const handleCopyReferral = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  const handleLogout = () => {
    // Clear the local session immediately. AuthContext sends the server logout
    // request in the background so a slow API cannot hold the UI on this page.
    logout();
    queryClient.clear();
    setLocation("/login");
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
  const successfulReferralCount = referralSummary?.referrals.filter((referral) =>
    referral.status === "credited" && referral.activityStatus === "active"
  ).length ?? 0;

  const QUICK_TILES = [
    { label: "History",     icon: History,  href: "/cashier/transactions",iconBg: "linear-gradient(135deg,#3B82F6,#06B6D4)", color: "#fff" },
    { label: "Live Chat",   icon: MessageSquare, href: "/support/chat",   iconBg: "linear-gradient(135deg,#10B981,#22C55E)", color: "#fff" },
    { label: "News",        icon: Bell,     href: "/news",                iconBg: "linear-gradient(135deg,#2563EB,#38BDF8)", color: "#fff" },
    { label: "Orders",      icon: BarChart2, href: "/orders",              iconBg: "linear-gradient(135deg,#F59E0B,#F5B942)", color: "#111827" },
  ];

  const MENU_ITEMS = [
    { label: "Portfolio",          icon: BarChart2,    href: "/portfolio",             color: "#FFD86B", bg: "rgba(245,185,66,0.12)" },
    { label: "Personal Info",     icon: UserIcon,    href: "/profile/personal-info", color: "#FFD86B", bg: "rgba(245,185,66,0.12)" },
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
      <div className="user-profile" style={{ background: "#07091A", minHeight: "100vh", paddingBottom: 88 }}>

        {/* ── Profile Hero ── */}
        <div style={{ background: "linear-gradient(180deg, #2A210D 0%, #07091A 100%)", padding: "28px 16px 24px", textAlign: "center" }}>
          {isLoading ? (
            <Skeleton className="w-20 h-20 rounded-full mx-auto mb-3" />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "linear-gradient(135deg, #F5B942 0%, #D99B18 100%)",
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
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#F5B942,#D99B18)", borderRadius: 12, padding: "9px 20px", border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(245,185,66,0.25)" }}
              >
                <Pencil style={{ width: 13, height: 13, color: "#fff" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Edit Profile</span>
              </button>
            </>
          )}
        </div>

        {/* ── Quick Tiles ── */}
         <div className="user-profile-quick-tiles" style={{ padding: "16px 16px 8px" }}>
           <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
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

        {/* ── Referral Program ── */}
        <div style={{ padding: "8px 16px" }}>
          <div style={{ borderRadius: 20, border: "1px solid rgba(245,185,66,0.2)", background: "linear-gradient(135deg, rgba(245,185,66,0.1), rgba(59,130,246,0.05))", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
                  <Users style={{ width: 17, height: 17, color: "#FFD86B" }} />
                  Referral Rewards
                </p>
                <p style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.5 }}>
                   Invite friends and earn $20 when they activate VIP 1.
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
              <div style={{ background: "rgba(0,0,0,0.18)", borderRadius: 10, padding: "9px 8px", textAlign: "center" }}>
                <p style={{ fontSize: 9, color: "#6B7280", marginBottom: 3 }}>SUCCESSFUL REFERRALS</p>
                <p style={{ fontSize: 17, color: "#4ADE80", fontWeight: 800 }}>
                  {referralsLoading ? "…" : successfulReferralCount}
                </p>
              </div>
              <div style={{ background: "rgba(0,0,0,0.18)", borderRadius: 10, padding: "9px 8px", textAlign: "center" }}>
                <p style={{ fontSize: 9, color: "#6B7280", marginBottom: 3 }}>AMOUNT CREDITED</p>
                <p style={{ fontSize: 17, color: "#FFD86B", fontWeight: 800 }}>
                  {referralsLoading ? "…" : `$${(referralSummary?.totalEarned ?? 0).toFixed(2)}`}
                </p>
              </div>
              <div style={{ background: "rgba(0,0,0,0.18)", borderRadius: 10, padding: "9px 8px", textAlign: "center" }}>
                <p style={{ fontSize: 9, color: "#6B7280", marginBottom: 3 }}>CURRENT VIP LEVEL</p>
                <p style={{ fontSize: 17, color: "#93C5FD", fontWeight: 800 }}>
                  {tradeAccessLoading ? "…" : `VIP ${tradeAccess?.vipLevel ?? 0}`}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <div style={{ flex: 1, background: "rgba(0,0,0,0.18)", borderRadius: 10, padding: "8px 10px", minWidth: 0 }}>
                <p style={{ fontSize: 9, color: "#6B7280", marginBottom: 3 }}>YOUR CODE</p>
                <p style={{ fontSize: 12, color: "#FFD86B", fontFamily: "monospace", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {referralsLoading ? "Loading..." : referralSummary?.referralCode ?? "—"}
                </p>
              </div>
              <button onClick={handleCopyReferral} disabled={!referralLink} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid rgba(245,185,66,0.25)", borderRadius: 10, padding: "0 12px", background: "rgba(245,185,66,0.1)", color: "#FFD86B", cursor: referralLink ? "pointer" : "default", fontSize: 11, fontWeight: 700 }}>
                {referralCopied ? <Check style={{ width: 14, height: 14 }} /> : <Share2 style={{ width: 14, height: 14 }} />}
                {referralCopied ? "Copied" : "Share"}
              </button>
            </div>

            <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>Referral Details</p>
                  <p style={{ fontSize: 10, color: "#6B7280", marginTop: 3 }}>
                    Contact and account details for your referred users
                  </p>
                </div>
                {!referralsLoading && referralSummary?.referrals.length ? (
                  <span style={{ fontSize: 10, color: "#9CA3AF", whiteSpace: "nowrap" }}>
                    {referralSummary.referrals.length} total
                  </span>
                ) : null}
              </div>

              {referralsLoading ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {[1, 2].map((item) => (
                    <div key={item} style={{ height: 70, borderRadius: 12, background: "rgba(255,255,255,0.04)" }} />
                  ))}
                </div>
              ) : referralSummary?.referrals.length ? (
                <div style={{ overflowX: "auto", margin: "0 -4px", padding: "0 4px 4px" }}>
                  <table style={{ width: "100%", minWidth: 760, borderCollapse: "separate", borderSpacing: "0 6px", fontSize: 10 }}>
                    <thead>
                      <tr style={{ color: "#6B7280", textAlign: "left" }}>
                        <th style={{ padding: "0 8px 3px", fontWeight: 700 }}>REFERRED USER</th>
                        <th style={{ padding: "0 8px 3px", fontWeight: 700 }}>ACCOUNT DETAILS</th>
                        <th style={{ padding: "0 8px 3px", fontWeight: 700 }}>PHONE</th>
                        <th style={{ padding: "0 8px 3px", fontWeight: 700 }}>VIP</th>
                        <th style={{ padding: "0 8px 3px", fontWeight: 700 }}>ACTIVITY</th>
                        <th style={{ padding: "0 8px 3px", fontWeight: 700, textAlign: "right" }}>BONUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralSummary.referrals.map((referral) => {
                        const isActive = referral.activityStatus === "active";
                        return (
                          <tr key={referral.id} style={{ background: "rgba(0,0,0,0.2)" }}>
                            <td style={{ padding: "10px 8px", borderRadius: "10px 0 0 10px", verticalAlign: "top" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                                <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(245,185,66,0.12)", color: "#FFD86B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <Users style={{ width: 13, height: 13 }} />
                                </div>
                                <div>
                                  <p style={{ color: "#F3F4F6", fontWeight: 700, fontSize: 11 }}>{referral.referredName}</p>
                                  <p style={{ color: "#6B7280", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                    <MapPin style={{ width: 10, height: 10 }} /> {referral.referredCountry ?? "Country unavailable"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                              <p style={{ color: "#FFD86B", fontFamily: "monospace", fontWeight: 700, fontSize: 10 }}>{referral.referredAccountUid}</p>
                              <p style={{ color: "#9CA3AF", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                <Mail style={{ width: 10, height: 10 }} /> {referral.referredEmail}
                              </p>
                            </td>
                            <td style={{ padding: "10px 8px", color: "#D1D5DB", verticalAlign: "top", whiteSpace: "nowrap" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Phone style={{ width: 10, height: 10, color: "#60A5FA" }} />
                                {referral.referredPhone ?? "Not provided"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 8px", color: "#93C5FD", fontWeight: 700, verticalAlign: "top", whiteSpace: "nowrap" }}>
                              VIP {referral.currentVipLevel}
                            </td>
                            <td style={{ padding: "10px 8px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: isActive ? "#4ADE80" : "#9CA3AF", background: isActive ? "rgba(34,197,94,0.1)" : "rgba(156,163,175,0.1)", border: `1px solid ${isActive ? "rgba(34,197,94,0.2)" : "rgba(156,163,175,0.18)"}`, borderRadius: 999, padding: "4px 7px", fontWeight: 700 }}>
                                {isActive ? <CircleCheck style={{ width: 11, height: 11 }} /> : <CircleX style={{ width: 11, height: 11 }} />}
                                {isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 8px", borderRadius: "0 10px 10px 0", color: referral.status === "credited" ? "#FFD86B" : "#EAB308", fontWeight: 800, textAlign: "right", verticalAlign: "top", whiteSpace: "nowrap" }}>
                              ${referral.bonusAmount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ borderRadius: 12, border: "1px dashed rgba(255,255,255,0.12)", padding: "18px 12px", textAlign: "center" }}>
                  <Users style={{ width: 18, height: 18, color: "#6B7280", margin: "0 auto 7px" }} />
                  <p style={{ fontSize: 11, color: "#9CA3AF" }}>No referrals yet</p>
                </div>
              )}
            </div>
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
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, cursor: "pointer" }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut style={{ width: 17, height: 17, color: "#f87171" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>
              Log Out
            </span>
          </button>
        </div>
      </div>
    </Layout>
  );
}
