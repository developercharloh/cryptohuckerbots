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
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, setAuth } = useAuth();
  const { data: profile, isLoading } = useGetProfile();
  const [copied, setCopied] = useState(false);
  const handleCopyUid = async () => {
    const uid = profile?.accountUid;
    if (!uid) return;
    await navigator.clipboard.writeText(uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setAuth("", null as any); // Clear auth
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        // Force logout even if API fails
        setAuth("", null as any);
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  const menuItems = [
    { label: "Personal Information", icon: UserIcon, href: "/profile/personal-info", color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Security", icon: Shield, href: "/profile/security", color: "text-primary", bg: "bg-primary/10" },
    { label: "KYC Verification", icon: FileCheck, href: "/profile/kyc", color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Notifications", icon: Bell, href: "/profile/notifications", color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Support", icon: HelpCircle, href: "/support", color: "text-teal-500", bg: "bg-teal-500/10" },
  ];

  const getKycBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'verified': case 'approved': return 'bg-green-500/10 text-green-500';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      default: return 'bg-red-500/10 text-red-500';
    }
  };

  return (
    <Layout showNav>
      <div className="p-5 pb-8 space-y-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center pt-4 pb-2">
          {isLoading ? (
            <Skeleton className="w-[80px] h-[80px] rounded-full mb-4" />
          ) : (
            <div className="w-[80px] h-[80px] rounded-full bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-[0_0_20px_rgba(124,58,237,0.3)]">
              {profile?.fullName?.charAt(0) || user?.fullName?.charAt(0) || "U"}
            </div>
          )}
          
          {isLoading ? (
            <div className="space-y-2 flex flex-col items-center">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-8 w-40 mt-1" />
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight mb-1">{profile?.fullName || user?.fullName}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email || user?.email}</p>
              {profile?.accountUid && (
                <button
                  onClick={handleCopyUid}
                  className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
                >
                  <span className="text-[11px] font-mono font-bold tracking-widest"><span className="opacity-60 mr-1">UID</span>{profile.accountUid}</span>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Menus */}
        <div className="space-y-3">
          {menuItems.map((item, j) => {
            const Icon = item.icon;
            const isKyc = item.href === "/profile/kyc";
            
            return (
              <button
                key={j}
                type="button"
                onClick={() => setLocation(item.href)}
                className="w-full flex items-center justify-between p-4 bg-card rounded-2xl text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg}`}>
                    <Icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className="font-semibold text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isKyc && profile?.kycStatus && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${getKycBadgeColor(profile.kycStatus)}`}>
                      {profile.kycStatus === 'unverified' ? 'Not Verified' : profile.kycStatus}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="w-full h-px bg-border my-2" />

        <button 
          className="flex items-center justify-between p-4 bg-card rounded-2xl cursor-pointer w-full text-left"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10">
              <LogOut className="w-5 h-5 text-red-500" />
            </div>
            <span className="font-semibold text-sm text-red-500">
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </span>
          </div>
        </button>
      </div>
    </Layout>
  );
}
