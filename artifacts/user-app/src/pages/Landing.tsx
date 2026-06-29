import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { VixusLogo } from "@/components/VixusLogo";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import {
  ShieldCheck, Lock, Zap, Star, ArrowRight,
  ArrowUpRight, Activity, ChevronRight, Globe, Clock,
  TrendingUp, Bot, Cpu, BarChart2, Menu, X,
  Shield, Wallet, HeadphonesIcon, CheckCircle2,
} from "lucide-react";

const BG = "#07091A";
const CARD = "rgba(20,16,48,0.85)";
const BORDER = "rgba(124,58,237,0.2)";
const PURPLE = "#7C3AED";
const LIGHT_PURPLE = "#A78BFA";
const DARK_CARD = "rgba(10,8,30,0.9)";

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
  { pair: "ETH/USD", val: "3,412",  chg: "+2.14%", up: true },
  { pair: "OIL/USD", val: "78.34",  chg: "-0.32%", up: false },
];

const LIVE_TRADES = [
  { pair: "EUR/USD", dir: "BUY",  lot: "0.50", pnl: "+$48.20",  up: true },
  { pair: "XAU/USD", dir: "BUY",  lot: "0.10", pnl: "+$91.60",  up: true },
  { pair: "GBP/JPY", dir: "SELL", lot: "0.30", pnl: "+$23.80",  up: true },
  { pair: "BTC/USD", dir: "BUY",  lot: "0.02", pnl: "+$134.00", up: true },
];

const STATS = [
  { value: "$482M+", label: "Volume Traded" },
  { value: "128K+",  label: "Active Traders" },
  { value: "99.9%",  label: "Uptime" },
  { value: "24/7",   label: "Support" },
];

const TRUST_BADGES = [
  { icon: Shield,          label: "Bank Level Security" },
  { icon: Lock,            label: "Encrypted Platform" },
  { icon: Zap,             label: "Fast Withdrawals" },
  { icon: HeadphonesIcon,  label: "24/7 Support" },
  { icon: CheckCircle2,    label: "Regulated Partners" },
];

const NAV_LINKS = ["Markets", "Trading", "Features", "Pricing", "Company", "Support"];

const FEATURES = [
  { icon: Zap,         title: "Sub-ms execution",   desc: "Orders filled in microseconds — never miss an entry again." },
  { icon: Activity,    title: "Live P&L tracking",  desc: "Every open trade visible in real time, down to the cent." },
  { icon: ShieldCheck, title: "Hard risk limits",   desc: "Set max drawdown per bot and sleep without worry." },
  { icon: Globe,       title: "11 markets covered", desc: "Forex, crypto, commodities, and indices — all automated." },
];

const STEPS = [
  { n: "01", title: "Fund your account",  desc: "Deposit via bank transfer, card, or crypto in under two minutes.", tag: "Instant funding" },
  { n: "02", title: "Pick your strategy", desc: "Browse bots by risk profile, asset class, and historical performance.", tag: "11 bots available" },
  { n: "03", title: "Let it run",         desc: "The bot trades around the clock. You watch the P&L grow.", tag: "24/7 automation" },
];

const TESTIMONIALS = [
  { name: "Marcus T.",   loc: "Austin, TX",  init: "M", quote: "Setup took five minutes. Dashboard is clean, withdrawals hit same day. I've tried four platforms — this one I actually stuck with.", stat: "+$4,200 first month" },
  { name: "James K.",    loc: "Dallas, TX",  init: "J", quote: "I trade my own account too, so I know what fast execution looks like. These bots fill at the right price — no requotes, no slippage surprises.", stat: "5 years trading exp." },
  { name: "Danielle R.", loc: "Chicago, IL", init: "D", quote: "The risk controls are what sold me. I set a 5% drawdown cap and it has never been breached. Everything is upfront.", stat: "Consistent since month 1" },
];

