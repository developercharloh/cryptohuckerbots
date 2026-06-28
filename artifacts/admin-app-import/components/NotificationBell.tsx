import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, CheckCheck, Globe, Mail, Hash, User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE =
  window.location.hostname !== "localhost" ? "https://quantum-fx-bot.site" : "";

function adminAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("qfx_admin_token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface LoginNotif {
  id: number;
  userId: number;
  accountUid: string;
  fullName: string;
  email: string;
  ip: string;
  country: string;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const [notifs, setNotifs] = useState<LoginNotif[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/login-notifications`, { headers: adminAuthHeaders() });
      if (res.ok) setNotifs(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifs();
    const onLogin = () => fetchNotifs();
    window.addEventListener("qfxLoginNotification", onLogin);
    return () => window.removeEventListener("qfxLoginNotification", onLogin);
  }, [fetchNotifs]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = notifs.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE}/api/admin/login-notifications/read-all`, { method: "POST", headers: adminAuthHeaders() });
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch { /* ignore */ }
  };

  const markRead = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/admin/login-notifications/${id}/read`, { method: "PATCH", headers: adminAuthHeaders() });
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch { /* ignore */ }
  };

  const deleteNotif = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE}/api/admin/login-notifications/${id}`, { method: "DELETE", headers: adminAuthHeaders() });
      setNotifs((prev) => prev.filter((n) => n.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Login notifications"
        className="relative w-8 h-8 rounded-full bg-background border border-border/40 flex items-center justify-center hover:bg-muted transition-colors"
      >
        <Bell className={cn("w-4 h-4", unread > 0 ? "text-primary" : "text-foreground")} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop — tap anywhere outside to close on mobile */}
          <div className="fixed inset-0 z-[199]" onClick={() => setOpen(false)} />
          <div className="fixed top-16 left-1/2 -translate-x-1/2 w-[calc(100vw-1.5rem)] max-w-[26rem] bg-card border border-border rounded-2xl shadow-2xl z-[200] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
            <div>
              <p className="text-sm font-semibold tracking-tight">Login Activity</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {unread > 0 ? `${unread} new` : "All caught up"} · admin only
              </p>
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[28rem] overflow-y-auto divide-y divide-border/40">
            {notifs.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-xs text-muted-foreground">No login events yet</p>
              </div>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.isRead) markRead(n.id); }}
                  className={cn(
                    "px-5 py-3.5 cursor-pointer transition-colors hover:bg-muted/40 relative group",
                    !n.isRead && "bg-primary/5 border-l-[3px] border-primary"
                  )}
                >
                  {/* Delete button (hover) */}
                  <button
                    onClick={(e) => deleteNotif(n.id, e)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    aria-label="Delete"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  {/* Top row: avatar + name + time */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{n.fullName}</p>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Detail grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pl-12">
                    <div className="flex items-center gap-1.5 col-span-2">
                      <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground break-all">{n.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground font-mono">{n.accountUid}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground font-mono">ID: {n.userId}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground">{n.country}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-muted-foreground/70">{n.ip}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
