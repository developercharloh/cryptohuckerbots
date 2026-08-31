import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useListPaymentMethods, useCreateWithdrawal, useGetDashboardSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ChevronLeft, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { SiTether, SiBitcoin, SiEthereum } from "react-icons/si";
import { useLivePairs } from "@/hooks/useLivePairs";
import { formatUSD } from "@/lib/format";

const withdrawSchema = z.object({
  amount: z.coerce.number().min(50, "Minimum withdrawal is $50"),
  paymentMethod: z.string().min(1, "Select a withdrawal network"),
  walletAddress: z.string().min(10, "Valid wallet address is required"),
});

const QUICK_AMOUNTS = [100, 250, 500, 1000];

// Networks whose payout is priced in the coin itself (not a USD-stable coin) —
// show a live crypto-amount estimate alongside the USD input.
const LIVE_PRICED_NETWORKS: Record<string, { symbol: string; asset: string }> = {
  Bitcoin: { symbol: "BTC/USD", asset: "BTC" },
  "Bitcoin Mainnet": { symbol: "BTC/USD", asset: "BTC" },
  ERC20_ETH: { symbol: "ETH/USD", asset: "ETH" },
};

function getLivePricing(method?: { name?: string; network?: string | null }) {
  if (!method) return null;
  if (method.network && LIVE_PRICED_NETWORKS[method.network]) return LIVE_PRICED_NETWORKS[method.network];
  const name = method.name?.toLowerCase() ?? "";
  if (name.includes("bitcoin") || name.includes("btc")) return LIVE_PRICED_NETWORKS.Bitcoin;
  if (name.includes("ethereum") || name.includes("eth")) return LIVE_PRICED_NETWORKS.ERC20_ETH;
  return null;
}

function NetworkIcon({ name }: { name: string }) {
  if (name.includes("BTC") || name.includes("Bitcoin")) return <SiBitcoin className="w-6 h-6 text-[#F7931A]" />;
  if (name.includes("ETH") || name.includes("Ethereum")) return <SiEthereum className="w-6 h-6 text-[#627EEA]" />;
  return <SiTether className="w-6 h-6 text-[#26A17B]" />;
}

