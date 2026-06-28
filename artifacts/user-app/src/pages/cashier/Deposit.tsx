import { useState } from "react";
import { useLocation } from "wouter";
import { useListPaymentMethods, useCreateDepositSession } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Loader2, AlertTriangle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { SiTether, SiBitcoin } from "react-icons/si";

const QUICK_AMOUNTS = [100, 250, 500, 1000];
const MIN_DEPOSIT = 10;

const NETWORK_INFO: Record<string, { time: string; confirmations: number; fullName: string; asset: string }> = {
  TRC20:   { time: "1 – 5 minutes",   confirmations: 20, fullName: "TRC20",   asset: "USDT" },
  ERC20:   { time: "3 – 10 minutes",  confirmations: 12, fullName: "ERC20",   asset: "USDT" },
  Bitcoin: { time: "10 – 60 minutes", confirmations: 6,  fullName: "Bitcoin", asset: "BTC"  },
};

function getAssetSymbol(network: string | undefined) {
  if (!network) return "CRYPTO";
  return NETWORK_INFO[network]?.asset ?? "CRYPTO";
}

function CoinIcon({ name, network, size = "lg" }: { name: string; network?: string; size?: "sm" | "lg" }) {
  const isBTC  = name.includes("BTC") || name.includes("Bitcoin");
  const isLg   = size === "lg";
  const outer  = isLg ? "w-20 h-20" : "w-10 h-10";
  const inner  = isLg ? "w-10 h-10" : "w-5 h-5";

  return (
    <div className="relative inline-flex">
      <div className={`${outer} rounded-full flex items-center justify-center ${isBTC ? "bg-[#F7931A]/20" : "bg-[#26A17B]/20"}`}>
        {isBTC
          ? <SiBitcoin className={`${inner} text-[#F7931A]`} />
          : <SiTether  className={`${inner} text-[#26A17B]`} />
        }
      </div>
      {network && (
        <span className="absolute -bottom-1 -right-1 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
          {network}
        </span>
      )}
    </div>
  );
}

