import { useLocation, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { ChevronLeft, ChevronRight, MessageSquare, TicketIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useListFAQ } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Support() {
  const [, setLocation] = useLocation();
  const { data: faqs, isLoading } = useListFAQ();

  return (
    <Layout>
      <div className="p-5 pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/profile")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Support</h1>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1">How can we help you?</h2>
        </div>

        <div className="space-y-3">
          <Link href="/support/chat">
            <div className="flex items-center justify-between p-4 bg-card rounded-2xl cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-500/10">
                  <MessageSquare className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Contact Support</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Chat with us live</p>
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
                  <p className="text-xs text-muted-foreground mt-0.5">We'll respond to you soon</p>
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
