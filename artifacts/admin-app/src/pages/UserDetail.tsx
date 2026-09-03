import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useAdminGetUser, 
  useAdminSetUserStatus,
  useAdminResetUserPassword,
  useAdminResetUserHistory,
  useAdminAdjustBalance,
  useAdminSendChatMessage,
  useAdminListChats,
  getAdminGetChatQueryKey,
  getAdminListChatsQueryKey,
  getAdminGetUserQueryKey,
  getAdminListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Ban, CheckCircle, KeyRound, Plus, Minus, CreditCard, Copy, Check, ShieldCheck, ShieldOff, MessageSquare, Loader2, Send, RotateCcw, Clock3 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/lib/api-base";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function CopyAddressButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors shrink-0"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id || "0", 10);
  
  const { data: user, isLoading, error } = useAdminGetUser(userId, { 
    query: { enabled: !!userId, queryKey: getAdminGetUserQueryKey(userId) } as any 
  });
  const { data: chatConversations = [] } = useAdminListChats({
    query: { enabled: !!userId, refetchInterval: 5000 } as any,
  });
  const pendingConversation = chatConversations.find((conversation) => conversation.userId === userId);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const statusMutation = useAdminSetUserStatus();
  const passwordMutation = useAdminResetUserPassword();
  const historyMutation = useAdminResetUserHistory();
  const balanceMutation = useAdminAdjustBalance();
  const messageMutation = useAdminSendChatMessage();

  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [isBalanceOpen, setIsBalanceOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [promoteLoading, setPromoteLoading] = useState(false);

  const handleToggleStatus = () => {
    if (!user) return;
    const newStatus = user.status === "active" ? "suspended" : "active";
    statusMutation.mutate(
      { id: userId, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast({ title: `User ${newStatus}` });
          queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
        },
        onError: (err) => {
          toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleResetPassword = () => {
    if (!confirm("Are you sure you want to reset this user's password?")) return;
    passwordMutation.mutate(
      { id: userId },
      {
        onSuccess: (data) => {
          setTempPassword(data.tempPassword);
          toast({ title: "Password reset successful" });
        },
        onError: (err) => {
          toast({ title: "Failed to reset password", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleResetHistory = () => {
    if (!confirm(
      `Reset ${user?.fullName ?? "this user"} as a fresh account? This clears balances, transactions, bots, VIP records, referrals, notifications, and KYC data while preserving the account, profile, support, and security records.`,
    )) return;

    historyMutation.mutate(
      { id: userId },
      {
        onSuccess: (data) => {
          toast({ title: "User history reset", description: data.message });
          queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
          queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to reset user history", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  const handleToggleAdmin = async () => {
    if (!user) return;
    const isAdmin = (user as any).isAdmin as boolean;
    const action = isAdmin ? "Revoke admin access from" : "Promote";
    if (!confirm(`${action} ${user.fullName}?`)) return;
    setPromoteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/promote`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
      toast({ title: isAdmin ? "Admin access revoked" : "User promoted to admin" });
      queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setPromoteLoading(false);
    }
  };

  const handleAdjustBalance = (type: "credit" | "debit") => {
    const amt = parseFloat(balanceAmount);
    if (isNaN(amt) || amt <= 0) return;
    
    const finalAmount = type === "credit" ? amt : -amt;
    
    balanceMutation.mutate(
      { id: userId, data: { amount: finalAmount, note: balanceNote || `${type} by admin` } },
      {
        onSuccess: () => {
          toast({ title: "Balance adjusted successfully" });
          setIsBalanceOpen(false);
          setBalanceAmount("");
          setBalanceNote("");
          queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
           queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to adjust balance", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleSendMessage = () => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || messageMutation.isPending) return;

    messageMutation.mutate(
      { userId, data: { message: trimmedMessage } },
      {
        onSuccess: () => {
          toast({ title: "Private message sent", description: "The user was notified privately." });
          setMessageText("");
          setIsMessageOpen(false);
          queryClient.invalidateQueries({ queryKey: getAdminGetChatQueryKey(userId) });
          queryClient.invalidateQueries({ queryKey: getAdminListChatsQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to send message", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="admin-page flex-1 overflow-auto bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <Skeleton className="h-8 w-24" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-64 md:col-span-1" />
            <Skeleton className="h-64 md:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return <div className="p-8 text-destructive">Failed to load user details</div>;
  }

  return (
    <div className="admin-page flex-1 overflow-auto bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/users">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{user.fullName}</h1>
            <p className="text-muted-foreground mt-1">{user.email}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={user.status === "active" ? "default" : "destructive"} className="px-3 py-1 text-sm">
              {user.status}
            </Badge>
            <Badge variant={user.kycStatus === "verified" ? "default" : "secondary"} className="px-3 py-1 text-sm">
              KYC: {user.kycStatus}
            </Badge>
            {pendingConversation?.pendingReply && (
              <Badge variant="destructive" className="px-3 py-1 text-sm">
                Reply needed
              </Badge>
            )}
          </div>
        </div>

        {tempPassword && (
          <div className="p-4 bg-primary/10 border border-primary text-primary rounded-md flex items-center justify-between">
            <div>
              <p className="font-medium">Password Reset Successful</p>
              <p className="text-sm opacity-90">Temporary password: <span className="font-mono font-bold tracking-widest ml-2 bg-background px-2 py-1 rounded select-all">{tempPassword}</span></p>
            </div>
            <Button size="sm" onClick={() => setTempPassword("")}>Dismiss</Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile & Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Account UID</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base tracking-widest text-primary">{user.accountUid}</span>
                    <CopyAddressButton text={user.accountUid} />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Joined</div>
                  <div>{format(new Date(user.createdAt), "PPp")}</div>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Clock3 className="w-4 h-4 text-primary" />
                    Signal pair allowance
                  </div>
                  {user.signalPairsRemaining === null ? (
                    <p className="text-xs text-muted-foreground mt-2">Not started — VIP 1 activation starts the 60-pair allowance.</p>
                  ) : user.signalTrialExpired ? (
                    <p className="text-xs text-amber-400 mt-2">Completed — VIP 2 is required for continued signal access.</p>
                  ) : (
                    <>
                      <p className="text-xs text-emerald-400 mt-2">{user.signalPairsRemaining} of {user.signalPairAllowance} pairs remaining</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        One pair is consumed after 2 successfully executed signals on the same day.
                      </p>
                    </>
                  )}
                </div>
                {user.phone && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Phone</div>
                    <div>{user.phone}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Country of residence</div>
                  <div>{user.country || "Not provided at signup"}</div>
                  <div className="text-[11px] text-muted-foreground/70 mt-0.5">Collected during account registration; independent of KYC.</div>
                </div>
                <div className="pt-4 border-t border-border flex flex-col gap-2">
                  <Button 
                    variant={user.status === "active" ? "destructive" : "default"}
                    onClick={handleToggleStatus}
                    disabled={statusMutation.isPending}
                    data-testid="btn-toggle-status"
                  >
                    {user.status === "active" ? <><Ban className="w-4 h-4 mr-2" /> Suspend Account</> : <><CheckCircle className="w-4 h-4 mr-2" /> Activate Account</>}
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={handleResetPassword}
                    disabled={passwordMutation.isPending}
                    data-testid="btn-reset-password"
                  >
                    <KeyRound className="w-4 h-4 mr-2" /> Reset Password
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleResetHistory}
                    disabled={historyMutation.isPending}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    data-testid="btn-reset-user-history"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {historyMutation.isPending ? "Resetting History..." : "Reset User History"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsMessageOpen(true)}
                    data-testid="btn-message-user"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" /> Message User
                  </Button>
                  {pendingConversation && (
                    <Link href={`/support?userId=${userId}`}>
                      <Button
                        variant={pendingConversation.pendingReply ? "default" : "secondary"}
                        className="w-full"
                        data-testid="btn-open-support-conversation"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        {pendingConversation.pendingReply ? "Open reply in Inbox" : "View full conversation"}
                        {pendingConversation.pendingReply && (
                          <span className="ml-auto rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">1</span>
                        )}
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant={(user as any).isAdmin ? "outline" : "default"}
                    className={(user as any).isAdmin ? "border-amber-500 text-amber-400 hover:bg-amber-500/10" : "bg-purple-600 hover:bg-purple-700 text-white"}
                    onClick={handleToggleAdmin}
                    disabled={promoteLoading}
                    data-testid="btn-promote-admin"
                  >
                    {(user as any).isAdmin
                      ? <><ShieldOff className="w-4 h-4 mr-2" /> Revoke Admin</>
                      : <><ShieldCheck className="w-4 h-4 mr-2" /> Promote to Admin</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Wallets</CardTitle>
                <CardDescription>Balances mirror the user app and are backed by the transaction ledger.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="text-xs font-medium text-muted-foreground">Main Wallet</div>
                    <div className="text-xl font-bold text-emerald-500">${user.mainWalletBalance.toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Completed ledger balance</div>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="text-xs font-medium text-muted-foreground">Vault Capital</div>
                    <div className="text-xl font-bold text-amber-500">${user.vaultCapital.toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">VIP trading capital</div>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="text-xs font-medium text-muted-foreground">Portfolio Wallet</div>
                    <div className="text-xl font-bold text-primary">${user.portfolioBalance.toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Main + Vault</div>
                  </div>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Available to withdraw</div>
                    <div className="font-semibold">${user.availableBalance.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                        <div className="text-xs font-medium text-muted-foreground">Pending requests</div>
                    <div className="font-semibold text-amber-500">${user.pendingOutflow.toFixed(2)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Deposits</div>
                    <div className="font-medium text-emerald-500">${user.totalDeposits.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total Withdrawals</div>
                    <div className="font-medium">${user.totalWithdrawals.toFixed(2)}</div>
                  </div>
                </div>
                
                <Dialog open={isBalanceOpen} onOpenChange={setIsBalanceOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full mt-2" variant="outline" data-testid="btn-adjust-balance">
                      <CreditCard className="w-4 h-4 mr-2" /> Adjust Balance
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adjust User Balance</DialogTitle>
                      <DialogDescription>Credit or debit funds from this user's wallet.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Amount ($)</label>
                        <Input 
                          type="number" 
                          min="0.01" 
                          step="0.01" 
                          value={balanceAmount} 
                          onChange={e => setBalanceAmount(e.target.value)} 
                          placeholder="0.00"
                          data-testid="input-adjust-amount"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Note / Reason</label>
                        <Input 
                          value={balanceNote} 
                          onChange={e => setBalanceNote(e.target.value)} 
                          placeholder="e.g. Refund, Bonus"
                          data-testid="input-adjust-note"
                        />
                      </div>
                    </div>
                    <DialogFooter className="flex gap-2 sm:justify-between">
                      <Button variant="ghost" onClick={() => setIsBalanceOpen(false)}>Cancel</Button>
                      <div className="flex gap-2">
                        <Button 
                          variant="destructive" 
                          onClick={() => handleAdjustBalance("debit")}
                          disabled={!balanceAmount || balanceMutation.isPending}
                          data-testid="btn-submit-debit"
                        >
                          <Minus className="w-4 h-4 mr-1" /> Debit
                        </Button>
                        <Button 
                          className="bg-emerald-600 hover:bg-emerald-700" 
                          onClick={() => handleAdjustBalance("credit")}
                          disabled={!balanceAmount || balanceMutation.isPending}
                          data-testid="btn-submit-credit"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Credit
                        </Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isMessageOpen} onOpenChange={setIsMessageOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Message {user.fullName}</DialogTitle>
                      <DialogDescription>
                        Send a private message. Only this user and the admin support team can see it.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                      <label className="text-sm font-medium">Private message</label>
                      <Textarea
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        placeholder="Write a message to this user..."
                        rows={5}
                        maxLength={2000}
                        className="resize-none"
                        data-testid="input-private-message"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Delivered to the user's notification center</span>
                        <span>{messageText.length}/2000</span>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setIsMessageOpen(false)} disabled={messageMutation.isPending}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSendMessage}
                        disabled={!messageText.trim() || messageMutation.isPending}
                        data-testid="btn-send-private-message"
                      >
                        {messageMutation.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                        ) : (
                          <><Send className="w-4 h-4 mr-2" /> Send Private Message</>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>

          {/* Activity Tabs */}
          <div className="md:col-span-2 space-y-6">
            <Card className="h-full border-border">
              <CardHeader className="pb-0 border-b border-border px-0">
                <div className="px-6 pb-4 flex items-center justify-between">
                  <CardTitle>Activity</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-6 space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Active Bots ({user.bots.length})</h3>
                    {user.bots.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-4 bg-secondary/50 rounded-md">No bots running.</div>
                    ) : (
                      <div className="space-y-3">
                        {user.bots.map(bot => (
                          <div key={bot.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                            <div>
                              <div className="font-medium">{bot.name}</div>
                              <div className="text-xs text-muted-foreground">Since {format(new Date(bot.createdAt), "PP")}</div>
                            </div>
                            <div className="text-right">
                              <div className={`font-medium ${bot.profitTotal >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                                {bot.profitTotal >= 0 ? '+' : ''}${bot.profitTotal.toFixed(2)}
                              </div>
                               <Badge variant={bot.status === 'running' ? 'default' : 'secondary'} className="text-[10px]">
                                {bot.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
                    {user.transactions.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-4 bg-secondary/50 rounded-md">No transactions yet.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {user.transactions.map(txn => (
                            <TableRow key={txn.id}>
                              <TableCell className="text-xs whitespace-nowrap">{format(new Date(txn.createdAt), "PP p")}</TableCell>
                              <TableCell className="capitalize">
                                <div>{txn.type === 'trade_loss' ? 'Contract Opened' : txn.type === 'trade_profit' || txn.type === 'trade_loss_return' ? 'Contract Closed' : txn.type === 'vault_trade_stake' ? 'Vault Capital Reserved' : txn.type === 'vault_trade_return' ? 'Vault Capital Returned' : txn.type === 'vault_trade_fee' ? 'Vault Capital Trading Fee' : txn.type.replace('_', ' ')}</div>
                                {txn.type === 'withdrawal' && txn.walletAddress && (
                                  <div className="mt-1 p-1.5 rounded-md bg-secondary/60 space-y-1">
                                    {txn.network && (
                                      <div className="text-[10px] font-semibold text-primary uppercase tracking-wide">{txn.network} Network</div>
                                    )}
                                    <div className="flex items-start gap-1.5">
                                      <div className="text-[10px] text-muted-foreground font-mono break-all leading-tight max-w-[120px]">{txn.walletAddress}</div>
                                      <CopyAddressButton text={txn.walletAddress} />
                                    </div>
                                  </div>
                                )}
                                {txn.type === 'withdrawal' && txn.cryptoAmount != null && txn.cryptoAsset && (
                                  <div className="mt-1 rounded-md bg-primary/10 border border-primary/20 p-1.5">
                                    <div className="text-[10px] text-muted-foreground">
                                      Sending <span className="font-semibold text-foreground">{txn.cryptoAmount} {txn.cryptoAsset}</span>
                                    </div>
                                    {txn.conversionRate != null && (
                                      <div className="text-[10px] text-muted-foreground">
                                        @ ${txn.conversionRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}/{txn.cryptoAsset}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={txn.status === 'completed' ? 'default' : txn.status === 'pending' ? 'secondary' : 'destructive'} className="text-[10px]">
                                  {txn.status}
                                </Badge>
                              </TableCell>
                              <TableCell className={`text-right font-medium ${txn.type === 'deposit' || txn.type === 'trade_profit' || txn.type === 'vault_trade_return' ? 'text-emerald-500' : txn.type === 'withdrawal' || txn.type === 'trade_loss' || txn.type === 'trade_loss_return' || txn.type === 'vip_package_purchase' || txn.type === 'vault_trade_stake' || txn.type === 'vault_trade_fee' ? 'text-red-500' : ''}`}>
                                {txn.type === 'deposit' || txn.type === 'trade_profit' || txn.type === 'vault_trade_return' ? '+' : txn.type === 'withdrawal' || txn.type === 'trade_loss' || txn.type === 'trade_loss_return' || txn.type === 'vip_package_purchase' || txn.type === 'vault_trade_stake' || txn.type === 'vault_trade_fee' ? '−' : ''}
                                ${txn.amount.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
