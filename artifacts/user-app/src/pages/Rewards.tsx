import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  Gift, Star, Users, Copy, Share2, ChevronRight,
  TrendingUp, Shield, Zap, BarChart3, HeadphonesIcon,
  Info, CheckCircle2, Lock, ExternalLink, Award,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getReferralCode(userId?: number) {
  return `VAI-${String(userId ?? 0).padStart(5, "0")}`;
}

// ── Volume Tier data (standard FX broker structure) ───────────────────────────
const VOLUME_TIERS = [
  {
    name: "Standard",
    range: "$0 – $4,999",
    minVolume: 0,
    maxVolume: 4999,
    rebate: "$1.50 / lot",
    spread: "From 1.2 pips",
    support: "Standard support",
    bots: "Up to 2 bots",
    analytics: "Basic analytics",
    color: "border-slate-600",
    badge: "bg-slate-700 text-slate-200",
  },
  {
    name: "Premium",
    range: "$5,000 – $24,999",
    minVolume: 5000,
    maxVolume: 24999,
    rebate: "$2.50 / lot",
    spread: "From 0.9 pips",
    support: "Priority support",
    bots: "Up to 5 bots",
    analytics: "Advanced analytics",
    color: "border-yellow-600",
    badge: "bg-yellow-800/60 text-yellow-200",
  },
  {
    name: "Elite",
    range: "$25,000 – $99,999",
    minVolume: 25000,
    maxVolume: 99999,
    rebate: "$3.50 / lot",
    spread: "From 0.6 pips",
    support: "Dedicated manager",
    bots: "Up to 10 bots",
    analytics: "Full suite + signals",
    color: "border-cyan-500",
    badge: "bg-cyan-900/60 text-cyan-200",
  },
  {
    name: "Institutional",
    range: "$100,000+",
    minVolume: 100000,
    maxVolume: Infinity,
    rebate: "$5.00 / lot",
    spread: "Raw spreads",
    support: "24/7 dedicated desk",
    bots: "Unlimited bots",
    analytics: "Custom reporting",
    color: "border-purple-500",
    badge: "bg-purple-900/60 text-purple-200",
  },
];

