import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, useResendLoginOtp, useVerifyLoginOtp } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ShieldCheck, ChevronLeft, Lock, Mail } from "lucide-react";
import { VixusLogo } from "@/components/VixusLogo";
import { API_BASE, fetchWithTimeout } from "@/lib/api-base";
import { reportTechnicalError } from "@/lib/technical-errors";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const BG = "#07091A";
const CARD = "rgba(25,22,14,0.94)";
const BORDER = "rgba(245,185,66,0.28)";
const PURPLE = "#F5B942";
const LIGHT = "#FFD86B";

export default function Login() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [connectionMessage, setConnectionMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const search = useSearch();
  const prefilledEmail = new URLSearchParams(search).get("email") ?? "";

  const [step, setStep] = useState<"credentials" | "emailOtp" | "2fa">("credentials");
  const [tempToken, setTempToken] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const verifyLoginOtpMutation = useVerifyLoginOtp();
  const resendLoginOtpMutation = useResendLoginOtp();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefilledEmail, password: "" },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    setConnectionMessage("");
    loginMutation.mutate({ data: { email: values.email, password: values.password } }, {
      onSuccess: (res: any) => {
        if (res.requiresEmailOtp) {
          setChallengeToken(res.challengeToken);
          setEmailOtpCode("");
          setStep("emailOtp");
        } else if (res.requires2FA) {
          setTempToken(res.tempToken);
          setTwoFACode("");
          setStep("2fa");
        } else {
          if (!res.user) throw new Error("Login did not return a user session");
          setAuth(res.user);
          setLocation("/dashboard");
        }
      },
      onError: (err: any) => {
        const isTechnicalFailure = err?.status >= 500 || !Number.isInteger(err?.status);
        if (isTechnicalFailure) {
          reportTechnicalError({
            source: "api",
            event: "login_request_failed",
            route: "/api/auth/login",
            message: err?.message || "Login request failed.",
            statusCode: Number.isInteger(err?.status) ? err.status : undefined,
          });
          setConnectionMessage("Please try again in a moment.");
          return;
        }
        if (err.status === 403 && err.data?.code === "EMAIL_NOT_VERIFIED") {
          toast({ title: "Verify your email first", description: "Open the verification email we sent you, then return to log in." });
          setLocation(`/verify-email?email=${encodeURIComponent(values.email)}`);
          return;
        }
        toast({ title: "Login failed", description: "Unable to sign in. Please check your details and try again.", variant: "destructive" });
      },
    });
  };

  const handleEmailOtpVerify = () => {
    if (emailOtpCode.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    verifyLoginOtpMutation.mutate(
      { data: { challengeToken, code: emailOtpCode } },
      {
        onSuccess: (res: any) => {
          if (res.requires2FA) {
            setTempToken(res.tempToken);
            setTwoFACode("");
            setStep("2fa");
            return;
          }
          if (!res.user) {
            toast({ title: "Login failed", description: "Login did not return a user session.", variant: "destructive" });
            return;
          }
          setAuth(res.user);
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          toast({ title: "Invalid login code", description: err.message || "The code is invalid or expired.", variant: "destructive" });
          setEmailOtpCode("");
        },
      },
    );
  };

  const handleResendEmailOtp = () => {
    resendLoginOtpMutation.mutate(
      { data: { challengeToken } },
      {
        onSuccess: () => {
          setEmailOtpCode("");
          toast({ title: "New code sent", description: "Check your verified email for a new login code." });
        },
        onError: (err: any) => {
          toast({ title: "Could not resend code", description: err.message || "Please try again later.", variant: "destructive" });
        },
      },
    );
  };

  const handle2FAVerify = async () => {
    if (twoFACode.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      const r = await fetchWithTimeout(`${API_BASE}/api/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tempToken, code: twoFACode }),
      });
      const data = await r.json();
       if (!r.ok) throw new Error("The code could not be verified.");
      setAuth(data.user);
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Invalid code", description: "The code could not be verified. Please try again shortly.", variant: "destructive" });
      setTwoFACode("");
    } finally {
      setVerifying(false);
    }
  };

  if (step === "emailOtp") {
    return (
      <div style={{ minHeight: "100dvh", background: `linear-gradient(160deg, ${BG} 0%, #15120B 50%, ${BG} 100%)`, display: "flex", flexDirection: "column", padding: "24px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,185,66,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ paddingTop: 40, position: "relative", zIndex: 1 }}>
          <button onClick={() => setStep("credentials")} style={{ display: "flex", alignItems: "center", gap: 4, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <ChevronLeft size={18} /> Back to login
          </button>
          <div style={{ textAlign: "center", margin: "72px 0 32px" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 20px", background: "rgba(245,185,66,0.12)", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={30} color={LIGHT} />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#F1F5F9", marginBottom: 10 }}>Check your email</h1>
            <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, maxWidth: 290, margin: "0 auto" }}>
              We sent a 6-digit login code to your verified email. It expires in 10 minutes.
            </p>
          </div>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000 000"
            maxLength={6}
            value={emailOtpCode}
            onChange={e => setEmailOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ width: "100%", height: 72, borderRadius: 16, background: CARD, border: `1px solid ${BORDER}`, textAlign: "center", fontSize: 32, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.4em", color: "#F1F5F9", outline: "none", marginBottom: 16 }}
          />
          <button
            onClick={handleEmailOtpVerify}
            disabled={verifyLoginOtpMutation.isPending || emailOtpCode.length !== 6}
            style={{ width: "100%", height: 54, borderRadius: 14, fontSize: 16, fontWeight: 700, background: emailOtpCode.length === 6 ? "linear-gradient(135deg, #F5B942, #D99B18)" : "rgba(245,185,66,0.2)", color: "#fff", border: "none", cursor: emailOtpCode.length === 6 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: emailOtpCode.length === 6 ? "0 8px 28px rgba(245,185,66,0.3)" : "none" }}
          >
            {verifyLoginOtpMutation.isPending ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : "Verify & Login"}
          </button>
          <button
            onClick={handleResendEmailOtp}
            disabled={resendLoginOtpMutation.isPending}
            style={{ display: "block", margin: "20px auto 0", color: LIGHT, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
          >
            {resendLoginOtpMutation.isPending ? "Sending…" : "Resend code"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "2fa") {
    return (
      <div style={{ minHeight: "100dvh", background: `linear-gradient(160deg, ${BG} 0%, #15120B 50%, ${BG} 100%)`, display: "flex", flexDirection: "column", padding: "24px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,185,66,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ paddingTop: 40 }}>
          <button onClick={() => setStep("credentials")} style={{ display: "flex", alignItems: "center", gap: 4, color: "#64748B", background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0 }}>
            <ChevronLeft size={16} /> Back to login
          </button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 36 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(245,185,66,0.15)", border: "1px solid rgba(245,185,66,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <ShieldCheck size={32} style={{ color: LIGHT }} />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#F1F5F9", marginBottom: 10, letterSpacing: "-0.02em" }}>Two-Factor Auth</h1>
            <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, maxWidth: 280 }}>
              Open <strong style={{ color: "#F1F5F9" }}>Google Authenticator</strong> and enter the 6-digit code for <strong style={{ color: LIGHT }}>VIXUS</strong>.
            </p>
          </div>
          <input
            type="number"
            inputMode="numeric"
            placeholder="000 000"
            maxLength={6}
            value={twoFACode}
            onChange={e => setTwoFACode(e.target.value.slice(0, 6))}
            style={{
              width: "100%", height: 72, borderRadius: 16,
              background: CARD, border: `1px solid ${BORDER}`,
              textAlign: "center", fontSize: 32, fontFamily: "monospace",
              fontWeight: 700, letterSpacing: "0.4em", color: "#F1F5F9",
              outline: "none", marginBottom: 16,
            }}
          />
          <button
            onClick={handle2FAVerify}
            disabled={verifying || twoFACode.length !== 6}
            style={{
              width: "100%", height: 54, borderRadius: 14, fontSize: 16, fontWeight: 700,
              background: twoFACode.length === 6 ? "linear-gradient(135deg, #F5B942, #D99B18)" : "rgba(245,185,66,0.2)",
              color: "#fff", border: "none", cursor: twoFACode.length === 6 ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
               boxShadow: twoFACode.length === 6 ? "0 8px 28px rgba(245,185,66,0.3)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            {verifying ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : "Verify & Login"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: `linear-gradient(160deg, ${BG} 0%, #15120B 50%, ${BG} 100%)`, display: "flex", flexDirection: "column", padding: "0 24px", position: "relative", overflow: "hidden" }}>

      {/* Glow */}
      <div style={{ position: "absolute", top: "-5%", left: "50%", transform: "translateX(-50%)", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,185,66,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "20%", right: "-15%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ paddingTop: 56, paddingBottom: 36, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, rgba(245,185,66,0.25), rgba(59,130,246,0.12))", border: "1px solid rgba(245,185,66,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <VixusLogo className="w-7 h-7" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", color: "#F1F5F9" }}>
            VIXUS
          </span>
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#F1F5F9", marginBottom: 8, letterSpacing: "-0.02em" }}>Welcome Back</h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>Trade with confidence</p>
        </div>
      </div>

      {/* Form card */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 24, padding: "24px 20px", backdropFilter: "blur(16px)", position: "relative", zIndex: 1 }}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", letterSpacing: "0.02em" }}>Email or Phone</label>
                <FormControl>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                    <Input
                      placeholder="name@example.com"
                      type="email"
                      autoComplete="username"
                       style={{ paddingLeft: 40, height: 50, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245,185,66,0.2)", borderRadius: 12, color: "#F1F5F9", fontSize: 14 }}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", letterSpacing: "0.02em" }}>Password</label>
                <FormControl>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                    <Input
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                       style={{ paddingLeft: 40, paddingRight: 44, height: 50, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245,185,66,0.2)", borderRadius: 12, color: "#F1F5F9", fontSize: 14 }}
                      {...field}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Link href="/forgot-password" style={{ fontSize: 12, color: LIGHT, fontWeight: 600, textDecoration: "none" }}>Forgot password?</Link>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              style={{
                width: "100%", height: 54, borderRadius: 14, fontSize: 16, fontWeight: 700,
                 background: "linear-gradient(135deg, #F5B942, #D99B18)",
                color: "#fff", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                 boxShadow: "0 8px 28px rgba(245,185,66,0.3)",
                opacity: loginMutation.isPending ? 0.8 : 1,
              }}
            >
              {loginMutation.isPending ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : "Login"}
            </button>
            {connectionMessage && (
              <p style={{ margin: "0 4px", textAlign: "center", fontSize: 12, color: "#94A3B8" }}>
                {connectionMessage}
              </p>
            )}
          </form>
        </Form>
      </div>

      {/* Sign up link */}
      <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 40, position: "relative", zIndex: 1 }}>
        <span style={{ fontSize: 13, color: "#475569" }}>Don't have an account? </span>
        <Link href="/register" style={{ fontSize: 13, color: LIGHT, fontWeight: 700, textDecoration: "none" }}>Sign up</Link>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
