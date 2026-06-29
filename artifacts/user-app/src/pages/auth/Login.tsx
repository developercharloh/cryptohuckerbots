import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ShieldCheck, ChevronLeft, Lock, Mail } from "lucide-react";
import { VixusLogo } from "@/components/VixusLogo";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const BG = "#07091A";
const CARD = "rgba(20,16,48,0.9)";
const BORDER = "rgba(124,58,237,0.2)";
const PURPLE = "#7C3AED";
const LIGHT = "#A78BFA";

export default function Login() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const search = useSearch();
  const prefilledEmail = new URLSearchParams(search).get("email") ?? "";

  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [tempToken, setTempToken] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefilledEmail, password: "" },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate({ data: { email: values.email, password: values.password } }, {
      onSuccess: (res: any) => {
        if (res.requires2FA) {
          setTempToken(res.tempToken);
          setTwoFACode("");
          setStep("2fa");
        } else {
          setAuth(res.token, res.user);
          setLocation("/dashboard");
        }
      },
      onError: (err: any) => {
        toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
      },
    });
  };

  const handle2FAVerify = async () => {
    if (twoFACode.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const r = await fetch(`${apiBase}/api/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code: twoFACode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Invalid code");
      setAuth(data.token, data.user);
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Invalid code", description: err.message, variant: "destructive" });
      setTwoFACode("");
    } finally {
      setVerifying(false);
    }
  };

  if (step === "2fa") {
    return (
      <div style={{ minHeight: "100dvh", background: `linear-gradient(160deg, ${BG} 0%, #0F0A2E 50%, ${BG} 100%)`, display: "flex", flexDirection: "column", padding: "24px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ paddingTop: 40 }}>
          <button onClick={() => setStep("credentials")} style={{ display: "flex", alignItems: "center", gap: 4, color: "#64748B", background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0 }}>
            <ChevronLeft size={16} /> Back to login
          </button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 36 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <ShieldCheck size={32} style={{ color: LIGHT }} />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#F1F5F9", marginBottom: 10, letterSpacing: "-0.02em" }}>Two-Factor Auth</h1>
            <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, maxWidth: 280 }}>
              Open <strong style={{ color: "#F1F5F9" }}>Google Authenticator</strong> and enter the 6-digit code for <strong style={{ color: LIGHT }}>VIXUS AI</strong>.
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
              background: twoFACode.length === 6 ? "linear-gradient(135deg, #7C3AED, #4F46E5)" : "rgba(124,58,237,0.2)",
              color: "#fff", border: "none", cursor: twoFACode.length === 6 ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: twoFACode.length === 6 ? "0 8px 28px rgba(124,58,237,0.4)" : "none",
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
    <div style={{ minHeight: "100dvh", background: `linear-gradient(160deg, ${BG} 0%, #0F0A2E 50%, ${BG} 100%)`, display: "flex", flexDirection: "column", padding: "0 24px", position: "relative", overflow: "hidden" }}>

      {/* Glow */}
      <div style={{ position: "absolute", top: "-5%", left: "50%", transform: "translateX(-50%)", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "20%", right: "-15%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ paddingTop: 56, paddingBottom: 36, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(79,70,229,0.15))", border: "1px solid rgba(124,58,237,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <VixusLogo className="w-7 h-7" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", color: "#F1F5F9" }}>
            VIXUS<span style={{ color: LIGHT }}> AI</span>
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
                      style={{ paddingLeft: 40, height: 50, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 12, color: "#F1F5F9", fontSize: 14 }}
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
                      style={{ paddingLeft: 40, paddingRight: 44, height: 50, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 12, color: "#F1F5F9", fontSize: 14 }}
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
                background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                color: "#fff", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 8px 28px rgba(124,58,237,0.4)",
                opacity: loginMutation.isPending ? 0.8 : 1,
              }}
            >
              {loginMutation.isPending ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : "Login"}
            </button>
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
