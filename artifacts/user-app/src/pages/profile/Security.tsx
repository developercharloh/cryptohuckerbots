import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useChangePassword,
  useGet2FA,
  useListSessions,
  useRevokeSession,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ChevronLeft, Laptop, Smartphone, Shield, Key, ChevronRight,
  Eye, EyeOff, Monitor, Copy, Check, ShieldCheck, ShieldOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

function getToken() {
  return localStorage.getItem("vixus_token") ?? "";
}

async function api2FA(path: string, body?: object) {
  const r = await fetch(`/api/profile/2fa/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || "Request failed");
  return json;
}

export default function Security() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const changePwdMutation = useChangePassword();
  const { data: twoFA, isLoading: loading2FA } = useGet2FA();
  const { data: sessions, isLoading: loadingSessions } = useListSessions();
  const revokeSessionMutation = useRevokeSession();

  const [pwdOpen, setPwdOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [showCurPwd, setShowCurPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfPwd, setShowConfPwd] = useState(false);

  // 2FA setup sheet (enable flow)
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; qrCode: string } | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Disable 2FA dialog
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);

  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onPasswordSubmit = (values: z.infer<typeof passwordSchema>) => {
    changePwdMutation.mutate({ data: { currentPassword: values.currentPassword, newPassword: values.newPassword } }, {
      onSuccess: () => {
        toast({ title: "Password changed successfully" });
        form.reset();
        setPwdOpen(false);
      },
      onError: (err: any) => {
        toast({ title: "Failed to change password", description: err.message, variant: "destructive" });
      },
    });
  };

  // Toggle switch handler
  const handleToggle2FA = async (checked: boolean) => {
    if (checked) {
      // Start enable flow: call setup to get QR + secret
      setSetupLoading(true);
      try {
        const data = await api2FA("setup");
        setSetupData(data);
        setSetupCode("");
        setSetupOpen(true);
      } catch (err: any) {
        toast({ title: "Setup failed", description: err.message, variant: "destructive" });
      } finally {
        setSetupLoading(false);
      }
    } else {
      // Start disable flow: show confirm dialog
      setDisableCode("");
      setDisableOpen(true);
    }
  };

  const handleEnable = async () => {
    if (setupCode.length !== 6) {
      toast({ title: "Enter the 6-digit code from your authenticator app", variant: "destructive" });
      return;
    }
    setSetupLoading(true);
    try {
      await api2FA("enable", { code: setupCode });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/2fa"] });
      toast({ title: "2FA enabled", description: "Your account is now protected with two-factor authentication." });
      setSetupOpen(false);
      setSetupData(null);
    } catch (err: any) {
      toast({ title: "Invalid code", description: err.message, variant: "destructive" });
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDisable = async () => {
    if (disableCode.length !== 6) {
      toast({ title: "Enter your 6-digit authenticator code to confirm", variant: "destructive" });
      return;
    }
    setDisableLoading(true);
    try {
      await api2FA("disable", { code: disableCode });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/2fa"] });
      toast({ title: "2FA disabled", description: "Two-factor authentication has been turned off." });
      setDisableOpen(false);
    } catch (err: any) {
      toast({ title: "Invalid code", description: err.message, variant: "destructive" });
    } finally {
      setDisableLoading(false);
    }
  };

  const copySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevokeSession = (id: number) => {
    revokeSessionMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Session revoked" });
        queryClient.invalidateQueries({ queryKey: ["/api/profile/sessions"] });
      },
    });
  };

  return (
    <Layout>
      <div className="p-5 pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/profile")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Security</h1>
        </div>

        <div className="space-y-3">
          {/* Change Password */}
          <Collapsible open={pwdOpen} onOpenChange={setPwdOpen} className="bg-card rounded-2xl overflow-hidden">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-semibold text-sm">Change Password</span>
                </div>
                <ChevronRight className={`w-5 h-5 text-muted-foreground opacity-50 transition-transform ${pwdOpen ? "rotate-90" : ""}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 pt-0 border-t border-border/50">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onPasswordSubmit)} className="space-y-4 pt-4">
                  {(["currentPassword", "newPassword", "confirmPassword"] as const).map((name, idx) => (
                    <FormField key={name} control={form.control} name={name} render={({ field }) => {
                      const shown = [showCurPwd, showNewPwd, showConfPwd][idx];
                      const setShown = [setShowCurPwd, setShowNewPwd, setShowConfPwd][idx];
                      const labels = ["Current Password", "New Password", "Confirm Password"];
                      return (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-muted-foreground font-normal text-xs">{labels[idx]}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type={shown ? "text" : "password"} placeholder="••••••••" className="bg-background border-none h-12 rounded-xl px-4 pr-12" {...field} />
                              <button type="button" onClick={() => setShown(!shown)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                                {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }} />
                  ))}
                  <Button type="submit" className="w-full h-12 rounded-xl text-sm font-medium shadow-none mt-2" disabled={changePwdMutation.isPending}>
                    {changePwdMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </form>
              </Form>
            </CollapsibleContent>
          </Collapsible>

          {/* Two-Factor Authentication */}
          <div className="bg-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${twoFA?.enabled ? "bg-green-500/10" : "bg-primary/10"}`}>
                  <Key className={`w-5 h-5 ${twoFA?.enabled ? "text-green-400" : "text-primary"}`} />
                </div>
                <div>
                  <span className="font-semibold text-sm block mb-0.5">Two-Factor Authentication</span>
                  {loading2FA ? (
                    <Skeleton className="w-16 h-3" />
                  ) : (
                    <span className={`text-[10px] font-semibold ${twoFA?.enabled ? "text-green-400" : "text-muted-foreground"}`}>
                      {twoFA?.enabled ? "● Enabled" : "○ Disabled"}
                    </span>
                  )}
                </div>
              </div>
              {loading2FA || setupLoading ? (
                <Skeleton className="w-10 h-6 rounded-full" />
              ) : (
                <Switch
                  checked={twoFA?.enabled ?? false}
                  onCheckedChange={handleToggle2FA}
                  disabled={setupLoading}
                  className="data-[state=checked]:bg-green-500"
                />
              )}
            </div>
            {twoFA?.enabled && (
              <p className="text-[10px] text-green-400/80 mt-3 ml-14">
                Your account is secured with Google Authenticator. A 6-digit code is required at each login.
              </p>
            )}
          </div>

          {/* Login Sessions */}
          <Collapsible open={sessionsOpen} onOpenChange={setSessionsOpen} className="bg-card rounded-2xl overflow-hidden">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                    <Monitor className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-semibold text-sm">Login Sessions</span>
                </div>
                <ChevronRight className={`w-5 h-5 text-muted-foreground opacity-50 transition-transform ${sessionsOpen ? "rotate-90" : ""}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 pt-0 border-t border-border/50">
              <div className="space-y-3 pt-4">
                {loadingSessions ? (
                  Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
                ) : (
                  sessions?.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-3 bg-background rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          {session.device.toLowerCase().includes("mobile")
                            ? <Smartphone className="w-4 h-4 text-muted-foreground" />
                            : <Laptop className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div>
                          <div className="font-medium text-xs flex items-center gap-2">
                            {session.device}
                            {session.isCurrent && (
                              <span className="text-[9px] bg-green-500/10 text-green-500 px-1.5 py-0 rounded-full">Current</span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{session.location || session.ip}</div>
                        </div>
                      </div>
                      {!session.isCurrent && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-500 hover:bg-red-500/10"
                          onClick={() => handleRevokeSession(session.id)} disabled={revokeSessionMutation.isPending}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* ── Setup 2FA Sheet ──────────────────────────────────────────── */}
      <Sheet open={setupOpen} onOpenChange={(o) => { if (!o) { setSetupOpen(false); setSetupData(null); } }}>
        <SheetContent side="bottom" className="bg-background border-t border-border rounded-t-3xl max-h-[92vh] overflow-y-auto pb-10">
          <SheetHeader className="mb-6 text-left">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <SheetTitle className="text-xl font-bold">Set Up 2FA</SheetTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Scan the QR code below with <strong className="text-foreground">Google Authenticator</strong>, then enter the 6-digit code to activate.
            </p>
          </SheetHeader>

          {setupData ? (
            <div className="space-y-5">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-2xl">
                  <img src={setupData.qrCode} alt="2FA QR Code" className="w-44 h-44" />
                </div>
              </div>

              {/* Steps */}
              <div className="bg-card rounded-2xl p-4 space-y-2">
                {[
                  "Open Google Authenticator on your phone",
                  'Tap "+" → "Scan a QR code"',
                  "Point your camera at the QR code above",
                  "Enter the 6-digit code below to confirm",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-xs text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>

              {/* Secret key (manual entry fallback) */}
              <div className="bg-card rounded-2xl p-4">
                <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Can't scan? Enter this key manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-foreground bg-background rounded-xl px-3 py-2.5 tracking-widest break-all">
                    {setupData.secret}
                  </code>
                  <button onClick={copySecret} className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-primary" />}
                  </button>
                </div>
              </div>

              {/* Code input */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Enter 6-digit code from your app:</p>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={setupCode}
                  onChange={e => setSetupCode(e.target.value.slice(0, 6))}
                  className="h-14 rounded-xl text-center text-2xl font-mono tracking-widest bg-card border-none"
                />
              </div>

              <Button
                className="w-full h-14 rounded-xl text-base font-semibold"
                onClick={handleEnable}
                disabled={setupLoading || setupCode.length !== 6}
              >
                {setupLoading ? "Activating..." : "Activate 2FA"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Disable 2FA Dialog ───────────────────────────────────────── */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="bg-background border-border rounded-3xl max-w-sm mx-auto">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mb-2 mx-auto">
              <ShieldOff className="w-6 h-6 text-red-500" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">Disable 2FA</DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app to confirm. This will remove 2FA protection from your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={disableCode}
              onChange={e => setDisableCode(e.target.value.slice(0, 6))}
              className="h-14 rounded-xl text-center text-2xl font-mono tracking-widest bg-card border-none"
            />
            <Button
              variant="destructive"
              className="w-full h-12 rounded-xl font-semibold"
              onClick={handleDisable}
              disabled={disableLoading || disableCode.length !== 6}
            >
              {disableLoading ? "Disabling..." : "Yes, Disable 2FA"}
            </Button>
            <Button variant="ghost" className="w-full h-12 rounded-xl" onClick={() => setDisableOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
