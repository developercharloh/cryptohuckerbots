import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { VixusLogo } from "@/components/VixusLogo";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import {
  ShieldCheck, Lock, Zap, TrendingUp, Bot,
  Star, ArrowRight, ArrowUpRight, ArrowDownRight,
  Activity, ChevronRight, Globe, Clock,
} from "lucide-react";

const CHART_DATA = [
  { v: 18 }, { v: 22 }, { v: 20 }, { v: 31 }, { v: 27 },
  { v: 42 }, { v: 38 }, { v: 55 }, { v: 51 }, { v: 70 },
  { v: 66 }, { v: 88 }, { v: 84 }, { v: 98 },
];

const TICKER_PAIRS = [
  { pair: "EUR/USD", val: "1.0847", chg: "+0.12%", up: true },
  { pair: "GBP/USD", val: "1.2703", chg: "+0.08%", up: true },
  { pair: "USD/JPY", val: "157.42", chg: "-0.21%", up: false },
  { pair: "XAU/USD", val: "2,341", chg: "+0.44%", up: true },
  { pair: "BTC/USD", val: "67,812", chg: "+1.87%", up: true },
  { pair: "USD/CHF", val: "0.9071", chg: "-0.07%", up: false },
  { pair: "AUD/USD", val: "0.6548", chg: "+0.15%", up: true },
  { pair: "NAS100", val: "18,942", chg: "+0.63%", up: true },
];

const LIVE_TRADES = [
  { pair: "EUR/USD", dir: "BUY", lot: "0.50", pnl: "+$48.20", up: true },
  { pair: "XAU/USD", dir: "BUY", lot: "0.10", pnl: "+$91.60", up: true },
  { pair: "GBP/JPY", dir: "SELL", lot: "0.30", pnl: "+$23.80", up: true },
  { pair: "BTC/USD", dir: "BUY", lot: "0.02", pnl: "+$134.00", up: true },
];

const STATS = [
  { value: "$482M+", label: "Volume traded" },
  { value: "128K+", label: "Active traders" },
  { value: "99.9%", label: "Bot uptime" },
  { value: "38%", label: "Avg monthly gain" },
];

const FEATURES = [
  { icon: Zap, title: "Sub-ms execution", desc: "Orders filled in microseconds — never miss an entry again." },
  { icon: Activity, title: "Live P&L tracking", desc: "Every open trade visible in real time, down to the cent." },
  { icon: ShieldCheck, title: "Hard risk limits", desc: "Set max drawdown per bot and sleep without worry." },
  { icon: Globe, title: "11 markets covered", desc: "Forex, crypto, commodities, and indices — all automated." },
];

const STEPS = [
  {
    n: "01", title: "Fund your account",
    desc: "Deposit via bank transfer, card, or crypto in under two minutes.",
    tag: "Instant funding",
  },
  {
    n: "02", title: "Pick your strategy",
    desc: "Browse bots by risk profile, asset class, and historical performance.",
    tag: "11 bots available",
  },
  {
    n: "03", title: "Let it run",
    desc: "The bot trades around the clock. You watch the P&L grow.",
    tag: "24 / 7 automation",
  },
];

const TESTIMONIALS = [
  {
    name: "Marcus T.", loc: "Austin, TX", init: "M",
    color: "#3B82F6",
    quote: "Setup took five minutes. Dashboard is clean, withdrawals hit same day. I've tried four platforms — this one I actually stuck with.",
    stat: "+$4,200 first month",
  },
  {
    name: "James K.", loc: "Dallas, TX", init: "J",
    color: "#F59E0B",
    quote: "I trade my own account too, so I know what fast execution looks like. These bots fill at the right price — no requotes, no slippage surprises.",
    stat: "5 years trading experience",
  },
  {
    name: "Danielle R.", loc: "Chicago, IL", init: "D",
    color: "#EC4899",
    quote: "The risk controls are what sold me. I set a 5% drawdown cap and it has never been breached. Everything is upfront.",
    stat: "Consistent since month 1",
  },
];