const TIER_BENEFITS = [
  { icon: TrendingUp, label: "Spread reduction",       desc: "Tighter spreads as your volume grows"              },
  { icon: Zap,        label: "Volume rebates",          desc: "Cash back per standard lot traded"                 },
  { icon: Shield,     label: "Priority withdrawals",   desc: "Faster processing for higher-tier accounts"        },
  { icon: BarChart3,  label: "Advanced analytics",     desc: "Deeper bot performance & risk reporting"           },
  { icon: HeadphonesIcon, label: "Dedicated support", desc: "Direct line to a senior account manager"           },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function InfoNote({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 bg-muted/20 border border-border/50 rounded-xl p-3">
      <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-[10px] text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function SectionLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-bold">{title}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Rewards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"tiers" | "rebates" | "referral">("tiers");

  // Demo: user is on Standard tier with $320 cumulative volume traded
  const userVolume = 320;
  const userTierIdx = VOLUME_TIERS.findIndex(
    t => userVolume >= t.minVolume && userVolume <= t.maxVolume
  );
  const userTier = VOLUME_TIERS[userTierIdx] ?? VOLUME_TIERS[0];
  const nextTier = VOLUME_TIERS[userTierIdx + 1];
  const tierProgress = nextTier
    ? Math.round(((userVolume - userTier.minVolume) / (nextTier.minVolume - userTier.minVolume)) * 100)
    : 100;

  const referralCode = getReferralCode(user?.id);
  const referralLink = `https://vixus.trade/register?ref=${referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode).catch(() => {});
    toast({ title: "Referral code copied" });
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: "VIXUS AI — Automated FX Trading",
        text: "I trade with AI-powered bots on VIXUS AI. Join with my link.",
        url: referralLink,
      });
    } else {
      navigator.clipboard.writeText(referralLink).catch(() => {});
      toast({ title: "Referral link copied" });
    }
  };

  return (
    <Layout showNav>
      <div className="pb-28">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Loyalty Programme</h1>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Volume-based rebates and account benefits — the more you trade, the more you earn back.
          </p>
        </div>

        {/* ── Current Tier Summary ─────────────────────────────────────────── */}
        <div className="mx-4 mb-4 bg-card rounded-2xl p-4 border border-border/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Current tier</p>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${userTier.badge}`}>
                  {userTier.name}
                </span>
                <span className="text-base font-bold">{userTier.rebate}</span>
                <span className="text-[10px] text-muted-foreground">cashback</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">30-day volume</p>
              <p className="text-base font-bold">${userVolume.toLocaleString()}</p>
            </div>
          </div>

          {nextTier && (
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                <span>${userVolume.toLocaleString()} traded</span>
                <span>${nextTier.minVolume.toLocaleString()} for {nextTier.name}</span>
              </div>
              <Progress value={tierProgress} className="h-2 bg-muted/30" />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                ${(nextTier.minVolume - userVolume).toLocaleString()} more in 30-day volume to unlock {nextTier.name} tier
              </p>
            </div>
          )}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mx-4 mb-4 bg-muted/20 p-1 rounded-xl">
          {(["tiers", "rebates", "referral"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {tab === "tiers" ? "Account Tiers" : tab === "rebates" ? "Rebates" : "Referrals"}
            </button>
          ))}
        </div>

        {/* ══ TAB: Account Tiers ══════════════════════════════════════════════ */}
        {activeTab === "tiers" && (
          <div className="px-4 space-y-3">
            {VOLUME_TIERS.map((tier, i) => {
              const isActive = tier.name === userTier.name;
              const isLocked = tier.minVolume > userVolume && !isActive;
              return (
                <div
                  key={tier.name}
                  className={`rounded-2xl p-4 border ${tier.color} ${
                    isActive ? "bg-card" : "bg-card/50 opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${tier.badge}`}>
                          {tier.name}
                        </span>
                        {isActive && (
                          <span className="text-[9px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-md">
                            Current
                          </span>
                        )}
                        {isLocked && <Lock className="w-3 h-3 text-muted-foreground/50" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{tier.range} 30-day volume</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{tier.rebate}</p>
                      <p className="text-[9px] text-muted-foreground">cashback</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Spreads",   value: tier.spread    },
                      { label: "Bots",      value: tier.bots      },
                      { label: "Analytics", value: tier.analytics },
                      { label: "Support",   value: tier.support   },
                    ].map(item => (
                      <div key={item.label} className="bg-background/50 rounded-xl px-3 py-2">
                        <p className="text-[9px] text-muted-foreground mb-0.5">{item.label}</p>
                        <p className="text-[10px] font-semibold">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <InfoNote text="Tier status is calculated on your 30-day rolling trading volume across all bots. Tier upgrades take effect on the first business day of the following week." />
          </div>
        )}

        {/* ══ TAB: Rebates ════════════════════════════════════════════════════ */}
        {activeTab === "rebates" && (
          <div className="px-4 space-y-4">
            {/* How it works */}
            <div>
              <SectionLabel title="How rebates work" sub="Calculated per standard lot closed by your bots" />
              <div className="space-y-2">
                {[
                  { step: "1", text: "Your bots execute trades on the FX market" },
                  { step: "2", text: "Each standard lot (100,000 units) closed earns a fixed rebate" },
                  { step: "3", text: "Rebates accrue daily and are credited to your balance monthly" },
                  { step: "4", text: "Higher trading volume = higher tier = higher rebate per lot" },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-3 bg-card rounded-xl p-3">
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">{s.step}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rebate table */}
            <div>
              <SectionLabel title="Rebate schedule" />
              <div className="bg-card rounded-2xl overflow-hidden border border-border/50">
                <div className="grid grid-cols-3 bg-muted/30 px-4 py-2.5">
                  <span className="text-[10px] font-semibold text-muted-foreground">Tier</span>
                  <span className="text-[10px] font-semibold text-muted-foreground text-center">Rate / Lot</span>
                  <span className="text-[10px] font-semibold text-muted-foreground text-right">Monthly Volume</span>
                </div>
                {VOLUME_TIERS.map((tier, i) => {
                  const isActive = tier.name === userTier.name;
                  return (
                    <div
                      key={tier.name}
                      className={`grid grid-cols-3 px-4 py-3 border-t border-border/30 ${isActive ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tier.badge}`}>
                          {tier.name}
                        </span>
                        {isActive && <CheckCircle2 className="w-3 h-3 text-primary" />}
                      </div>
                      <span className="text-[11px] font-bold text-primary text-center">{tier.rebate}</span>
                      <span className="text-[10px] text-muted-foreground text-right">{tier.range}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Estimated earnings */}
            <div>
              <SectionLabel title="Estimated rebate (this month)" sub="Based on your current tier and bot activity" />
              <div className="bg-card rounded-2xl p-4 border border-border/50">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    { label: "Lots traded (MTD)", value: "0.00" },
                    { label: "Rebate per lot",    value: userTier.rebate.split(" ")[0] },
                    { label: "Accrued rebate",    value: "$0.00" },
                    { label: "Next credit date",  value: "1 Aug 2026" },
                  ].map(item => (
                    <div key={item.label} className="bg-background/60 rounded-xl p-3">
                      <p className="text-[9px] text-muted-foreground mb-0.5">{item.label}</p>
                      <p className="text-xs font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
                <InfoNote text="Rebate credits are processed on the 1st of each month and appear in your transaction history. Minimum payout threshold is $1.00." />
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: Referral ════════════════════════════════════════════════════ */}
        {activeTab === "referral" && (
          <div className="px-4 space-y-4">
            {/* Program overview */}
            <div className="bg-card rounded-2xl p-4 border border-border/60">
              <SectionLabel
                title="Introduce a client. Share the rebate."
                sub="Earn a share of the trading rebate generated by anyone you refer — for 12 months."
              />
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Your share",      value: "20%",     sub: "of referred user's rebate" },
                  { label: "Duration",         value: "12 mo",   sub: "from their first trade"    },
                  { label: "Min. activation",  value: "$500",    sub: "deposit to qualify"        },
                ].map(s => (
                  <div key={s.label} className="bg-background/70 rounded-xl p-2.5 text-center">
                    <p className="text-sm font-bold text-primary">{s.value}</p>
                    <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{s.label}</p>
                    <p className="text-[8px] text-muted-foreground/60 leading-tight">{s.sub}</p>
                  </div>
                ))}
              </div>
              <InfoNote text="Your referral earnings are calculated as 20% of the trading rebates your referred client generates. There is no cash-for-signup bonus — earnings are tied solely to your client's trading activity, ensuring a fair and transparent programme." />
            </div>

            {/* Referral code */}
            <div>
              <SectionLabel title="Your referral link" />
              <div className="bg-card rounded-2xl p-4 border border-border/60 space-y-3">
                <div className="flex items-center gap-2 bg-background rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-muted-foreground mb-0.5">Referral code</p>
                    <p className="text-sm font-bold tracking-widest text-primary font-mono">{referralCode}</p>
                  </div>
                  <button
                    onClick={copyCode}
                    className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"
                    aria-label="Copy code"
                  >
                    <Copy className="w-4 h-4 text-primary" />
                  </button>
                  <button
                    onClick={shareLink}
                    className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"
                    aria-label="Share link"
                  >
                    <Share2 className="w-4 h-4 text-primary" />
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-background rounded-xl px-3 py-2.5">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-[9px] text-muted-foreground truncate font-mono">{referralLink}</p>
                </div>
              </div>
            </div>

            {/* Referral stats */}
            <div>
              <SectionLabel title="Your referral activity" />
              <div className="bg-card rounded-2xl p-4 border border-border/60">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    { label: "Referred clients",  value: "0"    },
                    { label: "Active traders",    value: "0"    },
                    { label: "Earned (MTD)",      value: "$0.00"},
                    { label: "Earned (lifetime)", value: "$0.00"},
                  ].map(item => (
                    <div key={item.label} className="bg-background/60 rounded-xl p-3">
                      <p className="text-[9px] text-muted-foreground mb-0.5">{item.label}</p>
                      <p className="text-xs font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
                <InfoNote text="A referred client must deposit a minimum of $500 and execute at least one completed trade to activate your referral earnings. Payments are processed monthly alongside your trading rebates." />
              </div>
            </div>

            {/* How it compares */}
            <div>
              <SectionLabel title="Why no signup bonuses?" />
              <div className="bg-card rounded-2xl p-4 border border-border/60 space-y-3">
                {[
                  {
                    icon: Shield,
                    title: "Regulatory compliance",
                    desc: "Fixed cash-for-signup bonuses are restricted under FCA (UK) and CFTC (US) guidelines. Our programme is structured as a performance-based revenue share.",
                  },
                  {
                    icon: CheckCircle2,
                    title: "No inflated expectations",
                    desc: "We don't promise returns we can't guarantee. Your earnings are a direct function of real trading volume — transparent and auditable.",
                  },
                  {
                    icon: Users,
                    title: "Aligned incentives",
                    desc: "You earn when your clients trade — meaning you're incentivised to refer people who genuinely intend to use the platform, not just collect a signup bonus.",
                  },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-0.5">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Tier benefits summary (always visible) ───────────────────────── */}
        <div className="px-4 mt-6">
          <SectionLabel title="Benefits that grow with your tier" />
          <div className="space-y-2">
            {TIER_BENEFITS.map(b => {
              const Icon = b.icon;
              return (
                <div key={b.label} className="flex items-center gap-3 bg-card rounded-xl px-4 py-3">
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold">{b.label}</p>
                    <p className="text-[10px] text-muted-foreground">{b.desc}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Legal footer ─────────────────────────────────────────────────── */}
        <div className="mx-4 mt-6">
          <p className="text-[9px] text-muted-foreground/50 leading-relaxed text-center">
            VIXUS AI Loyalty Programme terms apply. Rebate rates and tier thresholds are subject to change with 30 days' notice.
            Trading volumes are calculated on closed positions only. Past performance is not indicative of future results.
            FX trading involves significant risk and may not be appropriate for all investors.
          </p>
        </div>

      </div>
    </Layout>
  );
}
