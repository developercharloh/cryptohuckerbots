import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetBot, useToggleBot, useGetBotAnalytics } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const PERIODS = [
  { id: "daily",   label: "Daily" },
  { id: "weekly",  label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly",  label: "Yearly" },
];

function PeriodDropdown({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = PERIODS.find(p => p.id === value) ?? PERIODS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 bg-[#1a2235] border border-white/10 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
      >
        {selected.label}
        <ChevronDown className="w-3 h-3 text-white/60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-[#1a2235] border border-white/10 rounded-xl shadow-xl overflow-hidden">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${
                p.id === value
                  ? "bg-primary text-white font-semibold"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BotDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState("daily");

  const { data: bot, isLoading } = useGetBot(id, { query: { enabled: !!id } as any });
  const { data: analytics, isLoading: loadingAnalytics } = useGetBotAnalytics(id, period, {
    query: { enabled: !!id } as any,
  });
  const toggleMutation = useToggleBot();

  const handleToggle = () => {
    toggleMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: bot?.status === "running" ? "Bot paused" : "Bot started" });
        queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
        queryClient.invalidateQueries({ queryKey: [`/api/bots/${id}`] });
      },
      onError: (err: any) => {
        toast({ title: "Action failed", description: err.message, variant: "destructive" });
      },
    });
  };

  if (!id) { setLocation("/bots"); return null; }

  return (
    <Layout>
      <div className="p-5 pb-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/bots")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-card"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          {isLoading ? (
            <Skeleton className="h-6 w-32" />
          ) : (
            <div className="flex-1">
              <h1 className="text-xl font-bold tracking-tight">{bot?.name}</h1>
              <div className={`text-[10px] px-2 py-0.5 mt-1 rounded-full inline-flex items-center ${
                bot?.status === "running" ? "text-green-500 bg-green-500/10" : "text-muted-foreground bg-muted"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${bot?.status === "running" ? "bg-green-500" : "bg-muted-foreground"}`} />
                {bot?.status === "running" ? "Running" : "Paused"}
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-card border-none rounded-2xl shadow-none">
            <CardContent className="p-4">
              <div className="text-[11px] font-medium text-muted-foreground mb-1">Win Rate</div>
              {isLoading ? <Skeleton className="h-7 w-16" /> : (
                <div className="text-xl font-bold">{bot?.winRate}%</div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card border-none rounded-2xl shadow-none">
            <CardContent className="p-4">
              <div className="text-[11px] font-medium text-muted-foreground mb-1">Profit Today</div>
              {isLoading ? <Skeleton className="h-7 w-16" /> : (
                <div className="text-xl font-bold text-green-500">+${bot?.profitToday}</div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card border-none rounded-2xl shadow-none">
            <CardContent className="p-4">
              <div className="text-[11px] font-medium text-muted-foreground mb-1">Total Profit</div>
              {isLoading ? <Skeleton className="h-7 w-16" /> : (
                <div className="text-xl font-bold text-green-500">+${bot?.profitTotal}</div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card border-none rounded-2xl shadow-none">
            <CardContent className="p-4">
              <div className="text-[11px] font-medium text-muted-foreground mb-1">Total Trades</div>
              {isLoading ? <Skeleton className="h-7 w-16" /> : (
                <div className="text-xl font-bold">{bot?.totalTrades}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Chart */}
        <div className="bg-card border-none rounded-2xl p-5 shadow-none">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-[15px]">Performance</h3>
            <PeriodDropdown value={period} onChange={setPeriod} />
          </div>
          <div className="h-[180px] w-[calc(100%+10px)] -ml-[10px]">
            {loadingAnalytics ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics || []} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBot" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0D1B2E", borderColor: "#1E293B", borderRadius: "12px", padding: "8px" }}
                    itemStyle={{ color: "#fff", fontSize: "13px", fontWeight: "bold" }}
                    labelStyle={{ color: "#94A3B8", fontSize: "11px", marginBottom: "4px" }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Cumulative"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#7C3AED"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorBot)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4">
          <Button
            className="w-full h-14 rounded-xl text-[15px] font-bold shadow-none bg-gradient-to-r from-[#7C3AED] to-[#9333ea] hover:opacity-90"
            onClick={() => setLocation(`/bots/${id}/analytics`)}
          >
            View Analytics
          </Button>
        </div>
      </div>
    </Layout>
  );
}
