import { useState } from "react";
import { useLocation } from "wouter";
import { Bot, TrendingUp, ShieldCheck } from "lucide-react";

const SLIDES = [
  {
    icon: Bot,
    gradient: "linear-gradient(135deg, #7C3AED, #4F46E5)",
    title: "Smart Trading\nStarts Here",
    description: "Powerful tools, real-time data and AI automation all in one platform.",
    accent: "#A78BFA",
    visual: "bot",
  },
  {
    icon: TrendingUp,
    gradient: "linear-gradient(135deg, #4F46E5, #7C3AED)",
    title: "Welcome to\nVIXUS AI",
    description: "Your all-in-one trading platform for Forex, Crypto, Commodities & Indices.",
    accent: "#818CF8",
    visual: "chart",
  },
  {
    icon: ShieldCheck,
    gradient: "linear-gradient(135deg, #6D28D9, #4F46E5)",
    title: "Secure &\nTransparent",
    description: "Bank-grade security with full visibility of your funds and trades at all times.",
    accent: "#A78BFA",
    visual: "shield",
  },
];

function BotVisual() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "70%", height: "70%" }}>
      <rect x="60" y="65" width="80" height="75" rx="18" fill="url(#bh)" />
      <rect x="88" y="45" width="24" height="22" rx="8" fill="#6D28D9" />
      <circle cx="100" cy="34" r="9" fill="#A78BFA" />
      <circle cx="78" cy="98" r="11" fill="#1E1B4B" />
      <circle cx="122" cy="98" r="11" fill="#1E1B4B" />
      <circle cx="78" cy="98" r="5.5" fill="#7C3AED" />
      <circle cx="122" cy="98" r="5.5" fill="#7C3AED" />
      <circle cx="80" cy="96" r="2" fill="#C4B5FD" />
      <circle cx="124" cy="96" r="2" fill="#C4B5FD" />
      <rect x="84" y="118" width="32" height="8" rx="4" fill="#4C1D95" />
      <rect x="88" y="120" width="10" height="4" rx="2" fill="#7C3AED" />
      <rect x="38" y="75" width="22" height="38" rx="11" fill="url(#ba)" />
      <rect x="140" y="75" width="22" height="38" rx="11" fill="url(#ba)" />
      <rect x="55" y="148" width="90" height="48" rx="16" fill="url(#bb)" />
      <rect x="65" y="158" width="28" height="28" rx="8" fill="#1E1B4B" />
      <rect x="107" y="158" width="28" height="28" rx="8" fill="#1E1B4B" />
      <path d="M70 175 L79 165 L88 175" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M112 165 L121 175 L130 165" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="70" y="194" width="20" height="22" rx="8" fill="url(#bl)" />
      <rect x="110" y="194" width="20" height="22" rx="8" fill="url(#bl)" />
      <defs>
        <linearGradient id="bh" x1="60" y1="65" x2="140" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D28D9" /><stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
        <linearGradient id="bb" x1="55" y1="148" x2="145" y2="196" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B21B6" /><stop offset="1" stopColor="#3B0764" />
        </linearGradient>
        <linearGradient id="ba" x1="38" y1="75" x2="60" y2="113" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" /><stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
        <linearGradient id="bl" x1="70" y1="194" x2="90" y2="216" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D28D9" /><stop offset="1" stopColor="#3B0764" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ChartVisual() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "75%", height: "75%" }}>
      <rect x="20" y="20" width="160" height="160" rx="20" fill="rgba(124,58,237,0.08)" stroke="rgba(124,58,237,0.2)" strokeWidth="1" />
      <path d="M35 140 L60 110 L85 120 L110 75 L135 90 L160 50" stroke="url(#cg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M35 140 L60 110 L85 120 L110 75 L135 90 L160 50 L160 160 L35 160Z" fill="url(#cf)" opacity="0.4" />
      {[35,60,85,110,135,160].map((x,i) => {
        const y = [140,110,120,75,90,50][i];
        return <circle key={x} cx={x} cy={y} r="4" fill="#A78BFA" />;
      })}
      <rect x="115" y="45" width="55" height="28" rx="8" fill="rgba(124,58,237,0.2)" stroke="rgba(124,58,237,0.3)" strokeWidth="1" />
      <text x="142" y="62" textAnchor="middle" fill="#A78BFA" fontSize="10" fontWeight="700">+38%</text>
      <defs>
        <linearGradient id="cg" x1="35" y1="140" x2="160" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" /><stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient id="cf" x1="100" y1="50" x2="100" y2="160" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" stopOpacity="0.6" /><stop offset="1" stopColor="#7C3AED" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ShieldVisual() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "70%", height: "70%" }}>
      <path d="M100 20 L160 45 L160 100 C160 140 130 168 100 180 C70 168 40 140 40 100 L40 45 Z" fill="url(#sg)" stroke="rgba(124,58,237,0.4)" strokeWidth="1.5" />
      <path d="M100 28 L152 50 L152 100 C152 135 126 161 100 172 C74 161 48 135 48 100 L48 50 Z" fill="url(#si)" opacity="0.5" />
      <path d="M78 100 L93 115 L125 83" stroke="#A78BFA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="100" cy="100" r="28" stroke="rgba(167,139,250,0.3)" strokeWidth="1" fill="none" />
      <defs>
        <linearGradient id="sg" x1="40" y1="20" x2="160" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D28D9" /><stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
        <linearGradient id="si" x1="48" y1="28" x2="152" y2="172" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" stopOpacity="0.4" /><stop offset="1" stopColor="#7C3AED" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];

  const handleNext = () => {
    if (current === SLIDES.length - 1) finish();
    else setCurrent(c => c + 1);
  };

  const finish = () => {
    localStorage.setItem("vixus_onboarding_seen", "true");
    setLocation("/login");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh", background: "linear-gradient(160deg, #07091A 0%, #0F0A2E 60%, #07091A 100%)", padding: "0 24px", position: "relative", overflow: "hidden" }}>

      {/* Glow */}
      <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 56, paddingBottom: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              style={{
                height: 4, borderRadius: 4,
                width: i === current ? 24 : 8,
                background: i === current ? "linear-gradient(90deg, #7C3AED, #A78BFA)" : "rgba(255,255,255,0.12)",
                transition: "width 0.3s ease, background 0.3s ease",
              }}
            />
          ))}
        </div>
        <button
          onClick={finish}
          style={{ fontSize: 13, fontWeight: 600, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
        >
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>

        {/* Visual */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 32 }}>
          <div style={{ position: "relative", width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)", animation: "breathe 3s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 16, borderRadius: "50%", border: "1px solid rgba(124,58,237,0.2)" }} />
            <div style={{ position: "absolute", inset: 32, borderRadius: "50%", border: "1px solid rgba(124,58,237,0.12)" }} />
            {current === 0 && <BotVisual />}
            {current === 1 && <ChartVisual />}
            {current === 2 && <ShieldVisual />}
          </div>
        </div>

        {/* Text */}
        <div>
          <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", color: "#F1F5F9", marginBottom: 14, lineHeight: 1.1, whiteSpace: "pre-line" }}>
            {slide.title}
          </h2>
          <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.65, maxWidth: 300 }}>
            {slide.description}
          </p>
        </div>
      </div>

      {/* Bottom */}
      <div style={{ paddingBottom: 44, position: "relative", zIndex: 1 }}>
        <button
          onClick={handleNext}
          style={{
            width: "100%", height: 56, borderRadius: 16, fontSize: 16, fontWeight: 700,
            background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
            color: "#fff", border: "none", cursor: "pointer",
            boxShadow: "0 8px 28px rgba(124,58,237,0.45)",
          }}
        >
          {current === SLIDES.length - 1 ? "Create Account" : "Next"}
        </button>
        {current < SLIDES.length - 1 && (
          <button
            onClick={finish}
            style={{ width: "100%", marginTop: 12, fontSize: 13, color: "#475569", background: "none", border: "none", cursor: "pointer", padding: "6px 0" }}
          >
            Login instead
          </button>
        )}
      </div>

      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}
