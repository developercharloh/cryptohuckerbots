import { useRef, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { VixusLogo } from "@/components/VixusLogo";
import { ChevronLeft, Send, Loader2, LockKeyhole, Paperclip, Camera, X, RotateCcw, FileText } from "lucide-react";
import { useGetChatMessages, useSendChatMessage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { upload } from "@vercel/blob/client";
import { API_BASE, fetchWithTimeout } from "@/lib/api-base";

type PendingAttachment = {
  id: string;
  file: File;
  pathname?: string;
  uploadProof?: string;
  progress: number;
  error?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PrivateImage({ href, alt }: { href: string; alt: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let objectUrl: string | undefined;
    void fetchWithTimeout(href, { credentials: "include" })
      .then((response) => response.ok ? response.blob() : Promise.reject(new Error("Unable to load image.")))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => setSrc(undefined));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [href]);
  return src ? <img src={src} alt={alt} className="max-h-48 max-w-full object-cover" /> : <div className="h-20 w-28 animate-pulse rounded-lg bg-background/20" />;
}

export default function LiveChat() {
  const [, setLocation] = useLocation();
  const [text, setText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useGetChatMessages({
    query: { refetchInterval: 5000 } as any,
  });

  const mutation = useSendChatMessage();
  const latestMessage = messages[messages.length - 1];
  const isClosed = latestMessage?.sender === "system";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const uploadFile = async (pending: PendingAttachment) => {
    try {
      const sessionResponse = await fetchWithTimeout(`${API_BASE}/api/support/attachments/session`, {
        method: "POST",
        credentials: "include",
      });
      if (!sessionResponse.ok) throw new Error("Could not start the upload.");
      const session = await sessionResponse.json() as { prefix: string; proof: string };
      const safeName = pending.file.name.replace(/[^\w.\- ()[\]]/g, "_").slice(0, 180) || "attachment";
      const result = await upload(`${session.prefix}/${safeName}`, pending.file, {
        access: "private",
        handleUploadUrl: `${API_BASE}/api/support/attachments/upload`,
        clientPayload: session.proof,
        contentType: pending.file.type || "application/octet-stream",
        multipart: pending.file.size > 4 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => {
          const next = pendingAttachmentsRef.current.map((item) =>
            item.id === pending.id ? { ...item, progress: percentage } : item,
          );
          pendingAttachmentsRef.current = next;
          setPendingAttachments(next);
        },
      });
      const next = pendingAttachmentsRef.current.map((item) =>
        item.id === pending.id ? { ...item, pathname: result.pathname, uploadProof: session.proof, progress: 100 } : item,
      );
      pendingAttachmentsRef.current = next;
      setPendingAttachments(next);
    } catch (error) {
      const next = pendingAttachmentsRef.current.map((item) =>
        item.id === pending.id ? { ...item, error: error instanceof Error ? error.message : "Upload failed." } : item,
      );
      pendingAttachmentsRef.current = next;
      setPendingAttachments(next);
    }
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const additions = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      progress: 0,
    }));
    const acceptedAdditions = additions.slice(0, Math.max(0, 10 - pendingAttachmentsRef.current.length));
    const next = [...pendingAttachmentsRef.current, ...acceptedAdditions];
    pendingAttachmentsRef.current = next;
    setPendingAttachments(next);
    acceptedAdditions.forEach((item) => void uploadFile(item));
  };

  const retryUpload = (item: PendingAttachment) => {
    const next = { ...item, pathname: undefined, uploadProof: undefined, progress: 0, error: undefined };
    const updated = pendingAttachmentsRef.current.map((candidate) => candidate.id === item.id ? next : candidate);
    pendingAttachmentsRef.current = updated;
    setPendingAttachments(updated);
    void uploadFile(next);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    const readyAttachments = pendingAttachments.filter((item) => item.pathname && item.uploadProof && !item.error);
    const hasUploading = pendingAttachments.some((item) => !item.error && !item.pathname);
    if ((!trimmed && readyAttachments.length === 0) || hasUploading || mutation.isPending) return;
    mutation.mutate(
      {
        data: {
          message: trimmed || "Sent an attachment.",
          attachments: readyAttachments.map((item) => ({
            pathname: item.pathname!,
            filename: item.file.name,
            contentType: item.file.type || "application/octet-stream",
            sizeBytes: item.file.size,
            uploadProof: item.uploadProof!,
          })),
        },
      },
      {
        onSuccess: () => {
          setText("");
          setPendingAttachments([]);
          queryClient.invalidateQueries({ queryKey: ["getChatMessages"] });
        },
      }
    );
  };

  const removeAttachment = (id: string) => {
    const next = pendingAttachmentsRef.current.filter((item) => item.id !== id);
    pendingAttachmentsRef.current = next;
    setPendingAttachments(next);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-[100dvh]">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-border/40 shrink-0">
          <button
            onClick={() => setLocation("/support")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-card"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <VixusLogo className="h-10 w-10 rounded-xl border border-amber-300/30 object-cover shadow-lg shadow-blue-950/40" />
          <div>
            <h1 className="text-base font-bold tracking-tight">VIXUS Support</h1>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] text-muted-foreground">
                {isClosed ? "Conversation closed" : "Private conversation with VIXUS Support"}
              </p>
              {isClosed && <LockKeyhole className="w-3 h-3 text-muted-foreground" />}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center pt-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Send className="w-6 h-6 text-blue-500" />
              </div>
              <p className="text-sm font-semibold">Start a conversation</p>
              <p className="text-xs text-muted-foreground max-w-[220px]">
                Send a message below and our support team will reply shortly.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.sender === "system") {
                return (
                  <div key={msg.id} className="flex justify-center py-2">
                    <div className="max-w-[90%] rounded-full border border-border/60 bg-card px-3 py-1.5 text-center text-[10px] text-muted-foreground">
                      {msg.message}
                    </div>
                  </div>
                );
              }
              const isUser = msg.sender === "user";
              return (
                <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                    isUser
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card text-foreground rounded-bl-md"
                  }`}>
                    {!isUser && (
                      <p className="text-[10px] font-semibold text-primary mb-1">Support</p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                    {msg.attachments?.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {msg.attachments.map((attachment) => {
                          const isImage = attachment.contentType.startsWith("image/");
                          const href = `${API_BASE}${attachment.downloadUrl}`;
                          return isImage ? (
                            <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
                              <PrivateImage href={href} alt={attachment.filename} />
                            </a>
                          ) : (
                            <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-background/20 px-2.5 py-2 text-xs underline">
                              <FileText className="h-4 w-4 shrink-0" /> <span className="truncate">{attachment.filename}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                    <p className={`text-[10px] mt-1 ${isUser ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {format(new Date(msg.createdAt), "HH:mm")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {isClosed && (
          <div className="mx-4 mb-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
            This conversation is closed. Send a message below to start a new private conversation with Support.
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 p-4 border-t border-border/40">
          {pendingAttachments.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {pendingAttachments.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 py-2 text-xs">
                  {item.file.type.startsWith("image/") ? <img src={URL.createObjectURL(item.file)} alt="" className="h-8 w-8 rounded object-cover" /> : <FileText className="h-4 w-4 text-primary" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{item.file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.error || `${item.progress}% · ${formatBytes(item.file.size)}`}</p>
                    {!item.error && !item.pathname && <div className="mt-1 h-1 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${item.progress}%` }} /></div>}
                  </div>
                  {item.error && <button onClick={() => retryUpload(item)} aria-label="Retry upload"><RotateCcw className="h-4 w-4 text-primary" /></button>}
                  <button onClick={() => removeAttachment(item.id)} aria-label="Remove attachment"><X className="h-4 w-4 text-muted-foreground" /></button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { handleFiles(event.target.files); event.currentTarget.value = ""; }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { handleFiles(event.target.files); event.currentTarget.value = ""; }} />
          <div className="flex items-end gap-2">
            <div className="flex gap-1 pb-1">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={pendingAttachments.length >= 10} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card disabled:opacity-40" aria-label="Attach files">
                <Paperclip className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={pendingAttachments.length >= 10} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card disabled:opacity-40" aria-label="Take a photo">
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder={isClosed ? "Start a new conversation…" : "Type a message…"}
              rows={1}
              className="flex-1 resize-none bg-card rounded-2xl px-4 py-3 text-sm outline-none border border-border/40 focus:border-primary/50 transition-colors max-h-28 overflow-y-auto"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={handleSend}
              disabled={(!text.trim() && pendingAttachments.length === 0) || mutation.isPending || pendingAttachments.some((item) => !item.error && !item.pathname)}
              className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
              ) : (
                <Send className="w-4 h-4 text-primary-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