const WHY_CHOOSE = [
  { icon: Lock,       label: "Bank Level Security",        sub: "256-bit AES" },
  { icon: Zap,        label: "Fast & Secure Transactions", sub: "Instant" },
  { icon: Bot,        label: "24/7 Customer Support",      sub: "Always on" },
  { icon: BarChart2,  label: "Advanced Charting Tools",    sub: "Real-time" },
  { icon: Cpu,        label: "AI-Powered Automation",      sub: "Smart bots" },
  { icon: TrendingUp, label: "Trusted by Traders",         sub: "128K+ users" },
];

function TickerBar() {
  const items = [...TICKER_PAIRS, ...TICKER_PAIRS];
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", overflow: "hidden" }}>
      <div className="flex whitespace-nowrap" style={{ animation: "ticker 32s linear infinite" }}>
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-2 px-5 py-2 shrink-0" style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-xs font-mono font-semibold" style={{ color: "#94A3B8" }}>{t.pair}</span>
            <span className="text-xs font-mono font-bold" style={{ color: "#F1F5F9" }}>{t.val}</span>
            <span className="text-xs font-mono" style={{ color: t.up ? LIGHT_PURPLE : "#EF4444" }}>
              {t.up ? "▲" : "▼"} {t.chg}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformMockup() {
  return (
    <div style={{
      position: "relative",
      width: "100%",
      maxWidth: 560,
    }}>
      {/* Glow behind mockup */}
      <div style={{ position: "absolute", top: "10%", left: "10%", right: "10%", bottom: "10%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.35) 0%, transparent 70%)", filter: "blur(40px)", zIndex: 0 }} />

      {/* Laptop frame */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Screen */}
        <div style={{
          background: "linear-gradient(145deg, #0E0B24, #130F35)",
          border: "1.5px solid rgba(124,58,237,0.4)",
          borderRadius: 14,
          padding: 12,
          boxShadow: "0 0 60px rgba(124,58,237,0.2), 0 30px 80px rgba(0,0,0,0.6)",
        }}>
          {/* Mock nav bar inside screen */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "4px 4px" }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444" }} />
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B" }} />
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981" }} />
            </div>
            <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>VIXUS AI — Dashboard</div>
            <div style={{ width: 40 }} />
          </div>

          {/* Mock dashboard content */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: "#64748B", marginBottom: 2 }}>Portfolio Value</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#F1F5F9", fontFamily: "monospace" }}>$24,530.75</div>
              <div style={{ fontSize: 9, color: LIGHT_PURPLE, display: "flex", alignItems: "center", gap: 2, marginTop: 2 }}>
                <ArrowUpRight size={9} /> +4.32% today
              </div>
            </div>
            <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: "#64748B", marginBottom: 2 }}>Total P&amp;L</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#10B981", fontFamily: "monospace" }}>+$1,082.45</div>
              <div style={{ fontSize: 9, color: "#10B981", marginTop: 2 }}>▲ Active bot running</div>
            </div>
          </div>

          {/* Mini chart */}
          <div style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: "monospace" }}>BTC/USD · 67,821.50</span>
              <span style={{ fontSize: 9, color: LIGHT_PURPLE }}>+1.25%</span>
            </div>
            <div style={{ height: 50 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CHART_DATA} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PURPLE} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={LIGHT_PURPLE} strokeWidth={1.5} fill="url(#mg)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Market rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { pair: "EUR/USD", val: "1.0847", chg: "+0.12%", up: true },
              { pair: "XAU/USD", val: "2,341.50", chg: "+0.44%", up: true },
              { pair: "GBP/JPY", val: "199.84", chg: "-0.18%", up: false },
            ].map((r) => (
              <div key={r.pair} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px", background: "rgba(255,255,255,0.02)", borderRadius: 5 }}>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: "#CBD5E1" }}>{r.pair}</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: "#F1F5F9" }}>{r.val}</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: r.up ? LIGHT_PURPLE : "#EF4444" }}>{r.chg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Laptop base */}
        <div style={{ height: 12, background: "linear-gradient(180deg, #1a1535 0%, #0e0b24 100%)", borderRadius: "0 0 4px 4px", margin: "0 10px" }} />
        <div style={{ height: 6, background: "linear-gradient(180deg, #0e0b24 0%, #070515 100%)", borderRadius: "0 0 20px 20px", margin: "0 0" }} />
      </div>

      {/* Floating badge — profit */}
      <div style={{
        position: "absolute", bottom: 30, left: -20,
        background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
        borderRadius: 10, padding: "8px 12px", backdropFilter: "blur(12px)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        zIndex: 2,
      }}>
        <div style={{ fontSize: 10, color: "#10B981", fontWeight: 700 }}>▲ +$48.20 EUR/USD</div>
        <div style={{ fontSize: 8, color: "#64748B", marginTop: 1 }}>BUY · 0.50 lot · Active</div>
      </div>

      {/* Floating badge — bot */}
      <div style={{
        position: "absolute", top: 20, right: -16,
        background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
        borderRadius: 10, padding: "8px 12px", backdropFilter: "blur(12px)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        zIndex: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: LIGHT_PURPLE, animation: "pulse 2s infinite" }} />
          <div style={{ fontSize: 10, color: LIGHT_PURPLE, fontWeight: 700 }}>AI Bot Active</div>
        </div>
        <div style={{ fontSize: 8, color: "#64748B", marginTop: 1 }}>Last trade: 4s ago</div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const { token, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div style={{ background: BG, color: "#F1F5F9", fontFamily: "inherit", minHeight: "100dvh", overflowX: "hidden" }}>

      {/* ── NAVBAR ── */}
      <header
        className="sticky top-0 z-50 transition-all"
        style={{
          background: scrolled ? "rgba(7,9,26,0.95)" : "rgba(7,9,26,0.7)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(124,58,237,0.15)",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <VixusLogo className="w-7 h-7" />
            <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: "0.04em" }}>
              VIXUS<span style={{ color: LIGHT_PURPLE }}> AI</span>
            </span>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link}
                style={{ fontSize: 13, fontWeight: 500, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#F1F5F9")}
                onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}
              >
                {link}
              </button>
            ))}
          </nav>

          {/* Right side buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocation("/login")}
              className="hidden sm:block"
              style={{ fontSize: 13, fontWeight: 500, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: "8px 16px" }}
            >
              Login
            </button>
            <button
              onClick={handleStart}
              style={{
                fontSize: 13, fontWeight: 700, color: "#fff",
                background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                border: "none", borderRadius: 10, cursor: "pointer", padding: "9px 20px",
                boxShadow: "0 0 20px rgba(124,58,237,0.35)",
              }}
            >
              Get Started
            </button>
            {/* Mobile menu toggle */}
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 6 }}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <div style={{ borderTop: "1px solid rgba(124,58,237,0.15)", background: "rgba(7,9,26,0.98)", padding: "12px 24px 20px" }}>
            {NAV_LINKS.map((link) => (
              <button key={link} onClick={() => setMobileMenuOpen(false)}
                style={{ display: "block", width: "100%", textAlign: "left", fontSize: 14, fontWeight: 500, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {link}
              </button>
            ))}
            <button onClick={() => setLocation("/login")} style={{ display: "block", width: "100%", textAlign: "left", fontSize: 14, fontWeight: 500, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: "10px 0" }}>
              Login
            </button>
          </div>
        )}
      </header>

      {/* ── TICKER ── */}
      <TickerBar />

      {/* ── BACKGROUND GLOWS ── */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 700, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -100, left: "15%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: 100, right: "10%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.1) 0%, transparent 70%)" }} />
      </div>

      {/* ── HERO SECTION ── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "80px 24px 60px" }}>
        <div className="grid md:grid-cols-2 gap-12 items-center">

          {/* Left: copy */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 100, padding: "5px 14px", marginBottom: 24, whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: LIGHT_PURPLE, display: "inline-block", flexShrink: 0, animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: LIGHT_PURPLE, letterSpacing: "0.08em" }}>AI-POWERED TRADING PLATFORM</span>
            </div>

            <h1 style={{ fontSize: "clamp(28px, 3.2vw, 46px)", lineHeight: 1.1, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 20 }}>
              Trade Smarter.<br />
              <span style={{ background: "linear-gradient(135deg, #A78BFA, #7C3AED, #4F46E5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Automate</span>{" "}
              <span>the Rest.</span>
            </h1>

            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#94A3B8", maxWidth: 480, marginBottom: 36 }}>
              Advanced AI trading tools, real-time market data, and professional automation — all in one secure platform. Built for traders who want results, not complexity.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
              <button
                onClick={handleStart}
                style={{
                  height: 52, borderRadius: 13, fontSize: 15, fontWeight: 700,
                  background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                  color: "#fff", border: "none", cursor: "pointer",
                  padding: "0 30px", display: "flex", alignItems: "center", gap: 8,
                  boxShadow: "0 8px 32px rgba(124,58,237,0.45)",
                }}
              >
                Get Started <ArrowRight size={17} />
              </button>
              <button
                onClick={() => setLocation("/login")}
                style={{
                  height: 52, borderRadius: 13, fontSize: 15, fontWeight: 600,
                  background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)",
                  color: LIGHT_PURPLE, cursor: "pointer", padding: "0 28px",
                }}
              >
                View Platform
              </button>
            </div>

            <p style={{ fontSize: 12, color: "#475569" }}>
              No credit card &nbsp;·&nbsp; Fast registration &nbsp;·&nbsp; Secured &amp; Trusted
            </p>
          </div>

          {/* Right: platform mockup */}
          <div className="hidden md:flex justify-center items-center">
            <PlatformMockup />
          </div>
        </div>

        {/* ── STATS BAR ── */}
        <div style={{
          marginTop: 64,
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 18,
          padding: "24px 32px",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#64748B", marginBottom: 20, textTransform: "uppercase" }}>
            Trusted by Traders Worldwide
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 900, letterSpacing: "-0.02em", color: i % 2 === 0 ? LIGHT_PURPLE : "#F1F5F9", fontFamily: "monospace" }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TRUST BADGES ── */}
        <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
          {TRUST_BADGES.map((b) => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 100 }}>
              <b.icon size={14} style={{ color: LIGHT_PURPLE }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8" }}>{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── MOBILE HERO CARD (visible on mobile only) ── */}
      <section className="md:hidden" style={{ padding: "0 20px 0", position: "relative", zIndex: 1 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 16, backdropFilter: "blur(12px)" }}>
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
                    <stop offset="0%" stopColor={PURPLE} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={LIGHT_PURPLE} strokeWidth={2.5} fill="url(#g)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 8, paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Open trades</div>
            {LIVE_TRADES.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: t.dir === "BUY" ? "rgba(167,139,250,0.15)" : "rgba(239,68,68,0.15)", color: t.dir === "BUY" ? LIGHT_PURPLE : "#EF4444" }}>
                    {t.dir}
                  </div>
                  <span className="text-xs font-mono" style={{ color: "#CBD5E1" }}>{t.pair}</span>
                  <span className="text-[10px]" style={{ color: "#64748B" }}>{t.lot} lot</span>
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: LIGHT_PURPLE }}>{t.pnl}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: "80px 24px 0", position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>What's under the hood</h2>
          <p style={{ fontSize: 15, color: "#64748B" }}>Built by traders, for traders. Every feature serves a purpose.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{
                background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 18,
                padding: "24px 22px", backdropFilter: "blur(8px)", transition: "border-color 0.2s",
              }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 13, marginBottom: 16,
                background: i % 2 === 0 ? "rgba(124,58,237,0.15)" : "rgba(79,70,229,0.15)",
                border: `1px solid ${i % 2 === 0 ? "rgba(124,58,237,0.25)" : "rgba(79,70,229,0.25)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <f.icon size={20} style={{ color: LIGHT_PURPLE }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: "80px 24px 0", position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>Up and running in minutes</h2>
          <p style={{ fontSize: 15, color: "#64748B" }}>Three steps. No experience required.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "28px 24px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, fontSize: 60, fontWeight: 900, color: "rgba(124,58,237,0.06)", fontFamily: "monospace", lineHeight: 1 }}>{s.n}</div>
              <div style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: LIGHT_PURPLE, letterSpacing: "0.07em", background: "rgba(124,58,237,0.1)", borderRadius: 4, padding: "3px 10px", marginBottom: 14, border: "1px solid rgba(124,58,237,0.2)" }}>{s.tag}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.65 }}>{s.desc}</div>
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: LIGHT_PURPLE, fontWeight: 600 }}>
                Step {s.n} {i < STEPS.length - 1 && <ChevronRight size={14} />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECURITY ── */}
      <section style={{ padding: "80px 24px 0", position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 22, padding: "36px 32px", backdropFilter: "blur(12px)" }}>
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Security &amp; Compliance</div>
              <h3 style={{ fontSize: "clamp(22px, 2.5vw, 30px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>Your funds are safe. Always.</h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>Enterprise-grade security baked into every layer of the platform. We treat your capital the way institutional desks do.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { icon: Lock,        label: "256-bit AES encryption",  detail: "All data encrypted in transit and at rest" },
                { icon: ShieldCheck, label: "2FA on every account",    detail: "Multi-layer authentication by default" },
                { icon: Clock,       label: "Full trade audit trail",  detail: "Every order logged with timestamp and price" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <item.icon size={18} style={{ color: LIGHT_PURPLE }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: "80px 24px 0", position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>What traders are saying</h2>
          <p style={{ fontSize: 15, color: "#64748B" }}>Unfiltered. No marketing speak.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} style={{ background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "24px 22px", backdropFilter: "blur(8px)" }}>
              <div style={{ display: "flex", gap: 2, marginBottom: 14 }}>
                {[1,2,3,4,5].map((i) => <Star key={i} size={13} style={{ color: LIGHT_PURPLE, fill: LIGHT_PURPLE }} />)}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "#CBD5E1", marginBottom: 20 }}>"{t.quote}"</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #7C3AED, #4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>{t.init}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{t.loc}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: LIGHT_PURPLE, background: "rgba(124,58,237,0.12)", borderRadius: 6, padding: "4px 8px" }}>{t.stat}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY CHOOSE ── */}
      <section style={{ padding: "80px 24px 0", position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ fontSize: "clamp(22px, 3vw, 34px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>Why Traders Choose VIXUS AI</h2>
          <p style={{ fontSize: 14, color: "#64748B" }}>Secured &amp; Trusted</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {WHY_CHOOSE.map((w) => (
            <div key={w.label} style={{ background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "20px 14px", textAlign: "center", backdropFilter: "blur(8px)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                <w.icon size={18} style={{ color: LIGHT_PURPLE }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#F1F5F9", lineHeight: 1.35, marginBottom: 4 }}>{w.label}</div>
              <div style={{ fontSize: 10, color: "#64748B" }}>{w.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: "80px 24px 40px", position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(79,70,229,0.12) 50%, rgba(7,9,26,0.9) 100%)",
          border: "1px solid rgba(124,58,237,0.3)",
          borderRadius: 24, padding: "56px 40px",
          position: "relative", overflow: "hidden",
          textAlign: "center",
        }}>
          <div style={{ position: "absolute", top: -60, left: "30%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -40, right: "20%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 100, padding: "5px 14px", marginBottom: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: LIGHT_PURPLE, display: "inline-block", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: LIGHT_PURPLE, letterSpacing: "0.06em" }}>128,400+ TRADERS ACTIVE</span>
            </div>
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 44px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 12, lineHeight: 1.1 }}>
              Your capital deserves<br />to work harder.
            </h2>
            <p style={{ fontSize: 15, color: "#64748B", marginBottom: 32, maxWidth: 500, margin: "0 auto 32px" }}>
              Join traders who stopped watching charts and started letting the bots handle it.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
              <button
                onClick={handleStart}
                style={{
                  height: 54, borderRadius: 14, fontSize: 16, fontWeight: 700,
                  background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                  color: "#fff", border: "none", cursor: "pointer",
                  padding: "0 36px", display: "flex", alignItems: "center", gap: 8,
                  boxShadow: "0 8px 32px rgba(124,58,237,0.45)",
                }}
              >
                Open Free Account <ArrowRight size={18} />
              </button>
            </div>
            <p style={{ textAlign: "center", fontSize: 12, color: "#475569", marginTop: 14 }}>Free to start · Withdraw anytime · No hidden fees</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid rgba(124,58,237,0.1)", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 24px 32px" }}>
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            {/* Brand */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <VixusLogo className="w-6 h-6" />
                <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: "0.04em" }}>VIXUS <span style={{ color: LIGHT_PURPLE }}>AI</span></span>
              </div>
              <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.7, maxWidth: 200 }}>
                Institutional-grade AI trading for everyone. Automate your strategy across 11+ markets.
              </p>
            </div>

            {/* Product */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Product</div>
              {["Markets", "Trading", "AI Bots", "Portfolio", "Analytics"].map(l => (
                <div key={l} style={{ fontSize: 13, color: "#475569", marginBottom: 8, cursor: "pointer" }}>{l}</div>
              ))}
            </div>

            {/* Company */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Company</div>
              {["About Us", "Pricing", "Blog", "Careers", "Contact"].map(l => (
                <div key={l} style={{ fontSize: 13, color: "#475569", marginBottom: 8, cursor: "pointer" }}>{l}</div>
              ))}
            </div>

            {/* Legal */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Legal</div>
              <Link href="/legal/terms" style={{ display: "block", fontSize: 13, color: "#475569", marginBottom: 8, textDecoration: "none" }}>Terms of Service</Link>
              <Link href="/legal/privacy" style={{ display: "block", fontSize: 13, color: "#475569", marginBottom: 8, textDecoration: "none" }}>Privacy Policy</Link>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 8, cursor: "pointer" }}>Cookie Policy</div>
              <div style={{ fontSize: 13, color: "#475569", cursor: "pointer" }}>Risk Disclosure</div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 24, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <p style={{ fontSize: 11, color: "#334155" }}>© {new Date().getFullYear()} VIXUS AI. All rights reserved.</p>
            <p style={{ fontSize: 10, color: "#1E293B", maxWidth: 500, lineHeight: 1.6, textAlign: "right" }}>
              Trading involves significant risk. Past performance is not indicative of future results. Capital at risk.
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @media (max-width: 768px) {
          .md\\:grid-cols-2 { grid-template-columns: 1fr !important; }
          .md\\:grid-cols-3 { grid-template-columns: 1fr !important; }
          .md\\:grid-cols-4 { grid-template-columns: 1fr 1fr !important; }
          .lg\\:grid-cols-4 { grid-template-columns: 1fr 1fr !important; }
          .lg\\:grid-cols-6 { grid-template-columns: 1fr 1fr 1fr !important; }
          .hidden.md\\:flex { display: none !important; }
          .hidden.md\\:block { display: none !important; }
          .md\\:hidden { display: block !important; }
        }
        @media (min-width: 769px) {
          .md\\:hidden { display: none !important; }
          .hidden.md\\:flex { display: flex !important; }
          .hidden.md\\:block { display: block !important; }
          .hidden.sm\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}
