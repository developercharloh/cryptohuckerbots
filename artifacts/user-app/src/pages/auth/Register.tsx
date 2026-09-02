import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, User, Mail, Lock, MapPin, Phone } from "lucide-react";
import { VixusLogo } from "@/components/VixusLogo";
import { COUNTRIES } from "@/pages/profile/PersonalInfo";

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(5, "Phone number is required").regex(/^\d+$/, "Use digits only"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  country: z.string().min(2, "Country of residence is required"),
  referralCode: z.string().max(15, "Referral code is too long").optional(),
  confirmPassword: z.string(),
  terms: z.boolean().refine(val => val, "You must accept the terms"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const BG = "#07091A";
const CARD = "rgba(25,22,14,0.94)";
const BORDER = "rgba(245,185,66,0.28)";
const LIGHT = "#FFD86B";

const fieldStyle = {
  height: 50, background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(245,185,66,0.2)", borderRadius: 12,
  color: "#F1F5F9", fontSize: 14,
};

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const referralCode = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase() ?? "";

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", phone: "", password: "", country: "🇰🇪 Kenya", referralCode, confirmPassword: "", terms: false },
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    const { terms, confirmPassword, referralCode: enteredReferralCode, ...data } = values;
    const selectedCountry = COUNTRIES.find((country) => country.name === values.country) ?? COUNTRIES[0];
    const payload = {
      ...data,
      phone: `${selectedCountry.dial.replace(/-/g, "")}${values.phone}`,
      ...(enteredReferralCode?.trim() ? { referralCode: enteredReferralCode.trim().toUpperCase() } : {}),
    };
    registerMutation.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Check your email", description: "We sent a verification link to your email address." });
        setLocation(`/verify-email?email=${encodeURIComponent(data.email)}`);
      },
      onError: (err: any) => {
        toast({ title: "Registration failed", description: err.message || "An error occurred", variant: "destructive" });
      },
    });
  };

  return (
    <div style={{ minHeight: "100dvh", background: `linear-gradient(160deg, ${BG} 0%, #15120B 50%, ${BG} 100%)`, display: "flex", flexDirection: "column", padding: "0 24px", position: "relative", overflow: "hidden" }}>

      {/* Glow */}
      <div style={{ position: "absolute", top: "-5%", left: "50%", transform: "translateX(-50%)", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,185,66,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ paddingTop: 52, paddingBottom: 28, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, rgba(245,185,66,0.25), rgba(59,130,246,0.12))", border: "1px solid rgba(245,185,66,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <VixusLogo className="w-6 h-6" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#F1F5F9" }}>
            VIXUS
          </span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#F1F5F9", marginBottom: 6, letterSpacing: "-0.02em" }}>Create Account</h1>
        <p style={{ fontSize: 13, color: "#64748B" }}>Join thousands of traders on VIXUS</p>
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

            <FormField control={form.control} name="country" render={({ field }) => (
              <FormItem style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: "0.03em" }}>Country of Residence</label>
                <FormControl>
                  <div style={{ position: "relative" }}>
                    <MapPin size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                    <select
                      value={field.value}
                      onChange={field.onChange}
                      style={{ ...fieldStyle, width: "100%", paddingLeft: 38, outline: "none" }}
                    >
                      {COUNTRIES.map((country) => (
                        <option key={country.name} value={country.name} style={{ background: "#15120B", color: "#F1F5F9" }}>
                          {country.name} ({country.dial})
                        </option>
                      ))}
                    </select>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="phone" render={({ field }) => {
              const selectedCountry = COUNTRIES.find((country) => country.name === form.getValues("country")) ?? COUNTRIES[0];
              return (
              <FormItem style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: "0.03em" }}>Phone Number</label>
                <FormControl>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ ...fieldStyle, minWidth: 92, padding: "0 10px", display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700 }}>
                      <span aria-hidden="true">{selectedCountry.name.split(" ")[0]}</span>
                      <span>{selectedCountry.dial}</span>
                    </div>
                    <div style={{ position: "relative", flex: 1 }}>
                      <Phone size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                      <Input placeholder="712345678" inputMode="numeric" style={{ ...fieldStyle, width: "100%", paddingLeft: 38 }} {...field} />
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
              );
            }} />

            <FormField control={form.control} name="referralCode" render={({ field }) => (
              <FormItem style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: "0.03em" }}>Referral Code <span style={{ color: "#475569", fontWeight: 500 }}>(Optional)</span></label>
                <FormControl>
                  <Input placeholder="Enter referral code if you have one" style={fieldStyle} {...field} />
                </FormControl>
                <FormMessage />
                {field.value && (
                  <p style={{ fontSize: 10, color: "#FFD86B", marginTop: 1 }}>
                    You were invited by a VIXUS member. The $25 reward unlocks after VIP 1 activation.
                  </p>
                )}
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

            {/* Terms */}
            <FormField control={form.control} name="terms" render={({ field }) => (
              <FormItem>
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
                  onClick={() => { setAgreed(!agreed); field.onChange(!field.value); }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                     background: field.value ? "linear-gradient(135deg, #F5B942, #D99B18)" : "rgba(255,255,255,0.06)",
                     border: field.value ? "none" : "1px solid rgba(245,185,66,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}>
                    {field.value && <svg width="11" height="8" viewBox="0 0 11 8" fill="none"><path d="M1 4L4 7L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>
                    I agree to the{" "}
                    <Link href="/legal/terms" style={{ color: LIGHT, textDecoration: "none" }} onClick={e => e.stopPropagation()}>Terms & Conditions</Link>
                    {" "}and acknowledge the{" "}
                    <Link href="/legal/risk" style={{ color: LIGHT, textDecoration: "none" }} onClick={e => e.stopPropagation()}>Risk Disclosure</Link>, including that Signal Rewards are program credits, not trading returns.
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
                 background: "linear-gradient(135deg, #F5B942, #D99B18)",
                color: "#fff", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                 boxShadow: "0 8px 28px rgba(245,185,66,0.3)",
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
