import { useState } from "react";
import {
  useAdminBroadcast,
  useAdminListBroadcasts,
  useAdminDeleteBroadcast,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Megaphone, Trash2, Users, Clock, Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function Broadcast() {
  const [title, setTitle]     = useState("");
  const [message, setMessage] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const queryClient    = useQueryClient();
  const { toast }      = useToast();

  const broadcastMutation = useAdminBroadcast();
  const deleteMutation    = useAdminDeleteBroadcast();
  const { data: broadcasts = [], isLoading } = useAdminListBroadcasts();

  const BROADCASTS_KEY = ["/api/admin/broadcasts"];

  const handleSend = () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" });
      return;
    }
    broadcastMutation.mutate(
      { data: { title: title.trim(), message: message.trim() } },
      {
        onSuccess: (res: any) => {
          toast({ title: "Broadcast sent", description: res?.message ?? "All users notified" });
          setTitle("");
          setMessage("");
          queryClient.invalidateQueries({ queryKey: BROADCASTS_KEY });
        },
        onError: (err: any) => {
          toast({ title: "Failed to send", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = () => {
    if (deleteId === null) return;
    deleteMutation.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast({ title: "Broadcast deleted" });
          setDeleteId(null);
          queryClient.invalidateQueries({ queryKey: BROADCASTS_KEY });
        },
        onError: (err: any) => {
          toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
          setDeleteId(null);
        },
      },
    );
  };

  return (
    <div className="p-4 pb-6">
      <div className="pt-1 mb-4">
        <h1 className="text-xl font-bold tracking-tight">Broadcast</h1>
        <p className="text-xs text-muted-foreground">Send announcements to all users</p>
      </div>

      {/* Compose */}
      <Card className="rounded-2xl border-border/60 mb-5">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            New Announcement
          </CardTitle>
          <CardDescription className="text-xs">Sent to every registered user instantly</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. System maintenance notice"
              className="h-9 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Message</label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your announcement here..."
              rows={4}
              className="rounded-xl text-sm resize-none"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={broadcastMutation.isPending || !title.trim() || !message.trim()}
            className="w-full h-10 rounded-xl text-sm font-semibold"
          >
            {broadcastMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Sending...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4" /> Send Broadcast
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">Sent Broadcasts</h2>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">{broadcasts.length} total</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : broadcasts.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">No broadcasts sent yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b: any) => (
            <Card key={b.id} className="rounded-2xl border-border/60">
              <CardContent className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{b.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{b.message}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="w-3 h-3" />
                        {b.recipientCount} recipients
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteId(b.id)}
                    className="shrink-0 w-8 h-8 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center hover:bg-destructive/20 transition-colors"
                    title="Delete broadcast"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the announcement from all users' notification feeds. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
