import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Crown, LockKeyhole, Sparkles, WalletCards } from "lucide-react";
import { useLocation } from "wouter";
import {
  VipPackage,
  useGetDashboardSummary,
  useGetTradeAccess,
  useListVipPackages,
  usePurchaseVipPackage,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const formatUSD = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function VipPackages() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: packages = [], isLoading } = useListVipPackages();
  const { data: access } = useGetTradeAccess({ query: { refetchInterval: 15000 } as any });
  const { data: summary } = useGetDashboardSummary({ query: { refetchInterval: 10000 } as any });
  const purchaseMutation = usePurchaseVipPackage();
  const [selectedLevel, setSelectedLevel] = useState(1);

  useEffect(() => {
    const firstAvailable = packages.find((pkg) => pkg.isAvailable);
    const active = packages.find((pkg) => pkg.isActive);
    if (firstAvailable || active) setSelectedLevel((firstAvailable ?? active)!.level);
  }, [packages]);

  const selected = useMemo(
    () => packages.find((pkg) => pkg.level === selectedLevel) ?? null,
    [packages, selectedLevel],
  );
  const availableBalance = summary?.availableBalance ?? 0;
  const canPurchase = Boolean(selected?.isAvailable) && availableBalance >= (selected?.price ?? Infinity);

  const handlePurchase = () => {
    if (!selected || !selected.isAvailable) return;
    purchaseMutation.mutate(
      { level: selected.level },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: ["/api/trade/access"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trade/vip-packages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trade/signals"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          queryClient.invalidateQueries({ queryKey: ["/api/cashier/transactions"] });
          toast({ title: "VIP package activated", description: result.message });
          setSelectedLevel(result.package.level);
        },
        onError: (error: any) => {
          toast({
            title: "Package purchase failed",
            description: error?.message ?? "Please check your balance and try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Layout showNav>
      <div className="min-h-screen bg-[#07091A] pb-28 text-white">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <button
            onClick={() => setLocation("/trade")}
            className="mb-5 flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to AI Signals
          </button>

          <div className="mb-5 rounded-3xl border border-amber-400/20 bg-gradient-to-br from-[#3A2B0D] via-[#17130A] to-[#0B1220] p-5 shadow-[0_8px_35px_rgba(245,185,66,0.15)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-300">
                  <Crown className="h-4 w-4" /> VIP Signal Access
                </p>
                <h1 className="text-2xl font-black tracking-tight">Buy a VIP Package</h1>
                <p className="mt-2 max-w-xl text-xs leading-5 text-gray-400">
                  Select one package and pay once from your available wallet balance. Your highest purchased tier stays active permanently and unlocks its daily signal allowance.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                <p className="text-[9px] uppercase tracking-wider text-gray-500">Available balance</p>
                <p className="mt-1 text-lg font-black text-amber-200">{formatUSD(availableBalance)}</p>
              </div>
            </div>
            {access?.vipLevel ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs text-amber-200">
                <Check className="h-4 w-4" /> VIP {access.vipLevel} is active. Choose a higher tier to upgrade.
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-blue-300/15 bg-blue-300/5 px-3 py-2 text-xs text-blue-200">
                <LockKeyhole className="h-4 w-4" /> VIP 1 purchase is required before any signal can be executed.
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
              ))
            ) : (
              packages.map((pkg: VipPackage) => {
                const selectedCard = selectedLevel === pkg.level;
                const active = pkg.isActive;
                const locked = !pkg.isAvailable && !active;
                return (
                  <button
                    key={pkg.level}
                    onClick={() => setSelectedLevel(pkg.level)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selectedCard ? "border-amber-300 bg-amber-300/10 shadow-lg shadow-amber-500/10" : "border-white/10 bg-white/[0.04] hover:border-amber-300/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-amber-200">VIP {pkg.level}</p>
                        <p className="mt-1 text-2xl font-black text-white">{formatUSD(pkg.price)}</p>
                      </div>
                      {active ? (
                        <span className="rounded-full bg-green-400/15 px-2 py-1 text-[9px] font-bold uppercase text-green-300">Active</span>
                      ) : locked ? (
                        <LockKeyhole className="h-4 w-4 text-gray-600" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-blue-300" />
                      )}
                    </div>
                    <p className="mt-3 text-xs text-gray-400">{pkg.dailySignals} scheduled signal{pkg.dailySignals === 1 ? "" : "s"} per day</p>
                    <p className="mt-1 text-[10px] text-gray-600">
                      {active ? "Currently active" : locked ? "Already below your active tier" : "Permanent access"}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {selected && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <WalletCards className="h-5 w-5 text-amber-300" />
                <div className="flex-1">
                  <p className="text-sm font-bold">VIP {selected.level} package</p>
                  <p className="mt-1 text-xs text-gray-400">
                    One-time wallet charge of {formatUSD(selected.price)} · {selected.dailySignals} signals per day
                  </p>
                </div>
                <button
                  onClick={handlePurchase}
                  disabled={!canPurchase || purchaseMutation.isPending}
                  className="rounded-xl bg-gradient-to-r from-amber-400 to-blue-600 px-4 py-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {purchaseMutation.isPending ? "Buying..." : selected.isActive ? "Already active" : availableBalance < selected.price ? "Insufficient balance" : "Buy package"}
                </button>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-gray-500">
                The package purchase is recorded in your wallet history and unlocks scheduled AI Signals.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}