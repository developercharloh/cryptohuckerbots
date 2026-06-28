import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useAdminGetUser, 
  useAdminSetUserStatus,
  useAdminResetUserPassword,
  useAdminAdjustBalance,
  getAdminGetUserQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Ban, CheckCircle, KeyRound, Plus, Minus, CreditCard, Copy, Check, ShieldCheck, ShieldOff } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
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
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const statusMutation = useAdminSetUserStatus();
  const passwordMutation = useAdminResetUserPassword();
  const balanceMutation = useAdminAdjustBalance();

  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [isBalanceOpen, setIsBalanceOpen] = useState(false);
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

  const handleToggleAdmin = async () => {
    if (!user) return;
    const isAdmin = (user as any).isAdmin as boolean;
    const action = isAdmin ? "Revoke admin access from" : "Promote";
    if (!confirm(`${action} ${user.fullName}?`)) return;
    setPromoteLoading(true);
    try {
      const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const res = await fetch(`${base}/api/admin/users/${userId}/promote`, { method: "POST" });
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
        },
        onError: (err) => {
          toast({ title: "Failed to adjust balance", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto bg-background p-8">
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
    <div className="flex-1 overflow-auto bg-background p-8">
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
                {user.phone && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Phone</div>
                    <div>{user.phone}</div>
                  </div>
                )}
                {user.country && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Country</div>
                    <div>{user.country}</div>
                  </div>
                )}
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
                <CardTitle>Wallet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Current Balance</div>
                  <div className="text-3xl font-bold">${user.balance.toFixed(2)}</div>
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
                              <Badge variant={bot.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
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
                                <div>{txn.type.replace('_', ' ')}</div>
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
                              </TableCell>
                              <TableCell>
                                <Badge variant={txn.status === 'completed' ? 'default' : txn.status === 'pending' ? 'secondary' : 'destructive'} className="text-[10px]">
                                  {txn.status}
                                </Badge>
                              </TableCell>
                              <TableCell className={`text-right font-medium ${txn.type === 'deposit' || txn.type === 'trade_profit' || txn.type === 'referral_bonus' ? 'text-emerald-500' : ''}`}>
                                {txn.type === 'deposit' || txn.type === 'trade_profit' || txn.type === 'referral_bonus' ? '+' : ''}
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