function TickerBar() {
  const ref = useRef<HTMLDivElement>(null);
  const items = [...TICKER_PAIRS, ...TICKER_PAIRS];
  return (
    <div className="w-full overflow-hidden border-y" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
      <div
        ref={ref}
        className="flex gap-0 whitespace-nowrap"
        style={{ animation: "ticker 28s linear infinite" }}
      >
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-2 px-6 py-2.5 shrink-0 border-r" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="text-xs font-mono font-semibold" style={{ color: "#94A3B8" }}>{t.pair}</span>
            <span className="text-xs font-mono font-bold" style={{ color: "#F1F5F9" }}>{t.val}</span>
            <span className="text-xs font-mono font-semibold" style={{ color: t.up ? "#22C55E" : "#EF4444" }}>
              {t.up ? "▲" : "▼"} {t.chg}
            </span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
      `}</style>
    </div>
  );
}

function LiveTradeRow({ trade, delay }: { trade: typeof LIVE_TRADES[0]; delay: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div
      className="flex items-center justify-between py-2 border-b transition-all duration-500"
      style={{ borderColor: "rgba(255,255,255,0.06)", opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(-8px)" }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: trade.dir === "BUY" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: trade.dir === "BUY" ? "#22C55E" : "#EF4444" }}
        >
          {trade.dir}
        </div>
        <span className="text-xs font-mono" style={{ color: "#CBD5E1" }}>{trade.pair}</span>
        <span className="text-[10px]" style={{ color: "#64748B" }}>{trade.lot} lot</span>
      </div>
      <span className="text-xs font-mono font-bold" style={{ color: "#22C55E" }}>{trade.pnl}</span>
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const { token, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isLoading && token) setLocation("/dashboard");
  }, [token, isLoading, setLocation]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const handleStart = () => {
    const seen = localStorage.getItem("vixus_onboarding_seen");
    setLocation(seen ? "/register" : "/onboarding");
  };

  return (
    <div style={{ background: "#080C17", color: "#F1F5F9", fontFamily: "inherit", minHeight: "100dvh", overflowX: "hidden" }}>

      {/* Nav */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-5 py-4 transition-all"
        style={{ background: scrolled ? "rgba(8,12,23,0.92)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent" }}
      >
        <div className="flex items-center gap-2.5">
          <VixusLogo className="w-7 h-7" />
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.04em" }}>
            VIXUS<span style={{ color: "#22C55E" }}> AI</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/login")}
            style={{ fontSize: 13, fontWeight: 500, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: "6px 12px" }}
          >
            Sign in
          </button>
          <button
            onClick={handleStart}
            style={{ fontSize: 13, fontWeight: 600, color: "#080C17", background: "#22C55E", border: "none", borderRadius: 8, cursor: "pointer", padding: "8px 16px" }}
          >
            Get started
          </button>
        </div>
      </header>

      {/* Ticker */}
      <TickerBar />

      {/* Hero */}
      <section style={{ padding: "48px 20px 0" }}>
        <div
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 100, padding: "5px 12px", marginBottom: 24 }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#22C55E", letterSpacing: "0.05em" }}>LIVE — Markets open now</span>
        </div>

        <h1 style={{ fontSize: 38, lineHeight: 1.06, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16 }}>
          Trade smarter.<br />
          <span style={{ color: "#22C55E" }}>Automate</span> the rest.
        </h1>

        <p style={{ fontSize: 15, lineHeight: 1.65, color: "#94A3B8", maxWidth: 320, marginBottom: 28 }}>
          Institutional-grade bots handle your entries, exits, and risk management — 24 hours a day, across forex, crypto, and commodities.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
          <button
            onClick={handleStart}
            style={{
              width: "100%", height: 54, borderRadius: 12, fontSize: 16, fontWeight: 700,
              background: "#22C55E", color: "#080C17", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 0 32px rgba(34,197,94,0.25)",
            }}
          >
            Start Trading Free <ArrowRight size={18} />
          </button>
          <p style={{ textAlign: "center", fontSize: 11, color: "#475569" }}>No credit card · Cancel any time</p>
        </div>

        {/* Hero card */}
        <div style={{ background: "#0E1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 16, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 10, color: "#64748B", marginBottom: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>Portfolio value</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", fontFamily: "monospace" }}>$124,815.60</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "5px 10px" }}>
                <ArrowUpRight size={13} style={{ color: "#22C55E" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", fontFamily: "monospace" }}>+37.2%</span>
              </div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 5 }}>30-day return</div>
            </div>
          </div>

          <div style={{ height: 100, marginTop: 8, marginLeft: -4, marginRight: -4 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CHART_DATA} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#22C55E" strokeWidth={2.5} fill="url(#g)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 8, paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Open trades</div>
            {LIVE_TRADES.map((t, i) => (
              <LiveTradeRow key={i} trade={t} delay={i * 180} />
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, color: "#475569" }}>Bot running · last trade 4 seconds ago</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: "40px 20px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ background: "#0E1422", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#F1F5F9", fontFamily: "monospace" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "48px 20px 0" }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>What's under the hood</h2>
          <p style={{ fontSize: 13, color: "#64748B" }}>Built by traders, for traders.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{
                background: "#0E1422",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: "16px 18px",
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: i % 2 === 0 ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <f.icon size={18} style={{ color: i % 2 === 0 ? "#22C55E" : "#60A5FA" }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: "48px 20px 0" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>Up and running in minutes</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 28 }}>Three steps. No experience required.</p>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ display: "flex", gap: 16, marginBottom: i < STEPS.length - 1 ? 0 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "1.5px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#22C55E", fontFamily: "monospace" }}>{s.n}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 1, flexGrow: 1, background: "rgba(34,197,94,0.15)", margin: "4px 0" }} />
              )}
            </div>
            <div style={{ paddingBottom: i < STEPS.length - 1 ? 28 : 0, paddingTop: 8 }}>
              <div style={{ display: "inline-block", fontSize: 10, fontWeight: 600, color: "#22C55E", letterSpacing: "0.07em", background: "rgba(34,197,94,0.1)", borderRadius: 4, padding: "2px 7px", marginBottom: 6 }}>{s.tag}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Security strip */}
      <section style={{ padding: "40px 20px 0" }}>
        <div style={{ background: "#0E1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase" }}>Security & compliance</div>
          {[
            { icon: Lock, label: "256-bit AES encryption", detail: "All data encrypted in transit and at rest" },
            { icon: ShieldCheck, label: "2FA on every account", detail: "Multi-layer authentication by default" },
            { icon: Clock, label: "Full trade audit trail", detail: "Every order logged with timestamp and price" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <item.icon size={16} style={{ color: "#22C55E" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ padding: "48px 20px 0" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>What traders are saying</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>Unfiltered. No marketing speak.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              style={{ background: "#0E1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "18px 18px 16px" }}
            >
              <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
                {[1,2,3,4,5].map((i) => <Star key={i} size={13} style={{ color: "#F59E0B", fill: "#F59E0B" }} />)}
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: "#CBD5E1", marginBottom: 16 }}>"{t.quote}"</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>{t.init}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{t.loc}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#22C55E", background: "rgba(34,197,94,0.1)", borderRadius: 6, padding: "3px 8px", textAlign: "right" }}>{t.stat}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: "48px 20px 32px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(14,20,34,1) 60%)",
            border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 22,
            padding: "28px 22px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 100, padding: "4px 12px", marginBottom: 16 }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E", display: "inline-block", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#22C55E", letterSpacing: "0.06em" }}>128,400+ TRADERS ACTIVE</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10, lineHeight: 1.15 }}>
              Your capital deserves to work harder.
            </h2>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 22, lineHeight: 1.65 }}>
              Join traders who stopped watching charts and started letting the bots do it.
            </p>
            <button
              onClick={() => setLocation("/register")}
              style={{
                width: "100%", height: 52, borderRadius: 12, fontSize: 15, fontWeight: 700,
                background: "#22C55E", color: "#080C17", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 0 40px rgba(34,197,94,0.2)",
              }}
            >
              Open Free Account <ArrowRight size={17} />
            </button>
            <p style={{ textAlign: "center", fontSize: 11, color: "#334155", marginTop: 10 }}>Free to start · Withdraw anytime</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "0 20px 40px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <VixusLogo className="w-5 h-5" />
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.04em" }}>VIXUS <span style={{ color: "#22C55E" }}>AI</span></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginBottom: 24 }}>
          {[
            { label: "Terms of Service", href: "/legal/terms" },
            { label: "Privacy Policy", href: "/legal/privacy" },
            { label: "About Us", href: "/about" },
          ].map((l) => (
            <Link key={l.href} href={l.href} style={{ fontSize: 12, color: "#475569", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              {l.label} <ChevronRight size={12} />
            </Link>
          ))}
        </div>
        <p style={{ fontSize: 10, color: "#1E293B", lineHeight: 1.7 }}>
          © {new Date().getFullYear()} VIXUS AI. Trading involves risk. Past performance is not indicative of future results.
        </p>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
