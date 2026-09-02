import { useState, useEffect, useCallback } from "react";
import {
  useAdminGetSettings,
  useAdminUpdateSettings,
  useAdminListSignalAudit,
  getAdminGetSettingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Save, Bell, BellOff, Volume2 } from "lucide-react";
import { ALARM_KEY, isAlarmEnabled, playTestAlarm } from "@/hooks/useLoginAlarm";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { data: settings, isLoading } = useAdminGetSettings();
  const updateMutation = useAdminUpdateSettings();
  const { data: signalAudit = [] } = useAdminListSignalAudit();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [alarmOn, setAlarmOn] = useState(() => isAlarmEnabled());

  const toggleAlarm = (on: boolean) => {
    setAlarmOn(on);
    localStorage.setItem(ALARM_KEY, on ? "1" : "0");
    window.dispatchEvent(new CustomEvent("vixusAlarmChange", { detail: on }));
  };

  const handleTestAlarm = useCallback(() => {
    playTestAlarm();
  }, []);

  const form = useForm({
    defaultValues: {
      appName: "",
      supportEmail: "",
      maintenanceMode: false,
      depositsEnabled: true,
      withdrawalsEnabled: true,
      minDeposit: 0,
      minWithdrawal: 0,
       signalsEnabled: true,
      signalsEmergencyStop: false,
      signalsTimezone: "Africa/Nairobi",
       signalTimes: ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00", "23:00"],
       signalDailyLimit: 9,
      signalSpacingMinutes: 120,
      signalMaxStakePercent: 10
    }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        appName: settings.appName,
        supportEmail: settings.supportEmail,
        maintenanceMode: settings.maintenanceMode,
        depositsEnabled: settings.depositsEnabled,
        withdrawalsEnabled: settings.withdrawalsEnabled,
        minDeposit: settings.minDeposit,
        minWithdrawal: settings.minWithdrawal,
         signalsEnabled: settings.signalsEnabled,
        signalsEmergencyStop: settings.signalsEmergencyStop,
        signalsTimezone: settings.signalsTimezone,
        signalTimes: settings.signalTimes,
        signalDailyLimit: settings.signalDailyLimit,
        signalSpacingMinutes: settings.signalSpacingMinutes,
        signalMaxStakePercent: settings.signalMaxStakePercent
      });
    }
  }, [settings, form]);

  const onSubmit = (data: any) => {
    const payload = {
      ...data,
      minDeposit: Number(data.minDeposit),
      minWithdrawal: Number(data.minWithdrawal),
      signalsEnabled: data.signalsEnabled,
      signalsEmergencyStop: data.signalsEmergencyStop,
      signalsTimezone: data.signalsTimezone,
      signalTimes: String(data.signalTimes).split(",").map((v: string) => v.trim()).filter(Boolean),
      signalDailyLimit: Number(data.signalDailyLimit),
      signalSpacingMinutes: Number(data.signalSpacingMinutes),
      signalMaxStakePercent: Number(data.signalMaxStakePercent)
    };

    updateMutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({ title: "Settings saved" });
          queryClient.invalidateQueries({ queryKey: getAdminGetSettingsQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to save", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-32 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
      <div className="admin-page p-4 pb-2">
      <div className="pt-1 mb-4">
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">Platform configuration</p>
      </div>

      {/* Login Alarm */}
      <Card className="rounded-2xl border-amber-500/30 mb-4">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {alarmOn
              ? <Bell className="w-4 h-4 text-amber-400" />
              : <BellOff className="w-4 h-4 text-muted-foreground" />}
            Activity Alarm
          </CardTitle>
          <CardDescription className="text-xs">
            Rings when a user logs in, deposits, or withdraws — even if admin tab is in background
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
            alarmOn ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-secondary/10"
          }`}>
            <div>
              <p className="text-sm font-medium">Alarm Sound</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {alarmOn ? "🔔 ON — rings on login · deposit · withdrawal" : "Off — tap to enable"}
              </p>
            </div>
            <Switch
              checked={alarmOn}
              onCheckedChange={toggleAlarm}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>
          {alarmOn && (
            <button
              type="button"
              onClick={handleTestAlarm}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/5 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              Tap to test alarm sound
            </button>
          )}
          <p className="text-[10px] text-muted-foreground px-1">
            For alerts when your screen is off, allow notifications when prompted by your browser.
          </p>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* General */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">General</CardTitle>
              <CardDescription className="text-xs">App name & support contact</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <FormField
                control={form.control}
                name="appName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Application Name</FormLabel>
                    <FormControl><Input {...field} className="h-9 rounded-xl text-sm" data-testid="input-app-name" /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supportEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Support Email</FormLabel>
                    <FormControl><Input type="email" {...field} className="h-9 rounded-xl text-sm" data-testid="input-support-email" /></FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Operations */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">Operations</CardTitle>
              <CardDescription className="text-xs">Enable or disable core features</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <FormField
                control={form.control}
                name="maintenanceMode"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-3 rounded-xl border border-destructive/30 bg-destructive/5">
                    <div>
                      <FormLabel className="text-sm text-destructive font-semibold">Maintenance Mode</FormLabel>
                      <FormDescription className="text-[11px] mt-0.5">Disable access for all users</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-maintenance" /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="depositsEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/10">
                    <FormLabel className="text-sm font-medium">Accept Deposits</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-deposits" /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="withdrawalsEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/10">
                    <FormLabel className="text-sm font-medium">Allow Withdrawals</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-withdrawals" /></FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* AI Signals */}
          <Card className="rounded-2xl border-amber-500/30">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">AI Signals schedule</CardTitle>
              <CardDescription className="text-xs">Server-owned opportunities; missed windows never execute automatically. VIP 1 is paid, while higher VIP levels unlock through active referrals.</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <FormField control={form.control} name="signalsEnabled" render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/10">
                  <div><FormLabel className="text-sm font-medium">Enable AI Signals</FormLabel><FormDescription className="text-[11px]">Allow users to execute current opportunities</FormDescription></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="signalsEmergencyStop" render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3 rounded-xl border border-destructive/30 bg-destructive/5">
                  <div><FormLabel className="text-sm text-destructive font-semibold">Emergency stop</FormLabel><FormDescription className="text-[11px]">Immediately disable all new signal claims</FormDescription></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="signalsTimezone" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">IANA timezone</FormLabel><FormControl><Input {...field} className="h-9 rounded-xl text-sm" placeholder="Africa/Nairobi" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="signalTimes" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Times (HH:MM)</FormLabel><FormControl><Input value={field.value.join(", ")} onChange={e => field.onChange(e.target.value.split(",").map(v => v.trim()))} className="h-9 rounded-xl text-sm" placeholder="07:00, 09:00, 11:00, ..." /></FormControl></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <FormField control={form.control} name="signalDailyLimit" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Daily limit</FormLabel><FormControl><Input type="number" min="1" max="20" {...field} className="h-9 rounded-xl text-sm" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="signalSpacingMinutes" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Spacing (min)</FormLabel><FormControl><Input type="number" min="30" {...field} className="h-9 rounded-xl text-sm" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="signalMaxStakePercent" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Max stake %</FormLabel><FormControl><Input type="number" min="1" max="100" {...field} className="h-9 rounded-xl text-sm" /></FormControl></FormItem>
                )} />
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs font-semibold">VIP signal policy</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                   VIP 1 requires a $350 Main Wallet activation and unlocks 2 daily signals. VIP 2–10 require active VIP 1 referrals only: 5, 10, 20, 35, 55, 80, 110, 145, and 185 referrals respectively.
                   Daily allowances run from 2 through 11 signals, each with a disclosed $2.25 reward. VIP status changes signal access only and never guarantees returns or restricts withdrawals.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/10 p-3">
                <p className="text-xs font-semibold mb-2">Recent schedule changes</p>
                {signalAudit.length === 0 ? <p className="text-[11px] text-muted-foreground">No changes recorded yet.</p> : signalAudit.slice(0, 5).map(item => (
                  <div key={item.id} className="flex justify-between gap-3 py-1.5 border-t border-border/40 first:border-0">
                    <span className="text-[11px]">{item.action}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Financial Rules */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">Financial Rules</CardTitle>
              <CardDescription className="text-xs">Limits & commissions</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <FormField
                control={form.control}
                name="minDeposit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Min Deposit ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} className="h-9 rounded-xl text-sm" data-testid="input-min-deposit" /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minWithdrawal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Min Withdrawal ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} className="h-9 rounded-xl text-sm" data-testid="input-min-withdrawal" /></FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Settlement Network */}
          <Card className="rounded-2xl border-amber-500/30">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">Settlement Network</CardTitle>
              <CardDescription className="text-xs">Deposits and withdrawals are locked to one supported network.</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <p className="text-sm font-semibold">USDT on BNB Smart Chain (BEP-20)</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  All other deposit and withdrawal methods have been removed. Users can deposit to the platform address and withdraw only to a valid BEP-20 wallet address.
                </p>
                <p className="break-all rounded-lg bg-background/70 p-2 font-mono text-[11px] text-amber-300">
                  {settings?.paymentMethods?.[0]?.address ?? "Configured on the server"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button
            type="submit"
            className="w-full h-12 rounded-2xl text-sm font-semibold"
            disabled={updateMutation.isPending}
            data-testid="btn-save-settings"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save All Settings"}
          </Button>

          <div className="h-2" />
        </form>
      </Form>
    </div>
  );
}
