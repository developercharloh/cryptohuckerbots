import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useGetDepositSession, useSubmitDepositTxid, useGetDashboardSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QRCode from "react-qr-code";
import {
  ChevronLeft, Copy, Check, Loader2, AlertTriangle,
  Clock, Info, CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SiTether } from "react-icons/si";
import { trackEvent } from "@/lib/analytics";

// ── helpers ──────────────────────────────────────────────────────────────────

function CoinQROverlay() {
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[#26A17B]">
      <SiTether className="w-5 h-5 text-white" />
    </div>
  );
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { toast({ title: "Copy failed — please copy manually", variant: "destructive" }); }
  };
  if (label) {
    return (
      <Button variant="outline" className="w-full h-12 rounded-xl border-border text-sm font-semibold shadow-none" onClick={copy}>
        {copied ? <Check className="w-4 h-4 mr-2 text-emerald-400" /> : <Copy className="w-4 h-4 mr-2" />}
        {copied ? "Copied!" : label}
      </Button>
    );
  }
  return (
    <button onClick={copy} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-card hover:bg-muted transition-colors" aria-label="Copy">
      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

// Circular progress SVG
function CircularProgress({ value, max, label }: { value: number; max: number; label: string }) {
  const r   = 54;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(1, value / max);
  const dash = circ * (1 - pct);
  return (
    <div className="relative flex items-center justify-center w-40 h-40">
      <svg className="absolute inset-0 -rotate-90" width="160" height="160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle cx="80" cy="80" r={r} fill="none" stroke="hsl(var(--primary))"
          strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dash}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="text-center">
        <p className="text-3xl font-bold tabular-nums">{value}/{max}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// Clock circle (waiting state)
function ClockCircle() {
  return (
    <div className="w-32 h-32 rounded-full bg-card border border-border flex items-center justify-center shadow-lg">
      <Clock className="w-14 h-14 text-muted-foreground animate-pulse" />
    </div>
  );
}

// Timeline step
function TStep({
  label, sub, done, active,
}: { label: string; sub?: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-start gap-3">
      {/* icon + line */}
      <div className="flex flex-col items-center">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-500" : active ? "bg-primary" : "bg-muted"}`}>
          {done
            ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            : <div className={`w-2 h-2 rounded-full ${active ? "bg-white" : "bg-muted-foreground/40"}`} />}
        </div>
        <div className="w-px flex-1 bg-border/50 my-1 min-h-[20px]" />
      </div>
      {/* text */}
      <div className="pb-4">
        <p className={`text-sm font-medium leading-tight ${done ? "text-emerald-400" : active ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// Bottom footer chips
function Footer({ amount, network, assetSymbol }: { amount: number; network: string; assetSymbol: string }) {
  return (
    <div className="flex gap-3 mt-2">
      <div className="flex-1 rounded-xl bg-card p-3 text-center">
        <p className="text-[10px] text-muted-foreground mb-0.5">Amount</p>
        <p className="text-sm font-bold">{amount} {assetSymbol}</p>
      </div>
      <div className="flex-1 rounded-xl bg-card p-3 text-center">
        <p className="text-[10px] text-muted-foreground mb-0.5">Network</p>
        <p className="text-sm font-bold">{network === "BEP-20" ? "BNB Smart Chain (BEP-20)" : network}</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DepositStatus() {
  const { id }       = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast }    = useToast();

  const [hasSent, setHasSent]   = useState(false);
  const [txidInput, setTxidInput] = useState("");

  const { data: session, isLoading } = useGetDepositSession(Number(id), {
    query: {
      refetchInterval: (query: any) => {
        const s = query?.state?.data?.status;
        if (!s || s === "completed" || s === "failed" || s === "expired" || s === "cancelled") return false;
        return 5000;
      },
      enabled: !!id,
    } as any,
  });

  // Fetch balance only when completed
  const { data: dashboard } = useGetDashboardSummary({
    query: { enabled: session?.status === "completed" } as any,
  });

  const submitTxid = useSubmitDepositTxid();

  const handleSubmitTxid = () => {
    if (!txidInput.trim()) { toast({ title: "Enter your transaction ID", variant: "destructive" }); return; }
    const analyticsNetwork = session?.network === "BEP-20" ? "bsc_bep20" : "unknown";
    trackEvent("deposit_tx_hash_submission", { network: analyticsNetwork, result: "attempted" });
    submitTxid.mutate(
      { id: Number(id), data: { txid: txidInput.trim() } },
      {
        onSuccess: (updatedSession) => {
          trackEvent("deposit_tx_hash_submission", { network: analyticsNetwork, result: "success" });
          setTxidInput(updatedSession.txid ?? txidInput.trim());
          setHasSent(true);
          toast({ title: "Transaction hash submitted" });
        },
        onError: (err: any) => {
          trackEvent("deposit_tx_hash_submission", { network: analyticsNetwork, result: "failure" });
          toast({ title: "Failed to submit TXID", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  useEffect(() => {
    if (session?.id) {
      trackEvent("deposit_payment_screen_opened", {
        network: session.network === "BEP-20" ? "bsc_bep20" : "unknown",
      });
    }
  }, [session?.id]);

  useEffect(() => {
    if (session?.txid && !txidInput) {
      setTxidInput(session.txid);
      setHasSent(true);
    }
  }, [session?.txid, txidInput]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="p-5 text-center pt-20 space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
          <p className="font-semibold">Deposit session not found</p>
          <Button className="rounded-xl" onClick={() => setLocation("/cashier/deposit")}>New Deposit</Button>
        </div>
      </Layout>
    );
  }

  const { status, amount, network, depositAddress, txid, confirmations, requiredConfirmations } = session;
  const assetSymbol = "USDT";
  const sendAmount = amount;
  const displayedTxid = txid ?? txidInput.trim();

  // ── SCREEN 6: Success ──────────────────────────────────────────────────────
  if (status === "completed") {
    const newBalance = dashboard?.mainWalletBalance ?? dashboard?.availableBalance ?? null;
    return (
      <Layout>
        <div className="p-5 pb-10 flex flex-col items-center text-center gap-5 pt-8">
          {/* Confetti / success glow */}
          <div className="relative">
            {/* sparkles */}
            {["top-0 left-4", "top-2 right-2", "bottom-4 left-0", "bottom-2 right-4", "-top-2 left-12", "top-1 right-14"].map((pos, i) => (
              <div key={i} className={`absolute ${pos} w-2 h-2 rounded-full bg-primary/70 animate-ping`} style={{ animationDelay: `${i * 0.2}s`, animationDuration: "1.4s" }} />
            ))}
            <div className="w-28 h-28 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-14 h-14 text-white" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold">Deposit Successful</h1>
            <p className="text-sm text-muted-foreground mt-1">Your deposit has been successfully credited.</p>
          </div>

          <div className="w-full rounded-2xl bg-card divide-y divide-border/40">
            {[
              { label: "You sent",   value: `${sendAmount} ${assetSymbol}` },
              { label: "Network",     value: network === "BEP-20" ? "BNB Smart Chain (BEP-20)" : network },
              ...(newBalance != null ? [{ label: "New Main Wallet Balance", value: `$${Number(newBalance).toFixed(2)}` }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-5 py-4">
                <span className="text-sm text-muted-foreground">{label}</span>
                 <span className={`text-sm font-bold ${label === "New Main Wallet Balance" ? "text-emerald-400" : ""}`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="w-full space-y-3 pt-2">
            <Button className="w-full h-13 rounded-xl text-base font-semibold shadow-none" style={{ height: "52px" }}
              onClick={() => setLocation("/dashboard")}>
              Go to Dashboard
            </Button>
            <button className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              onClick={() => setLocation("/bots")}>
              Start Trading
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Failed / expired / cancelled ────────────────────────────────────────────
  if (status === "failed" || status === "expired" || status === "cancelled") {
    return (
      <Layout>
        <div className="p-5 pb-10 flex flex-col items-center text-center gap-6 pt-12">
          <div className="w-24 h-24 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold capitalize">Deposit {status}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {status === "expired" ? "This deposit session has expired." : "Your deposit could not be processed."}
            </p>
          </div>
          <Button className="w-full h-13 rounded-xl" style={{ height: "52px" }}
            onClick={() => setLocation("/cashier/deposit")}>
            Try Again
          </Button>
        </div>
      </Layout>
    );
  }

  const isConfirming = status === "payment_detected" || status === "confirming";
  const isWaiting    = status === "waiting_payment" || status === "created";

  // ── SCREEN 5: Confirmations ────────────────────────────────────────────────
  if (isConfirming) {
    return (
      <Layout>
        <div className="p-5 pb-8 space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/cashier")} className="w-9 h-9 flex items-center justify-center rounded-xl bg-card">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold tracking-tight">Deposit Status</h1>
          </div>

          {/* Circular progress */}
          <div className="flex flex-col items-center gap-3 py-2">
            <CircularProgress value={confirmations} max={requiredConfirmations} label="Confirmations" />
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
              ● Payment detected
            </span>
            <p className="text-xs text-muted-foreground">Waiting for network confirmations</p>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl bg-card p-5">
            <TStep label="Request Created"   done={true}  active={false} />
            <TStep label="Payment Detected"  done={true}  active={false} />
            <TStep label="Confirmations"     done={false} active={true}
              sub={`${confirmations} of ${requiredConfirmations}`} />
            <TStep label="Funds Credited"    done={false} active={false} sub="Waiting..." />
          </div>

          {/* Transaction hash if available */}
          {displayedTxid && (
            <div className="rounded-xl bg-card p-4 space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Transaction Hash / TX Address</p>
              <div className="flex items-center gap-2">
                <code className="text-[10px] font-mono break-all flex-1 leading-snug">{displayedTxid}</code>
                <CopyBtn text={displayedTxid} />
              </div>
            </div>
          )}

          <Footer amount={sendAmount} network={network} assetSymbol={assetSymbol} />
        </div>
      </Layout>
    );
  }

  // ── SCREEN 4: Waiting for payment (after "I've Made a Deposit") ─────────────
  if (isWaiting && hasSent) {
    return (
      <Layout>
        <div className="p-5 pb-8 space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setHasSent(false)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-card">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold tracking-tight">Deposit Status</h1>
          </div>

          {/* Clock circle */}
          <div className="flex flex-col items-center gap-3 py-2">
            <ClockCircle />
            <div className="text-center">
              <p className="text-lg font-bold">Waiting for payment</p>
              <p className="text-xs text-muted-foreground mt-1">We have not received your payment yet.</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl bg-card p-5">
            <TStep label="Request Created"  done={true}  active={false} sub="Just now" />
            <TStep label="Payment Detected" done={false} active={true}  sub="Waiting..." />
            <TStep label="Confirmations"    done={false} active={false} sub="Waiting..." />
            <TStep label="Funds Credited"   done={false} active={false} sub="Waiting..." />
          </div>

          {/* Submitted transaction hash */}
          {displayedTxid && (
            <div className="rounded-2xl bg-card p-5 space-y-3">
              <p className="text-sm font-semibold">Transaction Hash / TX Address</p>
              <div className="flex items-center gap-2">
                <code className="text-[10px] font-mono break-all flex-1 leading-snug">{displayedTxid}</code>
                <CopyBtn text={displayedTxid} />
              </div>
              <p className="text-xs text-muted-foreground">This hash has been sent to the admin deposit review screen.</p>
            </div>
          )}

          <Footer amount={sendAmount} network={network} assetSymbol={assetSymbol} />
        </div>
      </Layout>
    );
  }

  // ── SCREEN 3: Send payment (address + QR) ─────────────────────────────────
  return (
    <Layout>
      <div className="p-5 pb-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => setLocation("/cashier")} className="w-9 h-9 flex items-center justify-center rounded-xl bg-card">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Send {assetSymbol}</h1>
          <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-card">
            <Info className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Instruction */}
        <p className="text-sm text-center text-muted-foreground">
              Send only {assetSymbol} on BNB Smart Chain (BEP-20) to this address
        </p>

        {/* QR Code with coin logo overlay */}
        <div className="flex justify-center">
          <div className="relative p-4 bg-white rounded-2xl inline-block">
            <QRCode value={depositAddress} size={200} />
            {/* Coin overlay in center */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white p-1 rounded-full">
                <CoinQROverlay />
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Deposit Address (BEP-20)</p>
          <div className="flex items-center gap-2 rounded-xl bg-card p-4">
            <code className="flex-1 break-all text-xs font-mono leading-relaxed text-foreground">
              {depositAddress}
            </code>
            <CopyBtn text={depositAddress} />
          </div>
          {/* Amount highlight */}
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{sendAmount} {assetSymbol}</p>
            <p className="text-sm text-muted-foreground">(~${amount.toFixed(2)})</p>
          </div>
        </div>

        {/* Copy Address button */}
        <CopyBtn text={depositAddress} label="Copy Address" />

        {/* Transaction hash / TX address */}
        <div className="rounded-2xl bg-card p-5 space-y-3">
          <p className="text-sm font-semibold">Transaction Hash / TX Address</p>
          <Input
            value={txidInput}
            onChange={(e) => setTxidInput(e.target.value)}
            placeholder="Paste your BSC transaction hash"
            className="bg-background border-none h-12 rounded-xl font-mono text-xs"
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Enter the transaction hash before confirming that you have made the deposit. It will be visible to the admin with this deposit address.
          </p>
        </div>

        {/* I've Made a Deposit */}
        <Button className="w-full h-13 rounded-xl text-base font-semibold shadow-none" style={{ height: "52px" }}
          onClick={handleSubmitTxid} disabled={submitTxid.isPending || !txidInput.trim()}>
          {submitTxid.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "I've Made a Deposit"}
        </Button>

        {/* Warning */}
        <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-amber-200/90">
            <span className="font-bold">Use BNB Smart Chain (BEP-20) only.</span> Sending from any other network will result in permanent, irreversible loss of funds.
          </p>
        </div>
      </div>
    </Layout>
  );
}
