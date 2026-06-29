import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Gift, Star, Zap, Users, Copy, Share2, CheckCircle2,
  Lock, Flame, Trophy, Target, TrendingUp, Coins, Crown,
  ChevronRight, Calendar, Award, Sparkles,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getReferralCode(userId?: number): string {
  const id = userId ?? 0;
  return `VAI-${String(id).padStart(5, "0")}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type MilestoneStatus = "claimed" | "ready" | "locked";
interface Milestone {
  id: string;
  title: string;
  desc: string;
  reward: string;
  status: MilestoneStatus;
  icon: React.ElementType;
  color: string;
}

interface Challenge {
  id: string;
  title: string;
  desc: string;
  reward: string;
  progress: number;
  total: number;
  icon: React.ElementType;
  color: string;
  expires: string;
}

// ── Static demo data ──────────────────────────────────────────────────────────
const MILESTONES: Milestone[] = [
  { id: "first_deposit",   title: "First Deposit",     desc: "Make your first deposit",             reward: "+$5 Bonus",   status: "ready",   icon: Coins,       color: "text-yellow-400" },
  { id: "first_trade",     title: "First Trade",        desc: "Complete your first bot trade",       reward: "+$2 Bonus",   status: "locked",  icon: TrendingUp,  color: "text-green-400"  },
  { id: "kyc_verified",    title: "KYC Verified",       desc: "Complete identity verification",      reward: "+$10 Bonus",  status: "locked",  icon: CheckCircle2,color: "text-blue-400"   },
  { id: "deposit_100",     title: "$100 Deposited",     desc: "Reach $100 total deposits",           reward: "+$8 Bonus",   status: "locked",  icon: Trophy,      color: "text-purple-400" },
  { id: "refer_3",         title: "Refer 3 Friends",    desc: "Successfully refer 3 users",          reward: "+$15 Bonus",  status: "locked",  icon: Users,       color: "text-pink-400"   },
  { id: "week_streak",     title: "7-Day Streak",       desc: "Check in 7 days in a row",            reward: "+500 Points", status: "locked",  icon: Flame,       color: "text-orange-400" },
];

const CHALLENGES: Challenge[] = [
  { id: "c1", title: "Active Trader",   desc: "Run a bot for 3 consecutive days",       reward: "+$3 Bonus",   progress: 1, total: 3, icon: Zap,        color: "bg-purple-500/15 text-purple-400", expires: "3d left"  },
  { id: "c2", title: "Profit Hunter",   desc: "Earn $20 total from bot trades",          reward: "+$5 Bonus",   progress: 0, total: 20,icon: Target,     color: "bg-green-500/15 text-green-400",   expires: "6d left"  },
  { id: "c3", title: "Invite Friend",   desc: "Get 1 person to register with your code", reward: "+$10 Bonus", progress: 0, total: 1, icon: Users,      color: "bg-blue-500/15 text-blue-400",     expires: "14d left" },
];

const VIP_TIERS = [
  { name: "Bronze",   min: 0,    max: 499,  color: "from-orange-700 to-orange-500", icon: "🥉" },
  { name: "Silver",   min: 500,  max: 1999, color: "from-slate-400 to-slate-300",   icon: "🥈" },
  { name: "Gold",     min: 2000, max: 4999, color: "from-yellow-500 to-yellow-300", icon: "🥇" },
  { name: "Platinum", min: 5000, max: 9999, color: "from-cyan-500 to-blue-400",     icon: "💎" },
  { name: "Diamond",  min: 10000,max: Infinity, color: "from-purple-500 to-pink-400", icon: "👑" },
];

const CHECK_IN_DAYS = [
  { day: "Mon", reward: "+20 pts", claimed: true  },
  { day: "Tue", reward: "+20 pts", claimed: true  },
  { day: "Wed", reward: "+30 pts", claimed: true  },
  { day: "Thu", reward: "+30 pts", claimed: false, today: true },
  { day: "Fri", reward: "+50 pts", claimed: false },
  { day: "Sat", reward: "+50 pts", claimed: false },
  { day: "Sun", reward: "+100 pts",claimed: false },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-bold leading-none">{title}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function MilestoneCard({ m, onClaim }: { m: Milestone; onClaim: (id: string) => void }) {
  const Icon = m.icon;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
      m.status === "claimed" ? "bg-muted/30 opacity-60" :
      m.status === "ready"   ? "bg-card border border-primary/40 shadow-sm shadow-primary/10" :
      "bg-card/50"
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        m.status === "locked" ? "bg-muted/30" : "bg-card"
      }`}>
        {m.status === "locked"
          ? <Lock className="w-4 h-4 text-muted-foreground/40" />
          : <Icon className={`w-5 h-5 ${m.color}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{m.title}</p>
        <p className="text-[10px] text-muted-foreground">{m.desc}</p>
      </div>
      <div className="shrink-0 text-right">
        {m.status === "claimed" ? (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <CheckCircle2 className="w-3 h-3 text-green-400" /> Done
          </span>
        ) : m.status === "ready" ? (
          <button
            onClick={() => onClaim(m.id)}
            className="text-[10px] font-bold bg-primary text-white px-2.5 py-1 rounded-lg"
          >
            {m.reward}
          </button>
        ) : (
          <span className="text-[10px] font-semibold text-muted-foreground/60">{m.reward}</span>
        )}
      </div>
    </div>
  );
}

function ChallengeCard({ c }: { c: Challenge }) {
  const Icon = c.icon;
  const pct = Math.min(100, (c.progress / c.total) * 100);
  return (
    <div className="bg-card rounded-2xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.color.split(" ")[0]}`}>
            <Icon className={`w-4.5 h-4.5 ${c.color.split(" ")[1]}`} />
          </div>
          <div>
            <p className="text-xs font-bold">{c.title}</p>
            <p className="text-[10px] text-muted-foreground">{c.desc}</p>
          </div>
        </div>
        <span className="text-[9px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full shrink-0">{c.expires}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{c.progress}/{c.total}</span>
          <span className="font-semibold text-primary">{c.reward}</span>
        </div>
        <Progress value={pct} className="h-1.5 bg-muted/30" />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Rewards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [milestones, setMilestones] = useState<Milestone[]>(MILESTONES);
  const [checkedIn, setCheckedIn] = useState(false);
  const [points] = useState(320);

  const referralCode = getReferralCode(user?.id);
  const referralLink = `https://vixus.trade/register?ref=${referralCode}`;

  const currentTier = VIP_TIERS.find(t => points >= t.min && points <= t.max) ?? VIP_TIERS[0];
  const nextTier = VIP_TIERS[VIP_TIERS.indexOf(currentTier) + 1];
  const tierProgress = nextTier
    ? Math.round(((points - currentTier.min) / (nextTier.min - currentTier.min)) * 100)
    : 100;

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode).catch(() => {});
    toast({ title: "Referral code copied!", description: referralCode });
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: "Join VIXUS AI", text: "Start earning with AI trading bots!", url: referralLink });
    } else {
      navigator.clipboard.writeText(referralLink).catch(() => {});
      toast({ title: "Link copied!", description: referralLink });
    }
  };

  const handleClaim = (id: string) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, status: "claimed" as MilestoneStatus } : m));
    toast({ title: "Reward claimed!", description: "Bonus added to your account." });
  };

  const handleCheckIn = () => {
    if (checkedIn) return;
    setCheckedIn(true);
    toast({ title: "Daily check-in complete!", description: "+30 Points added to your account." });
  };

  return (
    <Layout showNav>
      <div className="pb-28">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Reward Hub</h1>
          </div>
          <p className="text-xs text-muted-foreground">Earn bonuses, complete challenges & climb the ranks</p>
        </div>

        {/* ── VIP Tier Card ───────────────────────────────────────────────── */}
        <div className={`mx-4 mb-4 rounded-2xl p-4 bg-gradient-to-br ${currentTier.color} relative overflow-hidden`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/30" />
            <div className="absolute -right-4 bottom-0 w-20 h-20 rounded-full bg-white/20" />
          </div>
          <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] font-medium text-white/70 uppercase tracking-wider">Your Tier</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xl">{currentTier.icon}</span>
                  <span className="text-lg font-bold text-white">{currentTier.name}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/70 uppercase tracking-wider">Points</p>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <Star className="w-3.5 h-3.5 text-white fill-white" />
                  <span className="text-lg font-bold text-white">{points.toLocaleString()}</span>
                </div>
              </div>
            </div>
            {nextTier && (
              <div>
                <div className="flex justify-between text-[10px] text-white/70 mb-1">
                  <span>{points} pts</span>
                  <span>{nextTier.min} pts to {nextTier.icon} {nextTier.name}</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/80 rounded-full transition-all"
                    style={{ width: `${tierProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-white/60 mt-1">{nextTier.min - points} more points to next tier</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Daily Check-in ──────────────────────────────────────────────── */}
        <div className="mx-4 mb-4 bg-card rounded-2xl p-4">
          <SectionHeader icon={Calendar} title="Daily Check-in" sub="Claim points every day to build your streak" />

          <div className="grid grid-cols-7 gap-1 mb-3">
            {CHECK_IN_DAYS.map((d, i) => (
              <div
                key={i}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-xl text-center transition-all ${
                  d.claimed
                    ? "bg-primary/15 border border-primary/30"
                    : d.today
                    ? "bg-card border border-primary/60 shadow-sm shadow-primary/20"
                    : "bg-muted/20 border border-transparent"
                }`}
              >
                <span className="text-[9px] text-muted-foreground font-medium">{d.day}</span>
                {d.claimed ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : d.today ? (
                  <Flame className={`w-4 h-4 ${checkedIn ? "text-primary" : "text-orange-400"}`} />
                ) : (
                  <Gift className="w-4 h-4 text-muted-foreground/30" />
                )}
                <span className={`text-[8px] font-semibold leading-tight ${
                  d.claimed ? "text-primary" :
                  d.today ? "text-orange-400" : "text-muted-foreground/40"
                }`}>{d.reward}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-orange-400 bg-orange-400/10 px-2.5 py-1 rounded-lg">
              <Flame className="w-3.5 h-3.5 fill-orange-400" />
              <span className="text-xs font-bold">3-Day Streak!</span>
            </div>
            <Button
              onClick={handleCheckIn}
              disabled={checkedIn}
              size="sm"
              className="flex-1 h-9 rounded-xl text-xs font-semibold"
            >
              {checkedIn ? (
                <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Claimed Today</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Claim +30 Points</>
              )}
            </Button>
          </div>
        </div>

        {/* ── Referral Program ────────────────────────────────────────────── */}
        <div className="mx-4 mb-4 bg-card rounded-2xl p-4">
          <SectionHeader icon={Users} title="Referral Program" sub="Earn $5 for every friend who joins & deposits" />

          {/* Referral code box */}
          <div className="flex items-center gap-2 bg-background rounded-xl p-3 mb-3">
            <div className="flex-1">
              <p className="text-[9px] text-muted-foreground mb-0.5">Your Referral Code</p>
              <p className="text-base font-bold tracking-widest text-primary">{referralCode}</p>
            </div>
            <button
              onClick={copyCode}
              className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"
            >
              <Copy className="w-4 h-4 text-primary" />
            </button>
            <button
              onClick={shareLink}
              className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"
            >
              <Share2 className="w-4 h-4 text-primary" />
            </button>
          </div>

          {/* Referral stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "Total Referrals", value: "0",    sub: "friends joined" },
              { label: "Earned",          value: "$0",   sub: "from referrals" },
              { label: "Pending",         value: "$0",   sub: "awaiting deposit" },
            ].map((s, i) => (
              <div key={i} className="bg-background rounded-xl p-2.5 text-center">
                <p className="text-sm font-bold">{s.value}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-2">
            <Star className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Share your code and earn <span className="text-primary font-semibold">$5</span> when your friend makes their first deposit, plus <span className="text-primary font-semibold">5%</span> of their bot earnings for 30 days.
            </p>
          </div>
        </div>

        {/* ── Achievements ────────────────────────────────────────────────── */}
        <div className="mx-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon={Award} title="Achievements" />
            <span className="text-[10px] text-muted-foreground">
              {milestones.filter(m => m.status === "claimed").length}/{milestones.length} done
            </span>
          </div>
          <div className="space-y-2">
            {milestones.map(m => (
              <MilestoneCard key={m.id} m={m} onClaim={handleClaim} />
            ))}
          </div>
        </div>

        {/* ── Active Challenges ────────────────────────────────────────────── */}
        <div className="mx-4 mb-4">
          <SectionHeader icon={Target} title="Active Challenges" sub="Limited-time trading missions" />
          <div className="space-y-3">
            {CHALLENGES.map(c => (
              <ChallengeCard key={c.id} c={c} />
            ))}
          </div>
        </div>

        {/* ── Leaderboard teaser ───────────────────────────────────────────── */}
        <div className="mx-4 mb-4">
          <div className="bg-gradient-to-r from-purple-900/60 to-purple-700/30 border border-purple-500/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
              <Crown className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Leaderboard</p>
              <p className="text-[10px] text-muted-foreground">Top traders win up to $500 monthly</p>
            </div>
            <div className="flex items-center gap-1 text-purple-400">
              <span className="text-[10px] font-semibold">Coming Soon</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
