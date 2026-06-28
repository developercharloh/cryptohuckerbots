import { useRef, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { ChevronLeft, Send, Loader2 } from "lucide-react";
import { useGetChatMessages, useSendChatMessage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function LiveChat() {
  const [, setLocation] = useLocation();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useGetChatMessages({
    query: { refetchInterval: 5000 } as any,
  });

  const mutation = useSendChatMessage();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    mutation.mutate(
      { data: { message: trimmed } },
      {
        onSuccess: () => {
          setText("");
          queryClient.invalidateQueries({ queryKey: ["getChatMessages"] });
        },
      }
    );
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
          <div>
            <h1 className="text-base font-bold tracking-tight">Contact Support</h1>
            <p className="text-[11px] text-muted-foreground">We typically reply within minutes</p>
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

        {/* Input */}
        <div className="shrink-0 p-4 border-t border-border/40">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message…"
              rows={1}
              className="flex-1 resize-none bg-card rounded-2xl px-4 py-3 text-sm outline-none border border-border/40 focus:border-primary/50 transition-colors max-h-28 overflow-y-auto"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || mutation.isPending}
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
