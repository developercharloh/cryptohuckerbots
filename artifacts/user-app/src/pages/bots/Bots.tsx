import { useLocation } from "wouter";
import {
  useListBots,
  useListMarketplaceBots,
  usePurchaseBot,
  Bot,
  MarketplaceBot,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Plus, Zap, TrendingUp, ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const BOT_GRADIENTS = [
  "from-purple-500 to-indigo-600",
  "from-blue-500 to-cyan-600",
  "from-orange-500 to-red-600",
  "from-green-500 to-emerald-600",
  "from-pink-500 to-rose-600",
];

function RiskBadge({ level }: { level: string }) {
  if (level === "Low")
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
        <ShieldCheck className="w-3 h-3" /> Low Risk
      </span>
    );
  if (level === "Medium")
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
        <Shield className="w-3 h-3" /> Medium Risk
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
      <ShieldAlert className="w-3 h-3" /> High Risk
    </span>
  );
}

export default function Bots() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"my-bots" | "marketplace">("my-bots");
  const { data: myBots = [], isLoading: loadingMyBots } = useListBots();
  const { data: marketplaceBots = [], isLoading: loadingMarketplace } = useListMarketplaceBots();
  const purchaseMutation = usePurchaseBot();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handlePurchase = (id: number) => {
    purchaseMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Bot added successfully" });
          queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
          queryClient.invalidateQueries({ queryKey: ["/api/marketplace-bots"] });
          setActiveTab("my-bots");
        },
        onError: (err: any) => {
          toast({ title: "Failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout showNav>
      <div className="pb-28">
        {/* ── Header ── */}
        <div
          style={{
            background: "linear-gradient(180deg, #1a0a3a 0%, #07091A 100%)",
            padding: "20px 16px 16px",
          }}
        >
          <h1 className="text-2xl font-bold tracking-tight mb-0.5">Trading Bots</h1>
          <p className="text-xs text-muted-foreground">AI Powered Strategies</p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2 px-4 mb-4 mt-2">
          {(["my-bots", "marketplace"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${
                activeTab === tab
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "bg-card text-muted-foreground border border-border/60"
              }`}
            >
              {tab === "my-bots" ? "My Bots" : "Marketplace"}
            </button>
          ))}
        </div>

        <div className="px-4 space-y-3">
          {/* ── My Bots Tab ── */}
          {activeTab === "my-bots" && (
            <>
              {loadingMyBots ? (
                Array(3)
                  .fill(0)
                  .map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)
              ) : myBots.length === 0 ? (
                <div
                  className="rounded-2xl p-8 text-center border border-border/40"
                  style={{ background: "rgba(124,58,237,0.05)" }}
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-semibold text-sm mb-1">No active bots</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Browse the marketplace to add your first AI trading bot.
                  </p>
                  <button
                    onClick={() => setActiveTab("marketplace")}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{
                      background: "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)",
                      boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
                    }}
                  >
                    Browse Marketplace
                  </button>
                </div>
              ) : (
                myBots.map((bot: Bot, i: number) => (
                  <div
                    key={bot.id}
                    className="rounded-2xl p-4 border border-border/40 cursor-pointer"
                    style={{ background: "rgba(13,10,32,0.9)" }}
                    onClick={() => setLocation(`/bots/${bot.id}`)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${BOT_GRADIENTS[i % BOT_GRADIENTS.length]} flex items-center justify-center text-white font-bold text-base shrink-0`}
                      >
                        {bot.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm tracking-wide truncate">{bot.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div
                            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              bot.status === "running"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                bot.status === "running" ? "bg-green-400 animate-pulse" : "bg-muted-foreground"
                              }`}
                            />
                            {bot.status === "running" ? "Running" : "Paused"}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-background/50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Today's Profit</p>
                        <p className="text-sm font-bold text-green-400">+${bot.profitToday}</p>
                      </div>
                      <div className="bg-background/50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Win Rate</p>
                        <p className="text-sm font-bold text-primary">{bot.winRate}%</p>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {!loadingMyBots && (
                <button
                  onClick={() => setActiveTab("marketplace")}
                  className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold text-white mt-2"
                  style={{
                    background: "linear-gradient(135deg, #7C3AED 0%, #4338CA 100%)",
                    boxShadow: "0 4px 20px rgba(124,58,237,0.3)",
                  }}
                >
                  <Plus className="w-5 h-5" />
                  Add New Bot
                </button>
              )}
            </>
          )}

          {/* ── Marketplace Tab ── */}
          {activeTab === "marketplace" && (
            <>
              {loadingMarketplace ? (
                Array(3)
                  .fill(0)
                  .map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)
              ) : marketplaceBots.length === 0 ? (
                <div className="rounded-2xl p-8 text-center text-muted-foreground bg-card">
                  No bots available
                </div>
              ) : (
                marketplaceBots.map((bot: MarketplaceBot, i: number) => (
                  <div
                    key={bot.id}
                    className="rounded-2xl p-4 border border-border/40"
                    style={{ background: "rgba(13,10,32,0.9)" }}
                  >
                    {/* Top row */}
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${BOT_GRADIENTS[i % BOT_GRADIENTS.length]} flex items-center justify-center text-white font-bold text-lg shrink-0`}
                      >
                        {bot.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm tracking-wide truncate">{bot.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <RiskBadge level={bot.riskLevel} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-green-400">
                          {bot.winRate}%
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                          <TrendingUp className="w-3 h-3" /> Win Rate
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                      {bot.description}
                    </p>

                    {/* Price row + button */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <span className="text-xs text-muted-foreground">Price: </span>
                        <span className="text-sm font-bold">
                          {bot.price > 0 ? (
                            `$${bot.price}`
                          ) : (
                            <span className="text-green-400">Free</span>
                          )}
                        </span>
                      </div>
                      <button
                        onClick={() => !bot.isPurchased && handlePurchase(bot.id)}
                        disabled={bot.isPurchased || purchaseMutation.isPending}
                        className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          bot.isPurchased
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "text-white"
                        }`}
                        style={
                          !bot.isPurchased
                            ? {
                                background: "linear-gradient(135deg, #7C3AED 0%, #4338CA 100%)",
                                boxShadow: "0 2px 12px rgba(124,58,237,0.35)",
                              }
                            : undefined
                        }
                      >
                        {bot.isPurchased ? "✓ Owned" : purchaseMutation.isPending ? "Buying..." : "Buy Bot"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
