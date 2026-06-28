import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { VixusLogo } from "@/components/VixusLogo";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ShieldCheck, Lock, Zap, TrendingUp, Wallet, Bot, Star, ChevronRight, BadgeCheck, ArrowUpRight } from "lucide-react";

const HERO_CHART = [
  { value: 20 }, { value: 28 }, { value: 24 }, { value: 38 },
  { value: 34 }, { value: 50 }, { value: 46 }, { value: 64 },
  { value: 58 }, { value: 78 }, { value: 72 }, { value: 95 },
];

interface Stat { label: string; value: number; prefix?: string; suffix?: string; decimals?: number; }

const STATS: Stat[] = [
  { label: "Traded Volume", value: 482_000_000, prefix: "$", suffix: "+" },
  { label: "Active Traders", value: 128_400, suffix: "+" },
  { label: "Avg. Uptime", value: 99.9, suffix: "%", decimals: 1 },
  { label: "Bots Running", value: 6_200, suffix: "+" },
];

function formatStat(v: number, s: Stat) {
  let str: string;
  if (v >= 1_000_000) str = (v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1) + "M";
  else if (v >= 1_000) str = (v / 1_000).toFixed(v >= 10_000 ? 0 : 1) + "K";
  else str = v.toFixed(s.decimals ?? 0);
  return `${s.prefix ?? ""}${str}${s.suffix ?? ""}`;
}

function CountUpStat({ stat }: { stat: Stat }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const frame = useRef<number | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1400;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(stat.value * eased);
            if (p < 1) frame.current = requestAnimationFrame(tick);
          };
          frame.current = requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => { observer.disconnect(); if (frame.current) cancelAnimationFrame(frame.current); };
  }, [stat.value]);
  return (
    <div ref={ref} className="bg-card rounded-2xl p-4 border border-white/5">
      <div className="text-2xl font-bold tracking-tight text-foreground">{formatStat(val, stat)}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{stat.label}</div>
    </div>
  );
}

const STEPS = [
  { icon: Wallet, title: "Fund your account", desc: "Deposit in seconds via bank transfer, card, Apple Pay, or crypto.", color: "from-blue-500/20 to-blue-500/5", iconColor: "text-blue-400" },
  { icon: Bot, title: "Pick a trading bot", desc: "Choose from strategies built for every risk appetite.", color: "from-purple-500/20 to-purple-500/5", iconColor: "text-purple-400" },
  { icon: TrendingUp, title: "Track your earnings", desc: "Watch live P&L update around the clock from your dashboard.", color: "from-green-500/20 to-green-500/5", iconColor: "text-green-400" },
];

const TRUST = [
  { icon: Lock, label: "Bank-grade encryption", desc: "256-bit AES encryption on all data" },
  { icon: ShieldCheck, label: "2FA account security", desc: "Multi-layer authentication protection" },
  { icon: BadgeCheck, label: "Transparent reporting", desc: "Full audit trail on every trade" },
];

const TESTIMONIALS = [
  {
    name: "Marcus T.",
    location: "Austin, TX",
    quote: "Setup took five minutes and I can finally see exactly what my bot is doing. The dashboard is clean and the withdrawals were fast.",
    initial: "M",
    color: "from-blue-500 to-cyan-400",
  },
  {
    name: "Danielle R.",
    location: "Chicago, IL",
    quote: "I like that everything is upfront — the risk levels, the fees, the performance history. No guessing games.",
    initial: "D",
    color: "from-pink-500 to-rose-400",
  },
  {
    name: "James K.",
    location: "Dallas, TX",
    quote: "I've been trading crypto for over five years, and this platform strikes the perfect balance. It's simple enough for beginners to get started, yet powerful enough for experienced traders. The market data is accurate, and the trading tools are reliable and easy to use.",
    initial: "J",
    color: "from-amber-500 to-orange-400",
  },
  {
    name: "Amara S.",
    location: "Atlanta, GA",
    quote: "As someone who was new to cryptocurrency, I was pretty nervous at first. But this platform made everything easy to understand and simple to use. The dashboard is clean and user-friendly, and the tutorials gave me the confidence I needed to start trading.",
    initial: "A",
    color: "from-emerald-500 to-teal-400",
  },
];

