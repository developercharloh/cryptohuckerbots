import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { VixusLogo } from "@/components/VixusLogo";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import {
  ShieldCheck, Lock, Zap, Star, ArrowRight,
  ArrowUpRight, Activity, ChevronRight, Globe, Clock,
  TrendingUp, Bot, Cpu, BarChart2,
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
  { pair: "XAU/USD", val: "2,341",  chg: "+0.44%", up: true },
  { pair: "BTC/USD", val: "67,812", chg: "+1.87%", up: true },
  { pair: "USD/CHF", val: "0.9071", chg: "-0.07%", up: false },
  { pair: "AUD/USD", val: "0.6548", chg: "+0.15%", up: true },
  { pair: "NAS100",  val: "18,942", chg: "+0.63%", up: true },
];

const LIVE_TRADES = [
  { pair: "EUR/USD", dir: "BUY",  lot: "0.50", pnl: "+$48.20",  up: true },
  { pair: "XAU/USD", dir: "BUY",  lot: "0.10", pnl: "+$91.60",  up: true },
  { pair: "GBP/JPY", dir: "SELL", lot: "0.30", pnl: "+$23.80",  up: true },
  { pair: "BTC/USD", dir: "BUY",  lot: "0.02", pnl: "+$134.00", up: true },
];

const STATS = [
  { value: "$482M+", label: "Volume traded" },
  { value: "128K+",  label: "Active traders" },
  { value: "99.9%",  label: "Bot uptime" },
  { value: "38%",    label: "Avg monthly gain" },
];

const FEATURES = [
  { icon: Zap,       title: "Sub-ms execution",    desc: "Orders filled in microseconds — never miss an entry again." },
  { icon: Activity,  title: "Live P&L tracking",   desc: "Every open trade visible in real time, down to the cent." },
  { icon: ShieldCheck, title: "Hard risk limits",  desc: "Set max drawdown per bot and sleep without worry." },
  { icon: Globe,     title: "11 markets covered",  desc: "Forex, crypto, commodities, and indices — all automated." },
];

const STEPS = [
  { n: "01", title: "Fund your account",   desc: "Deposit via bank transfer, card, or crypto in under two minutes.",          tag: "Instant funding" },
  { n: "02", title: "Pick your strategy",  desc: "Browse bots by risk profile, asset class, and historical performance.",    tag: "11 bots available" },
  { n: "03", title: "Let it run",          desc: "The bot trades around the clock. You watch the P&L grow.",                 tag: "24/7 automation" },
];

const TESTIMONIALS = [
  { name: "Marcus T.",   loc: "Austin, TX",   init: "M", color: "#7C3AED", quote: "Setup took five minutes. Dashboard is clean, withdrawals hit same day. I've tried four platforms — this one I actually stuck with.", stat: "+$4,200 first month" },
  { name: "James K.",   loc: "Dallas, TX",    init: "J", color: "#4F46E5", quote: "I trade my own account too, so I know what fast execution looks like. These bots fill at the right price — no requotes, no slippage surprises.", stat: "5 years trading exp." },
  { name: "Danielle R.", loc: "Chicago, IL",  init: "D", color: "#6D28D9", quote: "The risk controls are what sold me. I set a 5% drawdown cap and it has never been breached. Everything is upfront.", stat: "Consistent since month 1" },
];

const WHY_CHOOSE = [
  { icon: Lock,       label: "Bank Level Security",       sub: "256-bit AES" },
  { icon: Zap,        label: "Fast & Secure Transactions", sub: "Instant" },
  { icon: Bot,        label: "24/7 Customer Support",      sub: "Always on" },
  { icon: BarChart2,  label: "Advanced Charting Tools",    sub: "Real-time" },
  { icon: Cpu,        label: "AI-Powered Automation",      sub: "Smart bots" },
  { icon: TrendingUp, label: "Trusted by Traders",         sub: "128K+ users" },
];

