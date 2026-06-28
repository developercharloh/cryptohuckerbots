import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useGetNotificationSettings,
  useUpdateNotificationSettings,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Bell,
  Mail,
  ArrowLeftRight,
  Gift,
  Bot,
  MessageSquare,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  CheckCheck,
  ShieldCheck,
  Settings2,
  Inbox,
  Megaphone,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type MainTab = "inbox" | "settings";
type SettingsKey = "emailNotifications" | "botAlerts" | "depositWithdrawal" | "promotions";

// Map notification type → icon + color
function getNotifMeta(type: string) {
  switch (type) {
    case "deposit":
      return { Icon: ArrowDownCircle, color: "text-green-400", bg: "bg-green-500/10" };
    case "withdrawal":
      return { Icon: ArrowUpCircle, color: "text-orange-400", bg: "bg-orange-500/10" };
    case "trade":
    case "trade_profit":
    case "trade_loss":
      return { Icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10" };
    case "bot":
      return { Icon: Bot, color: "text-primary", bg: "bg-primary/10" };
    case "support":
      return { Icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-500/10" };
    case "kyc":
      return { Icon: ShieldCheck, color: "text-yellow-400", bg: "bg-yellow-500/10" };
    case "announcement":
      return { Icon: Megaphone, color: "text-indigo-400", bg: "bg-indigo-500/10" };
    default:
      return { Icon: Bell, color: "text-muted-foreground", bg: "bg-muted/30" };
  }
}

// ─── Inbox Tab ────────────────────────────────────────────────────────────────
function InboxTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications = [], isLoading } = useListNotifications({
    query: { refetchInterval: 10000 } as any,
  });

  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        toast({ title: "All notifications cleared" });
      },
    });
  };

  const handleTap = (id: number, isRead: boolean) => {
    if (isRead) return;
    markRead.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array(5).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mark all as read button */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAll}
            disabled={markAll.isPending}
            className="h-7 px-3 text-xs text-primary hover:text-primary rounded-full"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
            Mark all as read
          </Button>
        </div>
      )}

      {/* Empty state */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center">
            <Inbox className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">No notifications yet</p>
          <p className="text-xs text-muted-foreground/60 text-center max-w-[200px]">
            Deposit alerts, bot updates, and account activity will show here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const { Icon, color, bg } = getNotifMeta(n.type);
            return (
              <div
                key={n.id}
                onClick={() => handleTap(n.id, n.isRead)}
                className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                  n.isRead
                    ? "bg-card border-border/40 opacity-60"
                    : "bg-card border-border/60 shadow-sm"
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold leading-snug ${n.isRead ? "text-muted-foreground" : "text-foreground"}`}>
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))] shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                    {n.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetNotificationSettings();
  const updateMutation = useUpdateNotificationSettings();

  const handleToggle = (key: SettingsKey, value: boolean) => {
    updateMutation.mutate({ data: { [key]: value } as any }, {
      onSuccess: () => {
        queryClient.setQueryData(["/api/profile/notification-settings"], (old: any) => ({
          ...old,
          [key]: value,
        }));
      },
      onError: (err: any) => {
        toast({ title: "Failed to update", description: err.message, variant: "destructive" });
      },
    });
  };

  const items = [
    {
      key: "emailNotifications" as const,
      title: "Email Notifications",
      description: "Receive general account updates via email",
      Icon: Mail,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      key: "botAlerts" as const,
      title: "Bot Alerts",
      description: "Get notified when bots start, stop or encounter errors",
      Icon: Bot,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      key: "depositWithdrawal" as const,
      title: "Deposit & Withdrawal",
      description: "Alerts for successful or failed transactions",
      Icon: ArrowLeftRight,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      key: "promotions" as const,
      title: "Promotions",
      description: "News about new bots, features, and special deals",
      Icon: Gift,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
  ];

  return (
    <div className="space-y-3">
      {isLoading ? (
        Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />)
      ) : (
        items.map(({ key, title, description, Icon, color, bg }) => (
          <div key={key} className="flex items-center justify-between p-4 bg-card rounded-2xl">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-0.5">{title}</h3>
                <p className="text-[11px] text-muted-foreground leading-tight">{description}</p>
              </div>
            </div>
            <Switch
              checked={settings?.[key] ?? false}
              onCheckedChange={(checked) => handleToggle(key, checked)}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Notifications() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<MainTab>("inbox");
  const { data: notifications = [] } = useListNotifications();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Layout>
      <div className="p-5 pb-8 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/profile")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-card"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
          </div>
          {unreadCount > 0 && tab === "inbox" && (
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {([
            { id: "inbox" as const, label: "Inbox", Icon: Inbox },
            { id: "settings" as const, label: "Settings", Icon: Settings2 },
          ]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                tab === id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "inbox" ? <InboxTab /> : <SettingsTab />}
      </div>
    </Layout>
  );
}