const FEATURES = [
  { icon: Zap, title: "Lightning Execution", desc: "Trades placed in milliseconds, 24/7" },
  { icon: ShieldCheck, title: "Risk Controls", desc: "Custom stop-loss and take-profit per bot" },
  { icon: TrendingUp, title: "Proven Returns", desc: "Up to 38% monthly gains on top strategies" },
  { icon: Bot, title: "11 Unique Bots", desc: "Forex, crypto, and indices all covered" },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && token) setLocation("/dashboard");
  }, [token, isLoading, setLocation]);

  const handleGetStarted = () => {
    const seen = localStorage.getItem("vixus_onboarding_seen");
    setLocation(seen ? "/register" : "/onboarding");
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-x-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-6">
        <div className="flex items-center gap-2">
          <VixusLogo className="w-8 h-8" />
          <span className="font-bold tracking-tight text-sm">VIXUS<span className="text-primary"> AI</span></span>
        </div>
        <Button variant="ghost" className="h-9 px-4 text-sm font-medium text-muted-foreground" onClick={() => setLocation("/login")}>
          Sign In
        </Button>
      </div>

      {/* Hero */}
      <section className="px-5 pt-8">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-[11px] font-semibold px-3 py-1.5 rounded-full mb-5 border border-primary/20">
          <Zap className="w-3.5 h-3.5 fill-primary" />
          Automated trading, on autopilot
        </div>

        <h1 className="text-[36px] leading-[1.08] font-bold tracking-tight">
          Smart trading bots that{" "}
          <span className="bg-gradient-to-r from-primary via-purple-400 to-blue-400 bg-clip-text text-transparent">
            work while you sleep
          </span>
        </h1>

        <p className="text-muted-foreground text-[15px] leading-relaxed mt-4 max-w-[330px]">
          VIXUS AI puts institutional-grade AI strategies in your pocket. Fund your account, pick a bot, and track every trade in real time.
        </p>

        <div className="mt-6 space-y-3">
          <Button className="w-full h-14 rounded-xl text-[17px] font-semibold shadow-lg shadow-primary/25" onClick={handleGetStarted}>
            Get Started — It's Free
            <ArrowUpRight className="w-5 h-5 ml-1" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">No credit card required · Cancel anytime</p>
        </div>

        {/* Hero chart card */}
        <div className="relative mt-8 bg-card rounded-3xl p-5 overflow-hidden border border-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-xs text-muted-foreground">Portfolio value</span>
              <div className="text-2xl font-bold tracking-tight mt-0.5">$124,815.60</div>
            </div>
            <div className="text-right">
              <span className="text-xs text-green-500 bg-green-500/10 px-2.5 py-1.5 rounded-lg font-semibold border border-green-500/20">
                +37.2% ↑
              </span>
              <div className="text-[10px] text-muted-foreground mt-1.5">This month</div>
            </div>
          </div>
          <div className="h-[110px] w-[calc(100%+10px)] -ml-[5px] mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={HERO_CHART} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="#7C3AED" strokeWidth={3} fillOpacity={1} fill="url(#heroGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] text-muted-foreground">Live trading · Updated just now</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-5 pt-10">
        <div className="grid grid-cols-2 gap-3">
          {STATS.map((s) => <CountUpStat key={s.label} stat={s} />)}
        </div>
      </section>

      {/* Features */}
      <section className="px-5 pt-12">
        <h2 className="text-xl font-bold tracking-tight mb-1">Built to perform</h2>
        <p className="text-sm text-muted-foreground mb-6">Everything you need, nothing you don't.</p>
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card rounded-2xl p-4 border border-white/5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <f.icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="font-semibold text-[13px] leading-tight">{f.title}</div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 pt-12">
        <h2 className="text-xl font-bold tracking-tight mb-1">How it works</h2>
        <p className="text-sm text-muted-foreground mb-6">Start earning in three simple steps.</p>
        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className={`flex items-start gap-4 bg-gradient-to-br ${step.color} rounded-2xl p-4 border border-white/5`}>
              <div className="w-11 h-11 rounded-xl bg-background/50 flex items-center justify-center shrink-0">
                <step.icon className={`w-5 h-5 ${step.iconColor}`} />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-muted-foreground tracking-widest">STEP {i + 1}</span>
                <h3 className="font-semibold text-[15px] mt-0.5">{step.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="px-5 pt-12">
        <div className="bg-gradient-to-br from-card to-card/50 rounded-2xl p-5 border border-white/5 space-y-4">
          <div>
            <h2 className="text-base font-bold tracking-tight">Built for security &amp; transparency</h2>
            <p className="text-xs text-muted-foreground mt-1">Your funds and data are protected at every layer.</p>
          </div>
          {TRUST.map((t) => (
            <div key={t.label} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                <t.icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-[11px] text-muted-foreground">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-5 pt-12">
        <h2 className="text-xl font-bold tracking-tight mb-1">Loved by traders worldwide</h2>
        <p className="text-sm text-muted-foreground mb-6">Real results from real users.</p>
        <div className="space-y-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-card rounded-2xl p-5 border border-white/5">
              <div className="flex gap-0.5 mb-3">
                {Array(5).fill(0).map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{t.quote}</p>
              <div className="flex items-center gap-3 mt-4">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${t.color} flex items-center justify-center text-sm font-bold text-white shrink-0`}>
                  {t.initial}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.location}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 pt-12">
        <div className="relative bg-gradient-to-br from-primary/25 via-primary/10 to-card rounded-3xl p-6 text-center overflow-hidden border border-primary/20">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-primary/15 text-primary text-[11px] font-semibold px-3 py-1 rounded-full mb-4 border border-primary/20">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              128,400+ active traders
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Ready to start trading smarter?</h2>
            <p className="text-sm text-muted-foreground mt-2 mb-5">Join thousands of traders growing their capital on autopilot.</p>
            <Button className="w-full h-14 rounded-xl text-[17px] font-semibold shadow-lg shadow-primary/30" onClick={() => setLocation("/register")}>
              Create Your Free Account
              <ArrowUpRight className="w-5 h-5 ml-1" />
            </Button>
            <p className="text-[11px] text-muted-foreground mt-3">Free to join · No hidden fees</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 pt-10 pb-10">
        <div className="flex items-center gap-2 mb-4">
          <VixusLogo className="w-6 h-6" />
          <span className="font-semibold text-sm">VIXUS AI</span>
        </div>
        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm text-muted-foreground">
          <Link href="/about" className="hover:text-foreground transition-colors flex items-center gap-1">
            About Us <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/legal/terms" className="hover:text-foreground transition-colors flex items-center gap-1">
            Terms of Service <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors flex items-center gap-1">
            Privacy Policy <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed mt-6">
          © {new Date().getFullYear()} VIXUS AI. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
