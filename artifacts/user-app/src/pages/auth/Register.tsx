import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, User, Mail, Lock, Tag } from "lucide-react";
import { VixusLogo } from "@/components/VixusLogo";

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  referralCode: z.string().optional(),
  terms: z.boolean().refine(val => val, "You must accept the terms"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const BG = "#07091A";
const CARD = "rgba(20,16,48,0.9)";
const BORDER = "rgba(124,58,237,0.2)";
const LIGHT = "#A78BFA";

const fieldStyle = {
  height: 50, background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(124,58,237,0.15)", borderRadius: 12,
  color: "#F1F5F9", fontSize: 14,
};

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", referralCode: "", terms: false },
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    const { terms, confirmPassword, ...data } = values;
    registerMutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Account created", description: "Please sign in." });
        setLocation(`/login?email=${encodeURIComponent(data.email)}`);
      },
      onError: (err: any) => {
        toast({ title: "Registration failed", description: err.message || "An error occurred", variant: "destructive" });
      },
    });
  };

  return (
    <div style={{ minHeight: "100dvh", background: `linear-gradient(160deg, ${BG} 0%, #0F0A2E 50%, ${BG} 100%)`, display: "flex", flexDirection: "column", padding: "0 24px", position: "relative", overflow: "hidden" }}>

      {/* Glow */}
      <div style={{ position: "absolute", top: "-5%", left: "50%", transform: "translateX(-50%)", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ paddingTop: 52, paddingBottom: 28, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(79,70,229,0.15))", border: "1px solid rgba(124,58,237,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <VixusLogo className="w-6 h-6" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#F1F5F9" }}>
            VIXUS<span style={{ color: LIGHT }}> AI</span>
          </span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#F1F5F9", marginBottom: 6, letterSpacing: "-0.02em" }}>Create Account</h1>
        <p style={{ fontSize: 13, color: "#64748B" }}>Join thousands of traders on VIXUS AI</p>
      </div>

      {/* Form */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 24, padding: "22px 20px", backdropFilter: "blur(16px)", position: "relative", zIndex: 1, marginBottom: 24 }}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <FormField control={form.control} name="fullName" render={({ field }) => (
              <FormItem style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: "0.03em" }}>Full Name</label>
                <FormControl>
                  <div style={{ position: "relative" }}>
                    <User size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                    <Input placeholder="John Doe" style={{ ...fieldStyle, paddingLeft: 38 }} {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: "0.03em" }}>Email Address</label>
                <FormControl>
                  <div style={{ position: "relative" }}>
                    <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                    <Input placeholder="name@example.com" type="email" style={{ ...fieldStyle, paddingLeft: 38 }} {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: "0.03em" }}>Create Password</label>
                <FormControl>
                  <div style={{ position: "relative" }}>
                    <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                    <Input placeholder="••••••••" type={showPassword ? "text" : "password"} style={{ ...fieldStyle, paddingLeft: 38, paddingRight: 42 }} {...field} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="confirmPassword" render={({ field }) => (
              <FormItem style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: "0.03em" }}>Confirm Password</label>
                <FormControl>
                  <div style={{ position: "relative" }}>
                    <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                    <Input placeholder="••••••••" type={showConfirm ? "text" : "password"} style={{ ...fieldStyle, paddingLeft: 38, paddingRight: 42 }} {...field} />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="referralCode" render={({ field }) => (
              <FormItem style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: "0.03em" }}>Referral Code <span style={{ color: "#334155" }}>(Optional)</span></label>
                <FormControl>
                  <div style={{ position: "relative" }}>
                    <Tag size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                    <Input placeholder="VAI-12345" style={{ ...fieldStyle, paddingLeft: 38 }} {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Terms */}
            <FormField control={form.control} name="terms" render={({ field }) => (
              <FormItem>
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
                  onClick={() => { setAgreed(!agreed); field.onChange(!field.value); }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                    background: field.value ? "linear-gradient(135deg, #7C3AED, #4F46E5)" : "rgba(255,255,255,0.06)",
                    border: field.value ? "none" : "1px solid rgba(124,58,237,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}>
                    {field.value && <svg width="11" height="8" viewBox="0 0 11 8" fill="none"><path d="M1 4L4 7L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>
                    I agree to the{" "}
                    <Link href="/legal/terms" style={{ color: LIGHT, textDecoration: "none" }} onClick={e => e.stopPropagation()}>Terms & Conditions</Link>
                  </span>
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <button
              type="submit"
              disabled={registerMutation.isPending}
              style={{
                width: "100%", height: 54, borderRadius: 14, fontSize: 16, fontWeight: 700,
                background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                color: "#fff", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 8px 28px rgba(124,58,237,0.4)",
                opacity: registerMutation.isPending ? 0.8 : 1,
                marginTop: 4,
              }}
            >
              {registerMutation.isPending ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : "Create Account"}
            </button>
          </form>
        </Form>
      </div>

      <div style={{ textAlign: "center", paddingBottom: 40, position: "relative", zIndex: 1 }}>
        <span style={{ fontSize: 13, color: "#475569" }}>Already have an account? </span>
        <Link href="/login" style={{ fontSize: 13, color: LIGHT, fontWeight: 700, textDecoration: "none" }}>Login</Link>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
