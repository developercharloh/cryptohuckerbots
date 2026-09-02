import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE, fetchWithTimeout } from "@/lib/api-base";

type HealthStatus = "healthy" | "warning" | "critical";

type HealthCheck = {
  key: string;
  label: string;
  status: HealthStatus;
  message: string;
};

type TechnicalIncident = {
  id: number;
  source: string;
  event: string;
  route: string;
  message: string;
  status: "active" | "resolved";
  occurrences: number;
  lastStatusCode: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
};

type HealthResponse = {
  checkedAt: string;
  status: HealthStatus;
  activeCount: number;
  criticalCount: number;
  checks: HealthCheck[];
  incidents: TechnicalIncident[];
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: HealthStatus): string {
  return status === "healthy" ? "Healthy" : status === "warning" ? "Needs attention" : "Critical";
}

function StatusIcon({ status, className = "h-4 w-4" }: { status: HealthStatus; className?: string }) {
  if (status === "healthy") return <CheckCircle2 className={`${className} text-emerald-400`} />;
  if (status === "critical") return <ShieldAlert className={`${className} text-red-400`} />;
  return <AlertTriangle className={`${className} text-amber-400`} />;
}

function incidentStatus(incident: TechnicalIncident): HealthStatus {
  return incident.lastStatusCode !== null && incident.lastStatusCode >= 500 ? "critical" : "warning";
}

export default function TechnicalHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyIncidentId, setBusyIncidentId] = useState<number | null>(null);

  const loadHealth = useCallback(async (quiet = false) => {
    if (quiet) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");
    try {
      const response = await fetchWithTimeout(
        `${API_BASE}/api/admin/technical-health`,
        { credentials: "include" },
        15_000,
      );
      if (!response.ok) throw new Error("Health data is temporarily unavailable.");
      const nextHealth = await response.json() as HealthResponse;
      setHealth(nextHealth);
    } catch {
      setError("Health data is temporarily unavailable.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
    const interval = window.setInterval(() => void loadHealth(true), 30_000);
    return () => window.clearInterval(interval);
  }, [loadHealth]);

  const updateIncident = async (incident: TechnicalIncident, action: "resolve" | "reopen") => {
    setBusyIncidentId(incident.id);
    try {
      const response = await fetchWithTimeout(
        `${API_BASE}/api/admin/technical-incidents/${incident.id}/${action}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { Accept: "application/json" },
        },
        15_000,
      );
      if (!response.ok) throw new Error("Could not update incident.");
      await loadHealth(true);
    } catch {
      setError("The incident could not be updated. Please try again.");
    } finally {
      setBusyIncidentId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="admin-page p-4 space-y-4 pb-8">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="admin-page flex min-h-[60vh] flex-col items-center justify-center gap-3 p-4 text-center">
        <ShieldAlert className="h-8 w-8 text-amber-400" />
        <div>
          <h1 className="font-semibold">System Health</h1>
          <p className="mt-1 text-sm text-muted-foreground">{error || "Health data is temporarily unavailable."}</p>
        </div>
        <Button onClick={() => void loadHealth()} size="sm">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  const activeIncidents = health.incidents.filter((incident) => incident.status === "active");
  const resolvedIncidents = health.incidents.filter((incident) => incident.status === "resolved");

  return (
    <div className="admin-page space-y-4 p-4 pb-8 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Operations</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight">System Health</h1>
          <p className="mt-1 text-xs text-muted-foreground">Private technical monitoring for the VIXUS platform.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadHealth(true)}
          disabled={isRefreshing}
          data-testid="button-refresh-health"
        >
          <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <Card className="overflow-hidden rounded-2xl border-border/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
              health.status === "healthy" ? "bg-emerald-500/10" : health.status === "critical" ? "bg-red-500/10" : "bg-amber-500/10"
            }`}>
              <StatusIcon status={health.status} className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{statusLabel(health.status)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last checked {formatTime(health.checkedAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <p className="text-2xl font-bold tracking-tight">{health.activeCount}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active warnings</p>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-red-400">{health.criticalCount}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Critical</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {health.checks.map((check) => {
          const Icon = check.key === "database" ? Database : check.key === "startup" ? Activity : Server;
          return (
            <Card key={check.key} className="rounded-2xl border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <StatusIcon status={check.status} />
                </div>
                <p className="mt-3 text-sm font-semibold">{check.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{check.message}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-2xl border-border/60">
        <CardHeader className="flex-row items-center justify-between space-y-0 px-4 pb-3 pt-4">
          <div>
            <CardTitle className="text-sm">Active technical warnings</CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">Sanitized browser and API failures grouped by issue.</p>
          </div>
          <Activity className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {activeIncidents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <Check className="mx-auto h-6 w-6 text-emerald-400" />
              <p className="mt-2 text-sm font-medium">No active technical issues</p>
              <p className="mt-1 text-xs text-muted-foreground">The public experience is currently clear.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {activeIncidents.map((incident) => {
                const severity = incidentStatus(incident);
                return (
                  <div key={incident.id} className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusIcon status={severity} className="h-3.5 w-3.5" />
                        <span className="text-sm font-semibold">{incident.event.replaceAll("_", " ")}</span>
                        <Badge variant={severity === "critical" ? "destructive" : "secondary"} className="text-[10px] capitalize">
                          {severity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{incident.source}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{incident.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        <span className="font-mono">{incident.route}</span>
                        <span>{incident.occurrences} occurrence{incident.occurrences === 1 ? "" : "s"}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatTime(incident.lastSeenAt)}</span>
                        {incident.lastStatusCode !== null && <span>HTTP {incident.lastStatusCode}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 self-start"
                      onClick={() => void updateIncident(incident, "resolve")}
                      disabled={busyIncidentId === incident.id}
                      data-testid={`button-resolve-incident-${incident.id}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Resolve
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {resolvedIncidents.length > 0 && (
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="px-4 pb-3 pt-4">
            <CardTitle className="text-sm">Recently resolved</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="divide-y divide-border/60">
              {resolvedIncidents.slice(0, 10).map((incident) => (
                <div key={incident.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium capitalize">{incident.event.replaceAll("_", " ")}</p>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">{incident.route} · resolved {formatTime(incident.resolvedAt || incident.lastSeenAt)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void updateIncident(incident, "reopen")}
                    disabled={busyIncidentId === incident.id}
                    data-testid={`button-reopen-incident-${incident.id}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reopen
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}