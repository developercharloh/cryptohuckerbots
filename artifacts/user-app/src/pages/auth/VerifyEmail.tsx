import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Mail, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { VixusLogo } from "@/components/VixusLogo";
import { useToast } from "@/hooks/use-toast";
import { API_BASE, fetchWithTimeout } from "@/lib/api-base";

const BG = "#07091A";
const CARD = "rgba(25,22,14,0.94)";
const BORDER = "rgba(245,185,66,0.28)";
const LIGHT = "#FFD86B";

type PageStatus = "pending" | "verifying" | "verified" | "error";

export default function VerifyEmail() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [status, setStatus] = useState<PageStatus>(token ? "verifying" : "pending");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchWithTimeout(`${API_BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "This verification link is invalid or expired.");
        if (!cancelled) {
          setEmail(data.email || email);
          setStatus("verified");
          setMessage("Your email is verified. You can now log in and receive a fresh code each time.");
        }
      })
      .catch(error => {
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "This verification link is invalid or expired.");
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  const resend = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast({ title: "Enter your email address", variant: "destructive" });
      return;
    }
    setResending(true);
    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not send the verification email.");
      setMessage("If the account needs verification, a new email has been sent.");
      toast({ title: "Verification email sent" });
    } catch (error) {
      toast({
        title: "Could not send email",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const isVerifying = status === "verifying";
  const isVerified = status === "verified";

  return (
    <div style={{ minHeight: "100dvh", background: `linear-gradient(160deg, ${BG} 0%, #15120B 50%, ${BG} 100%)`, display: "flex", flexDirection: "column", alignItems: "center", padding: "52px 24px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-5%", left: "50%", transform: "translateX(-50%)", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,185,66,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48, position: "relative", zIndex: 1 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, rgba(245,185,66,0.25), rgba(59,130,246,0.12))", border: "1px solid rgba(245,185,66,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <VixusLogo className="w-7 h-7" />
        </div>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#F1F5F9" }}>VIXUS</span>
      </div>

      <div style={{ width: "100%", maxWidth: 420, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 24, padding: "32px 24px", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ width: 68, height: 68, borderRadius: 22, margin: "0 auto 20px", background: isVerified ? "rgba(34,197,94,0.12)" : "rgba(245,185,66,0.12)", border: `1px solid ${isVerified ? "rgba(34,197,94,0.35)" : BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isVerifying ? <Loader2 size={30} color={LIGHT} style={{ animation: "spin 1s linear infinite" }} /> : isVerified ? <CheckCircle2 size={32} color="#4ade80" /> : <Mail size={30} color={LIGHT} />}
        </div>
        <h1 style={{ fontSize: 25, fontWeight: 800, color: "#F1F5F9", marginBottom: 10 }}>
          {isVerifying ? "Verifying your email…" : isVerified ? "Email verified" : "Verify your email"}
        </h1>
        <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, margin: "0 auto 24px", maxWidth: 330 }}>
          {isVerifying ? "Please wait while we confirm your one-time verification link." : message || `We sent a verification link${email ? ` to ${email}` : ""}. Open it to activate your account.`}
        </p>

        {!isVerifying && !isVerified && (
          <>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              style={{ width: "100%", height: 50, padding: "0 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245,185,66,0.2)", color: "#F1F5F9", fontSize: 14, outline: "none", marginBottom: 14 }}
            />
            <button onClick={resend} disabled={resending} style={{ width: "100%", height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700, background: "linear-gradient(135deg, #F5B942, #D99B18)", color: "#fff", border: "none", cursor: resending ? "wait" : "pointer" }}>
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          </>
        )}

        {isVerified && (
          <button onClick={() => setLocation(`/login?email=${encodeURIComponent(email)}`)} style={{ width: "100%", height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700, background: "linear-gradient(135deg, #F5B942, #D99B18)", color: "#fff", border: "none", cursor: "pointer" }}>
            Continue to login
          </button>
        )}
      </div>

      <Link href="/login" style={{ display: "flex", alignItems: "center", gap: 5, color: LIGHT, textDecoration: "none", fontSize: 13, fontWeight: 700, marginTop: 24, position: "relative", zIndex: 1 }}>
        <ArrowLeft size={16} /> Back to login
      </Link>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}