function TickerBar() {
  const items = [...TICKER_PAIRS, ...TICKER_PAIRS];
  return (
    <div className="w-full overflow-hidden" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
      <div className="flex whitespace-nowrap" style={{ animation: "ticker 28s linear infinite" }}>
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-2 px-5 py-2 shrink-0" style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-xs font-mono font-semibold" style={{ color: "#94A3B8" }}>{t.pair}</span>
            <span className="text-xs font-mono font-bold" style={{ color: "#F1F5F9" }}>{t.val}</span>
            <span className="text-xs font-mono" style={{ color: t.up ? "#A78BFA" : "#EF4444" }}>
              {t.up ? "▲" : "▼"} {t.chg}
            </span>
          </div>
        ))}
      </div>
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
      className="flex items-center justify-between py-2 transition-all duration-500"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(-8px)" }}
    >
      <div className="flex items-center gap-2">
        <div className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: trade.dir === "BUY" ? "rgba(167,139,250,0.15)" : "rgba(239,68,68,0.15)", color: trade.dir === "BUY" ? "#A78BFA" : "#EF4444" }}>
          {trade.dir}
        </div>
        <span className="text-xs font-mono" style={{ color: "#CBD5E1" }}>{trade.pair}</span>
        <span className="text-[10px]" style={{ color: "#64748B" }}>{trade.lot} lot</span>
      </div>
      <span className="text-xs font-mono font-bold" style={{ color: "#A78BFA" }}>{trade.pnl}</span>
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

  const BG = "#07091A";
  const CARD = "rgba(20,16,48,0.85)";
  const BORDER = "rgba(124,58,237,0.2)";
  const PURPLE = "#7C3AED";
  const LIGHT_PURPLE = "#A78BFA";

  return (
    <div style={{ background: BG, color: "#F1F5F9", fontFamily: "inherit", minHeight: "100dvh", overflowX: "hidden" }}>

      {/* Nav */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-5 py-3.5 transition-all"
        style={{
          background: scrolled ? "rgba(7,9,26,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(124,58,237,0.15)" : "1px solid transparent",
        }}
      >
        <div className="flex items-center gap-2">
          <VixusLogo className="w-7 h-7" />
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.04em" }}>
            VIXUS<span style={{ color: LIGHT_PURPLE }}> AI</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocation("/login")}
            style={{ fontSize: 13, fontWeight: 500, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: "6px 14px" }}
          >
            Sign in
          </button>
          <button
            onClick={handleStart}
            style={{
              fontSize: 13, fontWeight: 700, color: "#fff",
              background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
              border: "none", borderRadius: 10, cursor: "pointer", padding: "8px 18px",
              boxShadow: "0 0 20px rgba(124,58,237,0.4)",
            }}
          >
            Get started
          </button>
        </div>
      </header>

      {/* Ticker */}
      <TickerBar />

      {/* Purple glow orbs */}
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, height: 400, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -80, left: "20%", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: 60, right: "10%", width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)" }} />
      </div>

      {/* Hero */}
      <section style={{ padding: "44px 20px 0", position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 100, padding: "5px 14px", marginBottom: 22 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: LIGHT_PURPLE, display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: LIGHT_PURPLE, letterSpacing: "0.06em" }}>LIVE — Markets open now</span>
        </div>

        <h1 style={{ fontSize: 36, lineHeight: 1.08, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 14 }}>
          Trade Smarter.<br />
          <span style={{ background: "linear-gradient(135deg, #A78BFA, #7C3AED)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Automate</span>{" "}
          <span style={{ color: "#F1F5F9" }}>the Rest.</span>
        </h1>

        <p style={{ fontSize: 14, lineHeight: 1.65, color: "#94A3B8", maxWidth: 310, marginBottom: 28 }}>
          Institutional-grade AI bots handle your entries, exits, and risk management — 24 hours a day, across forex, crypto, and commodities.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
          <button
            onClick={handleStart}
            style={{
              width: "100%", height: 54, borderRadius: 14, fontSize: 16, fontWeight: 700,
              background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
              color: "#fff", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 8px 32px rgba(124,58,237,0.45)",
            }}
          >
            Start Trading Free <ArrowRight size={18} />
          </button>
          <p style={{ textAlign: "center", fontSize: 11, color: "#475569" }}>No credit card · Cancel any time</p>
        </div>

        {/* Hero card */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 16, overflow: "hidden", position: "relative", backdropFilter: "blur(12px)" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 10, color: "#64748B", marginBottom: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>Portfolio value</div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", fontFamily: "monospace" }}>$124,815.60</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 8, padding: "5px 10px" }}>
                <ArrowUpRight size={13} style={{ color: LIGHT_PURPLE }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: LIGHT_PURPLE, fontFamily: "monospace" }}>+37.2%</span>
              </div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 5 }}>30-day return</div>
            </div>
          </div>

          <div style={{ height: 90, marginTop: 8, marginLeft: -4, marginRight: -4 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CHART_DATA} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#A78BFA" strokeWidth={2.5} fill="url(#g)" dot={false} />
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
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: LIGHT_PURPLE, display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, color: "#475569" }}>Bot running · last trade 4 seconds ago</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: "36px 20px 0", position: "relative", zIndex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 16px", backdropFilter: "blur(8px)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 60, height: 60, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)" }} />
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: i % 2 === 0 ? "#A78BFA" : "#F1F5F9", fontFamily: "monospace" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "44px 20px 0", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>What's under the hood</h2>
          <p style={{ fontSize: 13, color: "#64748B" }}>Built by traders, for traders.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 16, padding: "16px 18px",
                display: "flex", alignItems: "flex-start", gap: 14,
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: i % 2 === 0 ? "rgba(124,58,237,0.15)" : "rgba(79,70,229,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                border: `1px solid ${i % 2 === 0 ? "rgba(124,58,237,0.25)" : "rgba(79,70,229,0.25)"}`,
              }}>
                <f.icon size={18} style={{ color: LIGHT_PURPLE }} />
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
      <section style={{ padding: "44px 20px 0", position: "relative", zIndex: 1 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>Up and running in minutes</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 28 }}>Three steps. No experience required.</p>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ display: "flex", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.2))",
                border: "1.5px solid rgba(124,58,237,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: LIGHT_PURPLE, fontFamily: "monospace" }}>{s.n}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 1, flexGrow: 1, background: "rgba(124,58,237,0.2)", margin: "4px 0" }} />
              )}
            </div>
            <div style={{ paddingBottom: i < STEPS.length - 1 ? 28 : 0, paddingTop: 8 }}>
              <div style={{ display: "inline-block", fontSize: 10, fontWeight: 600, color: LIGHT_PURPLE, letterSpacing: "0.07em", background: "rgba(124,58,237,0.1)", borderRadius: 4, padding: "2px 8px", marginBottom: 6, border: "1px solid rgba(124,58,237,0.2)" }}>{s.tag}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Security */}
      <section style={{ padding: "36px 20px 0", position: "relative", zIndex: 1 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "20px 18px", backdropFilter: "blur(12px)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Security & compliance</div>
          {[
            { icon: Lock,        label: "256-bit AES encryption", detail: "All data encrypted in transit and at rest" },
            { icon: ShieldCheck, label: "2FA on every account",   detail: "Multi-layer authentication by default" },
            { icon: Clock,       label: "Full trade audit trail", detail: "Every order logged with timestamp and price" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <item.icon size={16} style={{ color: LIGHT_PURPLE }} />
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
      <section style={{ padding: "44px 20px 0", position: "relative", zIndex: 1 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>What traders are saying</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 22 }}>Unfiltered. No marketing speak.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {TESTIMONIALS.map((t) => (
            <div key={t.name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "18px 18px 16px", backdropFilter: "blur(8px)" }}>
              <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
                {[1,2,3,4,5].map((i) => <Star key={i} size={12} style={{ color: LIGHT_PURPLE, fill: LIGHT_PURPLE }} />)}
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: "#CBD5E1", marginBottom: 16 }}>"{t.quote}"</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: "#fff",
                  }}>{t.init}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{t.loc}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: LIGHT_PURPLE, background: "rgba(124,58,237,0.12)", borderRadius: 6, padding: "3px 8px" }}>{t.stat}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why choose */}
      <section style={{ padding: "44px 20px 0", position: "relative", zIndex: 1 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4, textAlign: "center" }}>Why Traders Choose VIXUS AI</h2>
        <p style={{ fontSize: 12, color: "#64748B", marginBottom: 22, textAlign: "center" }}>Secured & Trusted</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {WHY_CHOOSE.map((w) => (
            <div key={w.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 10px", textAlign: "center", backdropFilter: "blur(8px)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
                <w.icon size={16} style={{ color: LIGHT_PURPLE }} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#F1F5F9", lineHeight: 1.3, marginBottom: 3 }}>{w.label}</div>
              <div style={{ fontSize: 10, color: "#64748B" }}>{w.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: "44px 20px 32px", position: "relative", zIndex: 1 }}>
        <div style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(79,70,229,0.1) 60%, rgba(7,9,26,1) 100%)",
          border: `1px solid rgba(124,58,237,0.3)`,
          borderRadius: 22, padding: "28px 22px",
          position: "relative", overflow: "hidden",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ position: "absolute", top: -50, right: -50, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 100, padding: "4px 12px", marginBottom: 16 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: LIGHT_PURPLE, display: "inline-block", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: LIGHT_PURPLE, letterSpacing: "0.06em" }}>128,400+ TRADERS ACTIVE</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 10, lineHeight: 1.15 }}>
              Your capital deserves to work harder.
            </h2>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 22, lineHeight: 1.65 }}>
              Join traders who stopped watching charts and started letting the bots do it.
            </p>
            <button
              onClick={() => setLocation("/register")}
              style={{
                width: "100%", height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700,
                background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                color: "#fff", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 8px 32px rgba(124,58,237,0.4)",
              }}
            >
              Open Free Account <ArrowRight size={17} />
            </button>
            <p style={{ textAlign: "center", fontSize: 11, color: "#334155", marginTop: 10 }}>Free to start · Withdraw anytime</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "0 20px 40px", borderTop: "1px solid rgba(124,58,237,0.1)", paddingTop: 24, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <VixusLogo className="w-5 h-5" />
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.04em" }}>VIXUS <span style={{ color: LIGHT_PURPLE }}>AI</span></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginBottom: 24 }}>
          {[
            { label: "Terms of Service", href: "/legal/terms" },
            { label: "Privacy Policy",   href: "/legal/privacy" },
            { label: "About Us",         href: "/about" },
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
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
