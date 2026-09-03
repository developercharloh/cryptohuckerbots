import { useLocation, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { VixusLogo } from "@/components/VixusLogo";
import { ChevronLeft, ChevronRight, MessageSquare, TicketIcon, Clock3, CheckCircle2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useListFAQ, useListSupportTickets } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Support() {
  const [, setLocation] = useLocation();
  const { data: faqs, isLoading } = useListFAQ();
  const { data: tickets = [], isLoading: ticketsLoading } = useListSupportTickets({
    query: { refetchInterval: 15000, refetchOnWindowFocus: true } as any,
  });
  const openTickets = tickets.filter((ticket) => !["closed", "resolved"].includes(ticket.status.toLowerCase()));

  return (
    <Layout>
      <div className="p-5 pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/profile")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <VixusLogo className="h-9 w-9 rounded-xl border border-amber-300/30 object-cover shadow-lg shadow-blue-950/40" />
            <h1 className="text-xl font-bold tracking-tight">VIXUS Support</h1>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1">How can we help you?</h2>
          <p className="text-xs text-muted-foreground">Choose private chat for quick questions or a ticket when you need a tracked response.</p>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              {openTickets.length > 0 ? <Clock3 className="h-5 w-5 text-primary" /> : <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
            </div>
            <div>
              <p className="text-sm font-semibold">{ticketsLoading ? "Checking your tickets..." : openTickets.length > 0 ? `${openTickets.length} open ticket${openTickets.length === 1 ? "" : "s"}` : "No open tickets"}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Support updates stay attached to your account.</p>
            </div>
          </div>
          {openTickets.length > 0 && <span className="text-[10px] font-bold uppercase tracking-wide text-primary">In progress</span>}
        </div>

        <div className="space-y-3">
          <Link href="/support/chat">
            <div className="flex items-center justify-between p-4 bg-card rounded-2xl cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-500/10">
                  <MessageSquare className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                   <h3 className="font-semibold text-sm">VIXUS Support</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Private chat with VIXUS Support</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
            </div>
          </Link>

          <Link href="/support/ticket">
            <div className="flex items-center justify-between p-4 bg-card rounded-2xl cursor-pointer mt-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-500/10">
                  <TicketIcon className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Submit a Ticket</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Private ticket visible only to you and Support</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
            </div>
          </Link>
        </div>

        <div className="pt-6">
          <Accordion type="single" collapsible className="w-full space-y-3">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)
            ) : (
              (faqs || []).slice(0, 8).map((faq, index) => (
                <AccordionItem key={faq.id} value={`item-${index}`} className="border-none bg-card rounded-2xl px-4">
                  <AccordionTrigger className="text-left text-[13px] font-semibold hover:no-underline py-4 text-foreground">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-xs leading-relaxed pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))
            )}
          </Accordion>
        </div>
      </div>
    </Layout>
  );
}
