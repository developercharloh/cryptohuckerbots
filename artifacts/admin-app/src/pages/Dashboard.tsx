import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useAdminGetOverview,
  useAdminBroadcast,
  getAdminGetOverviewQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Users, Bot, CircleDollarSign, Activity, Megaphone, CheckCircle, Clock } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const kpis = [
  { key: "totalUsers", label: "Users", icon: Users, color: "text-blue-400", sub: (d: any) => `+${d.newUsersToday} today` },
  { key: "activeBotInstances", label: "Active Bots", icon: Bot, color: "text-purple-400", sub: (d: any) => `${d.totalBots} types` },
  { key: "netRevenue", label: "Revenue", icon: CircleDollarSign, color: "text-emerald-400", format: "currency", sub: () => "Net total" },
  { key: "pendingWork", label: "Pending", icon: Activity, color: "text-amber-400", sub: () => "Needs action" },
];

export default function Dashboard() {
  const { data: overview, isLoading, isError, refetch } = useAdminGetOverview();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  const broadcastMutation = useAdminBroadcast();

  const handleBroadcast = () => {
    broadcastMutation.mutate(
      { data: { title: broadcastTitle, message: broadcastMessage } },
      {
        onSuccess: () => {
          toast({ title: "Broadcast sent" });
          setIsBroadcastOpen(false);
          setBroadcastTitle("");
          setBroadcastMessage("");
          queryClient.invalidateQueries({ queryKey: getAdminGetOverviewQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to broadcast", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const chartData = useMemo(() => {
    if (!overview?.revenueSeries) return [];
    return overview.revenueSeries.map(point => ({
      date: format(new Date(point.date), "MMM d"),
      value: point.value
    }));
  }, [overview?.revenueSeries]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-destructive text-sm font-medium">Failed to load dashboard</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  const pendingWork = overview.pendingDeposits + overview.pendingWithdrawals + overview.pendingKyc + overview.openTickets;

  return (
    <div className="p-4 space-y-4 pb-2">
      {/* Header row */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Overview</h1>
          <p className="text-xs text-muted-foreground">Platform metrics</p>
        </div>
        <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 gap-1.5 rounded-xl" data-testid="btn-new-broadcast">
              <Megaphone className="w-3.5 h-3.5" />
              Broadcast
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Broadcast</DialogTitle>
              <DialogDescription>Send a message to all users.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Title</label>
                <Input value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} placeholder="Announcement Title" data-testid="input-broadcast-title" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Message</label>
                <Textarea value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} placeholder="Type your message..." rows={4} data-testid="input-broadcast-message" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBroadcastOpen(false)}>Cancel</Button>
              <Button onClick={handleBroadcast} disabled={!broadcastTitle || !broadcastMessage || broadcastMutation.isPending} data-testid="btn-send-broadcast">
                {broadcastMutation.isPending ? "Sending..." : "Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ key, label, icon: Icon, color, format: fmt, sub }) => {
          const rawVal = key === "pendingWork" ? pendingWork : (overview as any)[key];
          const displayVal = fmt === "currency"
            ? `$${Math.abs(Number(rawVal)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            : Number(rawVal).toLocaleString();
          return (
            <Card key={key} className="rounded-2xl border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                  <div className={`w-7 h-7 rounded-lg bg-secondary flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold tracking-tight" data-testid={`stat-${key}`}>{displayVal}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{sub(overview)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue Chart */}
      <Card className="rounded-2xl border-border/60">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-semibold">Revenue — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <div className="h-[160px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} interval={6} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 3, fill: 'hsl(var(--primary))' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                No data yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Queues */}
      <div>
        <p className="text-sm font-semibold mb-2">Pending Queues</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Deposits", count: overview.pendingDeposits, href: "/finance?status=pending" },
            { label: "Withdrawals", count: overview.pendingWithdrawals, href: "/finance?status=pending" },
            { label: "KYC", count: overview.pendingKyc, href: "/users?tab=kyc" },
            { label: "Tickets", count: overview.openTickets, href: "/support?status=open" },
          ].map(item => (
            <Link key={item.label} href={item.href}>
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors cursor-pointer">
                <span className="text-xs font-medium">{item.label}</span>
                {item.count > 0
                  ? <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{item.count}</Badge>
                  : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                }
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <p className="text-sm font-semibold mb-2">Recent Activity</p>
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-0 divide-y divide-border/50">
            {overview.recentTransactions.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">No recent activity</div>
            ) : (
              overview.recentTransactions.slice(0, 5).map(txn => (
                <div key={txn.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{txn.userName}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span className="capitalize">{txn.type.replace('_', ' ')}</span>
                      <span>·</span>
                      <span>{txn.status}</span>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ml-3 ${txn.type === 'deposit' || txn.type === 'trade_profit' ? 'text-emerald-400' : 'text-foreground'}`}>
                    {txn.type === 'deposit' || txn.type === 'trade_profit' ? '+' : ''}${txn.amount.toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
