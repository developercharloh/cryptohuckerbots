import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ShieldCheck, ChevronLeft } from "lucide-react";
import { VixusLogo } from "@/components/VixusLogo";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const search = useSearch();
  const prefilledEmail = new URLSearchParams(search).get("email") ?? "";

  // 2FA step state
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [tempToken, setTempToken] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefilledEmail, password: "", rememberMe: false },
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
          toast({ title: "Login successful" });
          setLocation("/dashboard");
        }
      },
      onError: (err: any) => {
        toast({ title: "Login failed", description: err.message || "An error occurred", variant: "destructive" });
      },
    });
  };

  const handle2FAVerify = async () => {
    if (twoFACode.length !== 6) {
      toast({ title: "Enter the 6-digit code from your authenticator app", variant: "destructive" });
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
      toast({ title: "Login successful" });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Invalid code", description: err.message, variant: "destructive" });
      setTwoFACode("");
    } finally {
      setVerifying(false);
    }
  };

  // ── 2FA step UI ───────────────────────────────────────────────────
  if (step === "2fa") {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-background p-6 pt-12">
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2.5 mb-8">
            <VixusLogo className="w-9 h-9" />
            <span className="text-xl font-bold tracking-tight text-white">
              VIXUS<span className="text-primary"> AI</span>
            </span>
          </div>

          <button
            onClick={() => setStep("credentials")}
            className="flex items-center gap-1 text-muted-foreground text-sm mb-8 w-fit"
          >
            <ChevronLeft className="w-4 h-4" /> Back to login
          </button>

          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Two-Factor Authentication</h1>
            <p className="text-muted-foreground text-sm">
              Open <strong className="text-foreground">Google Authenticator</strong> and enter the 6-digit code for <strong className="text-foreground">VIXUS AI</strong>.
            </p>
          </div>

          <div className="space-y-5">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="000 000"
              maxLength={6}
              value={twoFACode}
              onChange={e => setTwoFACode(e.target.value.slice(0, 6))}
              className="h-16 rounded-xl text-center text-3xl font-mono tracking-[0.5em] bg-card border-none"
            />

            <Button
              className="w-full h-14 rounded-xl text-lg font-medium shadow-none"
              onClick={handle2FAVerify}
              disabled={verifying || twoFACode.length !== 6}
            >
              {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Login"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Code refreshes every 30 seconds. Make sure your phone clock is accurate.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Credentials step UI ───────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background p-6 pt-12">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2.5 mb-8">
          <VixusLogo className="w-9 h-9" />
          <span className="text-xl font-bold tracking-tight text-white">
            VIXUS<span className="text-primary"> AI</span>
          </span>
        </div>

        <div className="mb-8 w-full">
          <h1 className="text-2xl font-bold mb-1.5">Welcome back</h1>
          <p className="text-muted-foreground text-sm">Log in to your account</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 w-full">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-muted-foreground font-normal">Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" type="email" className="bg-card border-border h-12 rounded-xl text-base px-4" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-muted-foreground font-normal">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input placeholder="••••••••" type={showPassword ? "text" : "password"} className="bg-card border-border h-12 rounded-xl text-base px-4 pr-12" {...field} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex items-center justify-between pt-1 pb-2">
              <FormField control={form.control} name="rememberMe" render={({ field }) => (
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" checked={field.value} onCheckedChange={field.onChange} className="rounded border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                  <label htmlFor="remember" className="text-sm font-medium leading-none text-muted-foreground">Remember me</label>
                </div>
              )} />
              <Link href="/forgot-password" className="text-sm text-primary font-medium">Forgot password?</Link>
            </div>

            <Button type="submit" className="w-full h-14 rounded-xl text-lg font-medium shadow-none" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Login"}
            </Button>
          </form>
        </Form>

        <div className="mt-8 pb-6 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/register" className="text-primary font-medium">Register</Link>
        </div>
      </div>
    </div>
  );
}