function MethodIcon({ name }: { name: string }) {
  const isBTC = name.includes("BTC") || name.includes("Bitcoin");
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isBTC ? "bg-[#F7931A]/20" : "bg-[#26A17B]/20"}`}>
      {isBTC ? <SiBitcoin className="w-5 h-5 text-[#F7931A]" /> : <SiTether className="w-5 h-5 text-[#26A17B]" />}
    </div>
  );
}

export default function Deposit() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: paymentMethods, isLoading: loadingMethods } = useListPaymentMethods();
  const createSession = useCreateDepositSession();

  const [step, setStep]                   = useState<"select" | "review">("select");
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [amount, setAmount]               = useState(100);
  const [amountInput, setAmountInput]     = useState("100");

  const activeMethod = paymentMethods?.find((m) => m.id === selectedMethodId);
  const netInfo      = activeMethod?.network ? NETWORK_INFO[activeMethod.network] ?? null : null;
  const assetSymbol  = getAssetSymbol(activeMethod?.network ?? undefined);

  const handleContinue = () => {
    if (!selectedMethodId) { toast({ title: "Select a payment method", variant: "destructive" }); return; }
    if (!amount || amount < MIN_DEPOSIT) { toast({ title: `Minimum deposit is $${MIN_DEPOSIT}`, variant: "destructive" }); return; }
    setStep("review");
  };

  const handleConfirm = () => {
    createSession.mutate(
      { data: { amount, paymentMethodId: selectedMethodId } },
      {
        onSuccess: (session) => setLocation(`/cashier/deposit/${session.id}`),
        onError:   (err: any) => toast({ title: "Failed to create deposit", description: err.message, variant: "destructive" }),
      }
    );
  };

  // ── SCREEN 1: Select ────────────────────────────────────────────────────────
  if (step === "select") {
    return (
      <Layout>
        <div className="p-5 pb-8 space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/cashier")} className="w-9 h-9 flex items-center justify-center rounded-xl bg-card">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold tracking-tight">Deposit</h1>
          </div>

          {/* Payment methods */}
          <div className="space-y-3">
            {loadingMethods
              ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              : paymentMethods?.map((m) => (
                  <div key={m.id}
                    className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                      selectedMethodId === m.id ? "bg-card border border-primary" : "bg-card border border-transparent"
                    }`}
                    onClick={() => setSelectedMethodId(m.id)}
                  >
                    <div className="flex items-center gap-3">
                      <MethodIcon name={m.name} />
                      <span className="font-medium text-sm">{m.name} {m.network ? `(${m.network})` : ""}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedMethodId === m.id ? "border-primary" : "border-muted-foreground/30"}`}>
                      {selectedMethodId === m.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                  </div>
                ))}
          </div>

          {/* Deposit address preview */}
          {activeMethod?.depositAddress && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Send your deposit to this {activeMethod.network} address</p>
              <div className="flex items-center gap-2 rounded-xl bg-card p-3">
                <code className="flex-1 truncate text-xs font-mono">{activeMethod.depositAddress}</code>
              </div>
              <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  Double-check the address and send only {activeMethod.name} over the {activeMethod.network} network.
                  Crypto transactions are irreversible — funds sent to a wrong address or network are permanently lost and cannot be recovered or refunded.
                </p>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter Amount</p>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xl font-bold">$</div>
              <Input
                type="number" min={MIN_DEPOSIT} value={amountInput}
                onChange={(e) => { setAmountInput(e.target.value); setAmount(parseFloat(e.target.value) || 0); }}
                className="pl-10 pr-4 bg-card border-none h-16 rounded-xl text-xl font-bold"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((qa) => (
                <Button key={qa} type="button"
                  className={`h-12 rounded-xl text-sm font-semibold shadow-none ${amount === qa ? "bg-primary text-white" : "bg-card text-foreground hover:bg-muted border border-border"}`}
                  onClick={() => { setAmount(qa); setAmountInput(String(qa)); }}
                >
                  ${qa}
                </Button>
              ))}
            </div>
          </div>

          <Button className="w-full h-14 rounded-xl text-base font-semibold shadow-none" onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </Layout>
    );
  }

  // ── SCREEN 2: Confirm Deposit ────────────────────────────────────────────────
  return (
    <Layout>
      <div className="p-5 pb-8 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep("select")} className="w-9 h-9 flex items-center justify-center rounded-xl bg-card">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Confirm Deposit</h1>
        </div>

        {/* Coin icon */}
        <div className="flex justify-center py-2">
          <CoinIcon name={activeMethod?.name ?? ""} network={activeMethod?.network ?? undefined} size="lg" />
        </div>

        {/* Details table */}
        <div className="rounded-2xl bg-card p-5 space-y-0 divide-y divide-border/40">
          {[
            { label: "Asset",           value: assetSymbol },
            { label: "Network",         value: netInfo?.fullName ?? activeMethod?.network ?? "" as string },
            { label: "Amount",          value: `$${amount.toFixed(2)}` },
            { label: "You will receive", value: `${amount} ${assetSymbol}` },
            { label: "Processing time", value: netInfo?.time ?? "Varies" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3.5">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-semibold">{value}</span>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-amber-200/90">
            Make sure you send only {assetSymbol} via {activeMethod?.network} network.
          </p>
        </div>

        {/* Back + Confirm */}
        <div className="flex gap-3 pt-1">
          <Button variant="outline"
            className="flex-1 h-13 rounded-xl text-sm font-semibold border-border shadow-none"
            style={{ height: "52px" }}
            onClick={() => setStep("select")} disabled={createSession.isPending}>
            Back
          </Button>
          <Button
            className="flex-1 rounded-xl text-sm font-semibold shadow-none"
            style={{ height: "52px" }}
            onClick={handleConfirm} disabled={createSession.isPending}>
            {createSession.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
