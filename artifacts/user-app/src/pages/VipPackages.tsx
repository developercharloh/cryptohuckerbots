import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, Crown, LayoutDashboard, LockKeyhole, Sparkles, WalletCards } from "lucide-react";
import { useLocation } from "wouter";
import {
  useGetDashboardSummary,
  useGetTradeAccess,
  useListVipPackages,
  usePurchaseVipPackage,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const formatUSD = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const VIP_LEVELS = [
  { level: 1, price: 500, dailySignals: 3 },
  { level: 2, price: 1000, dailySignals: 4 },
  { level: 3, price: 2000, dailySignals: 5 },
  { level: 4, price: 4000, dailySignals: 6 },
  { level: 5, price: 8000, dailySignals: 7 },
  { level: 6, price: 16000, dailySignals: 8 },
  { level: 7, price: 32000, dailySignals: 9 },
] as const;

export default function VipPackages({ showBack = true }: { showBack?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    data: access,
    isLoading: accessLoading,
    isError: accessError,
    error: accessQueryError,
    refetch: refetchAccess,
  } = useGetTradeAccess({ query: { refetchInterval: 15000 } as any });
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useGetDashboardSummary({ query: { refetchInterval: 10000 } as any });
  const { data: serverPackages } = useListVipPackages({ query: { refetchInterval: 15000 } as any });
  const purchaseMutation = usePurchaseVipPackage();
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{
    level: number;
    price: number;
    amountPaid: number;
    dailySignals: number;
     vaultCapital: number;
     portfolioBalance: number;
    mainWalletBalance: number;
  } | null>(null);

  const activeLevel = access?.vipLevel ?? 0;
  const packageOptions = useMemo(
    () =>
      serverPackages?.length
        ? serverPackages
        : VIP_LEVELS.map((pkg) => ({
            ...pkg,
            isActive: pkg.level === activeLevel,
            isUpgrade: pkg.level > activeLevel,
            isAvailable: pkg.level > activeLevel,
            amountDue: pkg.level > activeLevel
              ? pkg.price - (VIP_LEVELS.find((candidate) => candidate.level === activeLevel)?.price ?? 0)
              : 0,
          })),
    [activeLevel, serverPackages],
  );
  const selected = useMemo(
    () => (selectedLevel === null ? null : packageOptions.find((pkg) => pkg.level === selectedLevel) ?? null),
    [packageOptions, selectedLevel],
  );
  const availableBalance = summary?.availableBalance ?? 0;
  const purchaseBalance = summary?.ledgerBalance ?? summary?.mainWalletBalance ?? availableBalance;
  const pendingOutflow = summary?.pendingOutflow ?? 0;
  const amountDue = selected?.amountDue ?? 0;
  const shortfall = Math.max(0, amountDue - purchaseBalance);
  const canPurchase = Boolean(access && selected) && selected!.level > activeLevel && purchaseBalance >= amountDue;
  const accessUnauthorized = (accessQueryError as { status?: number } | undefined)?.status === 401;
   const walletDisplay = summaryLoading
     ? "Loading…"
     : formatUSD(purchaseBalance);
   const vaultCapitalDisplay = accessLoading
     ? "Loading…"
     : formatUSD(access?.vaultCapital ?? access?.lockedInvestmentCapital ?? 0);

  const handlePurchase = () => {
    if (!access || !selected || selected.level <= activeLevel) return;
    purchaseMutation.mutate(
      { level: selected.level },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: ["/api/trade/access"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trade/vip-packages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trade/signals"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          queryClient.invalidateQueries({ queryKey: ["/api/cashier/transactions"] });
          setSelectedLevel(result.package.level);
           setPurchaseSuccess({
             level: result.package.level,
             price: result.package.price,
              amountPaid: result.amountPaid,
             dailySignals: result.package.dailySignals,
             vaultCapital: result.vaultCapital ?? result.lockedInvestmentCapital,
             portfolioBalance: result.portfolioBalance ?? (result.mainWalletBalance + (result.vaultCapital ?? result.lockedInvestmentCapital)),
             mainWalletBalance: result.mainWalletBalance,
           });
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

  const handleActivationAction = () => {
    if (accessError || summaryError) {
      if (accessUnauthorized) {
        setLocation("/login");
      } else {
        if (accessError) void refetchAccess();
        if (summaryError) void refetchSummary();
      }
      return;
    }
    handlePurchase();
  };

  return (
    <Layout showNav>
      <div className="min-h-screen bg-[#07091A] pb-28 text-white">
        <div className="mx-auto max-w-3xl px-4 py-5">
          {showBack && (
            <button
              onClick={() => setLocation("/trade")}
              className="mb-5 flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to AI Signals
            </button>
          )}

          <div className="mb-5 rounded-3xl border border-amber-400/20 bg-gradient-to-br from-[#3A2B0D] via-[#17130A] to-[#0B1220] p-5 shadow-[0_8px_35px_rgba(245,185,66,0.15)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-300">
                  <Crown className="h-4 w-4" /> VIP Levels
                </p>
                <h1 className="text-2xl font-black tracking-tight">Choose Your VIP Level</h1>
                  <p className="mt-2 max-w-xl text-xs leading-5 text-gray-400">
                   Select a VIP level and activate it once from your Main Wallet. Your highest activated tier stays active permanently and unlocks its daily signal allowance.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500">Main wallet balance</p>
                   <p className="mt-1 text-lg font-black text-amber-200">{walletDisplay}</p>
                  {pendingOutflow > 0 && (
                    <p className="mt-1 max-w-[150px] text-[9px] leading-3 text-gray-500">
                      VIP purchases use completed wallet funds. Pending withdrawals stay reserved separately.
                    </p>
                  )}
                  <p className="mt-2 text-[9px] uppercase tracking-wider text-gray-500">Vault capital</p>
                    <p className="mt-1 text-sm font-black text-blue-200">{vaultCapitalDisplay}</p>
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

            {selectedLevel !== null && (
              <button
                onClick={() => setSelectedLevel(null)}
                className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-400 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Back to all VIP levels
              </button>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
             {(selectedLevel === null ? packageOptions : packageOptions.filter((pkg) => pkg.level === selectedLevel)).map((pkg) => {
              const selectedCard = selectedLevel === pkg.level;
              const active = pkg.level === activeLevel;
               const includedTier = pkg.level < activeLevel;
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
                      {pkg.level > activeLevel && (
                        <p className="mt-1 text-[10px] font-bold text-blue-200">Due today: {formatUSD(pkg.amountDue)}</p>
                      )}
                    </div>
                    {active ? (
                      <span className="rounded-full bg-green-400/15 px-2 py-1 text-[9px] font-bold uppercase text-green-300">Active</span>
                     ) : includedTier ? (
                       <BadgeCheck className="h-4 w-4 text-blue-300" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-blue-300" />
                    )}
                  </div>
                  <p className="mt-3 text-xs text-gray-400">{pkg.dailySignals} AI Signals per day</p>
                    <p className="mt-1 text-[10px] text-gray-600">
                     {active ? "Currently active" : includedTier ? `Included with VIP ${activeLevel}` : selectedCard ? "Selected for activation" : "Tap to select"}
                  </p>
                </button>
              );
            })}
          </div>

          {selected && (
             <div className="mt-5 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/10 to-blue-500/10 p-4">
              <div className="flex items-center gap-3">
                <WalletCards className="h-5 w-5 text-amber-300" />
                <div className="flex-1">
                   <p className="text-sm font-bold">Activate VIP {selected.level}</p>
                  <p className="mt-1 text-xs text-gray-400">
                       {activeLevel > 0
                         ? `${formatUSD(selected.amountDue)} due today to upgrade to VIP ${selected.level} · ${formatUSD(selected.price)} total Vault Capital`
                         : `${formatUSD(selected.amountDue)} will move from your Main Wallet into Vault Capital`}
                       {" "}· {selected.dailySignals} AI Signals per day
                  </p>
                </div>
                <button
                   onClick={handleActivationAction}
                    disabled={purchaseMutation.isPending || accessLoading || summaryLoading || (!canPurchase && !accessError && !summaryError)}
                  className="rounded-xl bg-gradient-to-r from-amber-400 to-blue-600 px-4 py-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                {purchaseMutation.isPending
                   ? "Activating..."
                      : accessLoading || summaryLoading
                          ? "Loading balance..."
                     : accessError
                        ? accessUnauthorized ? "Sign in again" : "Retry access"
                      : summaryError
                        ? "Retry wallet"
                     : !access
                       ? "Sign in required"
                    : selected.level === activeLevel
                      ? "Already active"
                      : selected.level < activeLevel
                        ? "Below active tier"
                           : purchaseBalance < selected.amountDue
                          ? `Insufficient balance — need ${formatUSD(shortfall)} more`
                          : "Activate VIP package"}
                </button>
              </div>
              {!canPurchase && selected.level > activeLevel && purchaseBalance < selected.amountDue && (
                <p role="alert" className="mt-3 rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-[11px] leading-5 text-red-200">
                   Insufficient Main Wallet balance to purchase VIP {selected.level}. You need {formatUSD(selected.amountDue)}, but your Main Wallet is {formatUSD(purchaseBalance)}. Top up your wallet or use accumulated profits; you are short by {formatUSD(shortfall)}.
                </p>
              )}
               <p className="mt-3 text-[10px] leading-4 text-gray-500">
                   Your Main Wallet decreases by the amount due today. The target tier’s capital becomes Vault Capital, while signal profits and permitted returns accumulate in your Main Wallet.
              </p>
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={purchaseSuccess !== null}
        onOpenChange={(open) => {
          if (!open) setPurchaseSuccess(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-3xl border border-amber-300/25 bg-[#101426] p-0 text-white shadow-[0_20px_80px_rgba(0,0,0,0.65)]">
          {purchaseSuccess && (
            <div className="relative overflow-hidden">
              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-amber-300/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-12 h-44 w-44 rounded-full bg-blue-500/15 blur-3xl" />
              <div className="relative px-6 pb-6 pt-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/30 bg-gradient-to-br from-amber-300 to-yellow-500 text-[#1A1204] shadow-lg shadow-amber-400/25">
                  <BadgeCheck className="h-9 w-9" strokeWidth={2.2} />
                </div>
                <DialogTitle className="mt-5 text-center text-2xl font-black tracking-tight">
                  VIP {purchaseSuccess.level} is now active
                </DialogTitle>
                <DialogDescription className="mx-auto mt-2 max-w-xs text-center text-sm leading-5 text-slate-300">
                  Your access has been activated successfully. You can now use up to {purchaseSuccess.dailySignals} AI Signals each day.
                </DialogDescription>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-amber-200/15 bg-amber-200/[0.07] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200/70">Activated tier</p>
                    <p className="mt-1 text-lg font-black text-amber-100">VIP {purchaseSuccess.level}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{formatUSD(purchaseSuccess.amountPaid)} paid today · {formatUSD(purchaseSuccess.price)} in Vault Capital</p>
                  </div>
                  <div className="rounded-2xl border border-blue-200/15 bg-blue-200/[0.07] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200/70">Main wallet</p>
                    <p className="mt-1 text-lg font-black text-blue-100">{formatUSD(purchaseSuccess.mainWalletBalance)}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Available to use</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-slate-300">
                  <LockKeyhole className="h-4 w-4 shrink-0 text-amber-300" />
                   <span>Total Vault Capital: <strong className="text-white">{formatUSD(purchaseSuccess.vaultCapital)}</strong></span>
                </div>

                <button
                  onClick={() => {
                    setPurchaseSuccess(null);
                    setLocation("/dashboard");
                  }}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-blue-600 px-4 py-3.5 text-sm font-black text-[#171108] shadow-lg shadow-amber-500/20 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setPurchaseSuccess(null);
                    setLocation("/trade");
                  }}
                  className="mt-2 flex w-full items-center justify-center rounded-2xl px-4 py-3 text-xs font-bold text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  View AI Signals
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}