function NetworkBadge({ network }: { network?: string | null }) {
  if (!network) return null;
  const colors: Record<string, string> = {
    TRC20: "bg-red-500/10 text-red-400",
    ERC20: "bg-blue-500/10 text-blue-400",
    BEP20: "bg-yellow-500/10 text-yellow-400",
    Bitcoin: "bg-orange-500/10 text-orange-400",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors[network] ?? "bg-muted text-muted-foreground"}`}>
      {network}
    </span>
  );
}

export default function Withdraw() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: { refetchInterval: 5000, refetchOnWindowFocus: true } as any,
  });
  const { data: paymentMethods, isLoading: loadingMethods } = useListPaymentMethods();
  const withdrawMutation = useCreateWithdrawal();
  const livePairs = useLivePairs();

  const form = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: 50, paymentMethod: "", walletAddress: "" },
  });

  const selectedMethodId = form.watch("paymentMethod");
  const activeMethod = paymentMethods?.find((m) => m.id === selectedMethodId);
  const watchedAmount = form.watch("amount");

  const livePricing = getLivePricing(activeMethod);
  const liveRate = livePricing ? livePairs.find((p) => p.symbol === livePricing.symbol)?.price ?? null : null;
  const cryptoEstimate = livePricing && liveRate && watchedAmount > 0 ? Number(watchedAmount) / liveRate : null;
  const mainWalletBalance = summary?.mainWalletBalance ?? summary?.ledgerBalance ?? 0;
  const availableBalance = summary?.availableBalance ?? 0;

  const onSubmit = (values: z.infer<typeof withdrawSchema>) => {
    if (!summary) {
      toast({ title: "Balance is still loading", description: "Please try again in a moment.", variant: "destructive" });
      return;
    }
    if (values.amount > availableBalance) {
      form.setError("amount", { message: `Insufficient balance. Available: ${formatUSD(availableBalance)}` });
      return;
    }
    // Send method name (e.g. "USDT (TRC20)") not ID so admin can see the network
    const methodName = activeMethod?.name ?? values.paymentMethod;
    withdrawMutation.mutate(
      {
        data: {
          ...values,
          paymentMethod: methodName,
          cryptoAmount: cryptoEstimate ?? undefined,
          cryptoAsset: livePricing?.asset ?? undefined,
          conversionRate: liveRate ?? undefined,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Withdrawal submitted",
            description: "Your funds have been reserved and your withdrawal is now processing.",
          });
          setLocation("/cashier/transactions");
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Something went wrong";
          toast({ title: "Withdrawal failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="p-5 pb-10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/cashier")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-card"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Withdraw</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            {/* Network selector */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Select Network</p>
              {loadingMethods ? (
                Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : (
                <div className="space-y-2">
                  {paymentMethods?.map((method) => {
                    const selected = selectedMethodId === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          form.setValue("paymentMethod", method.id);
                          form.setValue("walletAddress", "");
                          form.clearErrors("paymentMethod");
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                            <NetworkIcon name={method.name} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{method.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <NetworkBadge network={method.network} />
                            </div>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected ? "border-primary" : "border-muted-foreground/30"
                        }`}>
                          {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {form.formState.errors.paymentMethod && (
                <p className="text-sm text-destructive">{form.formState.errors.paymentMethod.message}</p>
              )}
            </div>

            {/* Wallet address */}
            <FormField
              control={form.control}
              name="walletAddress"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-semibold">
                    Your{activeMethod ? ` ${activeMethod.network ?? activeMethod.name}` : ""} Wallet Address
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        activeMethod?.network
                          ? `Paste your ${activeMethod.network} address`
                          : "Select a network first"
                      }
                      disabled={!activeMethod}
                      className="bg-card border-none h-14 rounded-xl px-4 font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <div className="flex justify-between items-center">
                    <FormLabel className="text-sm font-semibold">Amount (USD)</FormLabel>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>
                        Main Wallet:{" "}
                        {loadingSummary ? (
                          <Skeleton className="w-16 h-3 inline-block" />
                        ) : (
                          <span className="font-semibold text-foreground">{formatUSD(mainWalletBalance)}</span>
                        )}
                      </div>
                      <div className="mt-0.5">
                        Available to withdraw:{" "}
                        {loadingSummary ? (
                          <Skeleton className="w-12 h-3 inline-block" />
                        ) : (
                          <span className="font-semibold text-foreground">{formatUSD(availableBalance)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!loadingSummary && Number(summary?.pendingOutflow ?? 0) > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {formatUSD(summary?.pendingOutflow ?? 0)} is from pending withdrawal requests.
                    </p>
                  )}
                  <FormControl>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xl font-bold">$</div>
                      <Input
                        type="number"
                        className="pl-10 pr-4 bg-card border-none h-16 rounded-xl text-xl font-bold"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  {livePricing && (
                    <div className="flex items-center justify-between rounded-xl bg-card p-3.5">
                      <span className="text-xs text-muted-foreground">You'll withdraw ≈</span>
                      <span className="text-sm font-semibold text-emerald-400">
                        {cryptoEstimate ? `${cryptoEstimate.toFixed(8)} ${livePricing.asset}` : "Fetching live rate…"}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_AMOUNTS.map((amt) => (
                      <Button
                        key={amt}
                        type="button"
                        className={`h-11 rounded-xl text-sm font-medium shadow-none ${
                          form.watch("amount") === amt
                            ? "bg-primary text-white"
                            : "bg-card text-foreground hover:bg-card/80 border border-border"
                        }`}
                        onClick={() => form.setValue("amount", amt)}
                      >
                        ${amt}
                      </Button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* How it works */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">How withdrawals work</p>
              <div className="space-y-1.5">
                {[
                  "Submit your request — funds are reserved immediately",
                  "Your withdrawal is verified and processed securely",
                  "Crypto is sent to your wallet address",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning */}
            <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <p className="text-xs leading-relaxed text-amber-200/90">
                Double-check your address matches the selected network
                {activeMethod?.network ? ` (${activeMethod.network})` : ""}. Crypto transactions are
                irreversible — funds sent to the wrong address or network are permanently lost.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loadingSummary || withdrawMutation.isPending}
              className="w-full h-14 rounded-xl text-base font-bold shadow-none bg-gradient-to-r from-[#F5B942] to-[#2563EB] hover:opacity-90 transition-opacity"
            >
              {withdrawMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                `Request Withdrawal${activeMethod ? ` via ${activeMethod.network ?? activeMethod.name}` : ""}`
              )}
            </Button>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
