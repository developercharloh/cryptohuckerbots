import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLogout, useGetProfile } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User as UserIcon,
  Shield,
  FileCheck,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Copy,
  Check,
  CreditCard,
  Settings,
  Globe,
  Moon,
  BarChart2,
  BadgeCheck,
  Pencil,
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
      onSuccess: () => {
        setAuth("", null as any);
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        setAuth("", null as any);
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  const menuItems = [
    { label: "Account Settings", icon: Settings, href: "/profile/personal-info", color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Security", icon: Shield, href: "/profile/security", color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "KYC Verification", icon: FileCheck, href: "/profile/kyc", color: "text-orange-400", bg: "bg-orange-500/10" },
    { label: "Notifications", icon: Bell, href: "/profile/notifications", color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Payment Methods", icon: CreditCard, href: "/cashier", color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Trading Preferences", icon: BarChart2, href: "/trade", color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "Language", icon: Globe, href: "/profile", color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Support", icon: HelpCircle, href: "/support", color: "text-teal-400", bg: "bg-teal-500/10" },
  ];

  const getKycBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "verified":
      case "approved":
        return "bg-green-500/10 text-green-400";
      case "pending":
        return "bg-yellow-500/10 text-yellow-400";
      default:
        return "bg-red-500/10 text-red-400";
    }
  };

  const joinedDate = profile?.createdAt
    ? format(new Date(profile.createdAt), "MMM d, yyyy")
    : "—";

  return (
    <Layout showNav>
      <div className="pb-28">
        {/* ── Profile Hero ── */}
        <div
          style={{
            background: "linear-gradient(180deg, #1a0a3a 0%, #07091A 100%)",
            padding: "28px 16px 24px",
            textAlign: "center",
          }}
        >
          {isLoading ? (
            <Skeleton className="w-24 h-24 rounded-full mx-auto mb-4" />
          ) : (
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                fontWeight: 800,
                color: "#fff",
                margin: "0 auto 14px",
                boxShadow: "0 0 30px rgba(124,58,237,0.4)",
              }}
            >
              {(profile?.fullName || user?.fullName || "U").charAt(0)}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2 flex flex-col items-center">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold tracking-tight mb-0.5">
                {profile?.fullName || user?.fullName}
              </h2>
              <p className="text-sm text-muted-foreground mb-2">
                {profile?.email || user?.email}
              </p>

              {/* Verified badge */}
              <div className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full mb-3">
                <BadgeCheck className="w-3.5 h-3.5 text-green-400" />
                <span className="text-[11px] font-semibold text-green-400">Verified Account</span>
              </div>

              {/* Account info pills */}
              <div className="flex items-center justify-center gap-2 flex-wrap mb-3">
                {profile?.accountUid && (
                  <button
                    onClick={handleCopyUid}
                    className="inline-flex items-center gap-1.5 bg-card border border-border/50 px-3 py-1.5 rounded-xl text-[11px] font-mono font-semibold hover:border-primary/40 transition-colors"
                  >
                    <span className="text-muted-foreground">ID:</span>
                    <span className="text-foreground">{profile.accountUid}</span>
                    {copied ? (
                      <Check className="w-3 h-3 text-green-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>

              {/* Account details row */}
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Account Type</p>
                  <p className="text-xs font-bold">Standard</p>
                </div>
                <div className="w-px h-8 bg-border/40" />
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Joined</p>
                  <p className="text-xs font-bold">{joinedDate}</p>
                </div>
                <div className="w-px h-8 bg-border/40" />
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">KYC Status</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-semibold ${getKycBadgeColor(profile?.kycStatus ?? "unverified")}`}>
                    {profile?.kycStatus === "unverified" || !profile?.kycStatus ? "Pending" : profile.kycStatus}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Edit Profile button */}
          {!isLoading && (
            <button
              onClick={() => setLocation("/profile/personal-info")}
              className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #4338CA 100%)",
                boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
              }}
            >
              <Pencil className="w-4 h-4" />
              Edit Profile
            </button>
          )}
        </div>

        {/* ── Menu Items ── */}
        <div className="px-4 pt-4 space-y-2">
          {menuItems.map((item, j) => {
            const Icon = item.icon;
            const isKyc = item.href === "/profile/kyc";

            return (
              <button
                key={j}
                type="button"
                onClick={() => setLocation(item.href)}
                className="w-full flex items-center justify-between p-4 rounded-2xl border border-border/30 text-left"
                style={{ background: "rgba(13,10,32,0.9)" }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg}`}>
                    <Icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className="font-semibold text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isKyc && profile?.kycStatus && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${getKycBadgeColor(profile.kycStatus)}`}>
                      {profile.kycStatus === "unverified" ? "Pending" : profile.kycStatus}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </div>
              </button>
            );
          })}

          {/* Logout */}
          <button
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-red-500/20 text-left mt-2"
            style={{ background: "rgba(239,68,68,0.05)" }}
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-400" />
              </div>
              <span className="font-semibold text-sm text-red-400">
                {logoutMutation.isPending ? "Logging out..." : "Log Out"}
              </span>
            </div>
          </button>
        </div>
      </div>
    </Layout>
  );
}
