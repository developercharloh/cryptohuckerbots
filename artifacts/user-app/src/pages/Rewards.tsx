import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Gift, Copy, Share2, Users, DollarSign, ChevronRight } from "lucide-react";

function getReferralCode(userId?: number) {
  return `VAI-${String(userId ?? 0).padStart(5, "0")}`;
}

export default function Rewards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const referralCode = getReferralCode(user?.id);
  const referralLink = `https://vixus.trade/register?ref=${referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode).catch(() => {});
    toast({ title: "Referral code copied!" });
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
      toast({ title: "Referral link copied!" });
    }
  };

  return (
    <Layout showNav>
      <div className="pb-28">
        {/* ── Header ── */}
        <div
          style={{
            background: "linear-gradient(180deg, #1a0a3a 0%, #07091A 100%)",
            padding: "24px 16px 20px",
          }}
        >
          <h1 className="text-2xl font-bold tracking-tight mb-1">Refer &amp; Earn</h1>
          <p className="text-sm text-muted-foreground">
            Invite friends and earn rewards together
          </p>
        </div>

        <div className="px-4 space-y-4 mt-2">
          {/* ── Hero Gift Card ── */}
          <div
            style={{
              background: "linear-gradient(135deg, #4C1D95 0%, #3730A3 60%, #1E1B4B 100%)",
              borderRadius: 20,
              padding: "28px 20px",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(124,58,237,0.35)",
            }}
          >
            {/* Glow */}
            <div
              style={{
                position: "absolute",
                top: -50,
                left: "50%",
                transform: "translateX(-50%)",
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <Gift className="w-10 h-10 text-white" />
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 6, position: "relative" }}>
              Share your referral code and earn
            </p>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1.1, position: "relative" }}>
              20% Commission
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 6, position: "relative" }}>
              on every trade your referrals make
            </p>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-2xl p-4 border border-border/30"
              style={{ background: "rgba(13,10,32,0.9)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-[11px] text-muted-foreground">Total Referrals</p>
              </div>
              <p className="text-2xl font-bold">0</p>
            </div>
            <div
              className="rounded-2xl p-4 border border-border/30"
              style={{ background: "rgba(13,10,32,0.9)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-[11px] text-muted-foreground">Total Earned</p>
              </div>
              <p className="text-2xl font-bold text-green-400">$0.00</p>
            </div>
          </div>

          {/* ── Referral Code ── */}
          <div
            className="rounded-2xl p-4 border border-border/30"
            style={{ background: "rgba(13,10,32,0.9)" }}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Your Referral Code
            </p>
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3 mb-3"
              style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}
            >
              <span className="font-mono font-bold text-lg tracking-widest text-primary">
                {referralCode}
              </span>
              <button
                onClick={copyCode}
                className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"
              >
                <Copy className="w-4 h-4 text-primary" />
              </button>
            </div>

            {/* Referral link */}
            <div className="flex items-center gap-2 bg-muted/10 rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground truncate flex-1 font-mono">
                {referralLink}
              </p>
              <button onClick={shareLink}>
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* ── How it works ── */}
          <div
            className="rounded-2xl p-4 border border-border/30"
            style={{ background: "rgba(13,10,32,0.9)" }}
          >
            <p className="text-sm font-bold mb-3">How it works</p>
            <div className="space-y-3">
              {[
                { step: "1", text: "Share your unique referral code with friends" },
                { step: "2", text: "Friend signs up and makes a deposit of $500+" },
                { step: "3", text: "Earn 20% of their trading rebates for 12 months" },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-primary">{s.step}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Invite Now Button ── */}
          <button
            onClick={shareLink}
            className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #7C3AED 0%, #4338CA 100%)",
              boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
            }}
          >
            <Share2 className="w-5 h-5" />
            Invite Now
          </button>

          {/* Legal */}
          <p className="text-[9px] text-muted-foreground/40 text-center leading-relaxed pb-2">
            A referred client must deposit a minimum of $500 and execute at least one trade to activate
            referral earnings. Payments processed monthly.
          </p>
        </div>
      </div>
    </Layout>
  );
}
