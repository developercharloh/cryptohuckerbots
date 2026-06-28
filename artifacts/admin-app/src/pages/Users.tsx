import { useState } from "react";
import { Link } from "wouter";
import {
  useAdminListUsers,
  useAdminListKyc,
  useAdminReviewKyc,
  useAdminRefundByUid,
  getAdminListKycQueryKey,
  getAdminListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, ChevronRight, CheckCircle, XCircle, Landmark } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function Users() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: users, isLoading: usersLoading } = useAdminListUsers({ search: debouncedSearch || undefined });
  const { data: kycItems, isLoading: kycLoading } = useAdminListKyc({ status: "pending" });

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundUid, setRefundUid] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundNote, setRefundNote] = useState("");

  const reviewKyc = useAdminReviewKyc();
  const refundMutation = useAdminRefundByUid();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
  };

  const handleRefund = () => {
    const amt = parseFloat(refundAmount);
    if (!refundUid.trim() || isNaN(amt) || amt <= 0) return;
    refundMutation.mutate(
      { data: { accountUid: refundUid.trim().toUpperCase(), amount: amt, note: refundNote || "Admin refund" } },
      {
        onSuccess: (u) => {
          toast({ title: `Refunded $${amt.toFixed(2)} to ${u.fullName}` });
          setRefundOpen(false);
          setRefundUid(""); setRefundAmount(""); setRefundNote("");
          queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Refund failed", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleKycReview = (userId: number, action: "approve" | "reject") => {
    reviewKyc.mutate(
      { userId, data: { action, reason: action === "reject" ? "Documents unclear" : undefined } },
      {
        onSuccess: () => {
          toast({ title: `KYC ${action}d` });
          queryClient.invalidateQueries({ queryKey: getAdminListKycQueryKey({ status: "pending" }) });
        },
        onError: (err) => {
          toast({ title: `Failed to ${action} KYC`, description: err.message, variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="p-4 space-y-4 pb-2">
      <div className="pt-1 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Users</h1>
          <p className="text-xs text-muted-foreground">Accounts & KYC management</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 rounded-xl" onClick={() => setRefundOpen(true)}>
          <Landmark className="w-3.5 h-3.5" /> Refund by UID
        </Button>
      </div>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Refund by Account UID</DialogTitle>
            <DialogDescription>
              Enter the user's Account UID and the amount to credit their balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Account UID</label>
              <Input
                placeholder="e.g. QFXA1B2C3D4"
                value={refundUid}
                onChange={e => setRefundUid(e.target.value.toUpperCase())}
                className="font-mono uppercase rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Amount (USD)</label>
              <Input
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
              <Input
                placeholder="Refund reason..."
                value={refundNote}
                onChange={e => setRefundNote(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setRefundOpen(false)}>Cancel</Button>
            <Button
              className="rounded-xl"
              onClick={handleRefund}
              disabled={refundMutation.isPending || !refundUid.trim() || !refundAmount}
            >
              {refundMutation.isPending ? "Processing..." : "Send Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full h-9">
          <TabsTrigger value="all" className="flex-1 text-xs">All Users</TabsTrigger>
          <TabsTrigger value="kyc" className="flex-1 text-xs">
            KYC Review
            {kycItems?.length ? <Badge variant="destructive" className="ml-1.5 text-[10px] h-4 px-1">{kycItems.length}</Badge> : null}
          </TabsTrigger>
        </TabsList>

        {/* All Users */}
        <TabsContent value="all" className="space-y-3 mt-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 text-sm rounded-xl"
              data-testid="input-search-users"
            />
            <Button type="submit" variant="secondary" size="sm" className="h-9 px-3 rounded-xl shrink-0" data-testid="btn-search-users">
              <Search className="w-4 h-4" />
            </Button>
          </form>

          <div className="space-y-2">
            {usersLoading ? (
              Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
            ) : users?.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
                No users found
              </div>
            ) : (
              users?.map(user => (
                <Link key={user.id} href={`/users/${user.id}`}>
                  <Card className="rounded-2xl border-border/60 hover:border-primary/40 transition-colors cursor-pointer" data-testid={`row-user-${user.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {user.fullName?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold truncate">{user.fullName}</span>
                            <Badge variant={user.status === "active" ? "default" : "destructive"} className="text-[10px] h-4 px-1.5 shrink-0">
                              {user.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] font-mono font-bold text-primary/80 bg-primary/8 px-1.5 py-0.5 rounded">{user.accountUid}</span>
                            <span className="text-[11px] text-emerald-400 font-medium">${user.balance.toFixed(2)}</span>
                            <span className="text-[11px] text-muted-foreground">{user.totalBots} bots</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        {/* Pending KYC */}
        <TabsContent value="kyc" className="space-y-2 mt-3">
          {kycLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)
          ) : kycItems?.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
              No pending KYC submissions
            </div>
          ) : (
            kycItems?.map(item => (
              <Card key={item.userId} className="rounded-2xl border-border/60" data-testid={`row-kyc-${item.userId}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-amber-400">
                        {item.fullName?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.fullName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.email}</p>
                      <div className="flex gap-1.5 mt-1.5">
                        {item.documentFrontUrl && <Badge variant="outline" className="text-[10px] h-4 px-1.5">ID Front</Badge>}
                        {item.selfieUrl && <Badge variant="outline" className="text-[10px] h-4 px-1.5">Selfie</Badge>}
                      </div>
                      {item.submittedAt && (
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{format(new Date(item.submittedAt), "PP")}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl"
                      onClick={() => handleKycReview(item.userId, "approve")}
                      disabled={reviewKyc.isPending}
                      data-testid={`btn-approve-kyc-${item.userId}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl"
                      onClick={() => handleKycReview(item.userId, "reject")}
                      disabled={reviewKyc.isPending}
                      data-testid={`btn-reject-kyc-${item.userId}`}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
