import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { VixusLogo } from "@/components/VixusLogo";

export default function Splash() {
  const [, setLocation] = useLocation();
  const { token, isLoading } = useAuth();
  const [showButton, setShowButton] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (token) {
      const t = setTimeout(() => setLocation("/dashboard"), 1800);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setShowButton(true), 2000);
      return () => clearTimeout(t);
    }
  }, [setLocation, token, isLoading]);

  const handleGetStarted = () => {
    const seen = localStorage.getItem("vixus_onboarding_seen");
    setLocation(seen ? "/login" : "/onboarding");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "100dvh",
        background: "linear-gradient(160deg, #07091A 0%, #0F0A2E 50%, #07091A 100%)",
        padding: "0 24px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Background glows */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "15%", right: "-10%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "30%", left: "-10%", width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)" }} />
      </div>

      {/* Top spacer */}
      <div />

      {/* Center content */}
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 32,
          opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
          position: "relative", zIndex: 1,
        }}
      >
        {/* Logo glow ring */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            position: "absolute", width: 160, height: 160, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)",
            animation: "breathe 3s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", width: 120, height: 120, borderRadius: "50%",
            border: "1px solid rgba(124,58,237,0.25)",
            animation: "spin 12s linear infinite",
          }} />
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.2))",
            border: "1px solid rgba(124,58,237,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)",
          }}>
            <VixusLogo className="w-12 h-12 drop-shadow-[0_0_20px_rgba(124,58,237,0.8)]" />
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.03em", color: "#F1F5F9", margin: 0, lineHeight: 1.1 }}>
            VIXUS<span style={{ background: "linear-gradient(135deg, #A78BFA, #7C3AED)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}> AI</span>
          </h1>
          <p style={{ color: "#64748B", fontSize: 13, marginTop: 10, letterSpacing: "0.02em" }}>
            Trade Smarter. Automate the Rest.
          </p>
          <p style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>
            Advanced Trading Platform for Global Markets
          </p>
        </div>

        {/* Stats strip */}
        <div style={{
          display: "flex", gap: 20, marginTop: 8,
          background: "rgba(124,58,237,0.08)",
          border: "1px solid rgba(124,58,237,0.15)",
          borderRadius: 14, padding: "12px 20px",
        }}>
          {[
            { v: "$482M+", l: "Volume" },
            { v: "128K+",  l: "Traders" },
            { v: "99.9%",  l: "Uptime" },
          ].map((s) => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#A78BFA" }}>{s.v}</div>
              <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        style={{
          width: "100%", paddingBottom: 40, position: "relative", zIndex: 1,
          opacity: showButton ? 1 : 0, transform: showButton ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
          pointerEvents: showButton ? "auto" : "none",
        }}
      >
        <button
          onClick={handleGetStarted}
          style={{
            width: "100%", height: 56, borderRadius: 16, fontSize: 16, fontWeight: 700,
            background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
            color: "#fff", border: "none", cursor: "pointer",
            boxShadow: "0 8px 32px rgba(124,58,237,0.5)",
            letterSpacing: "0.01em",
          }}
        >
          Get Started
        </button>
        <p style={{ textAlign: "center", fontSize: 11, color: "#475569", marginTop: 12 }}>
          Trusted by traders worldwide
        </p>
      </div>

      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
