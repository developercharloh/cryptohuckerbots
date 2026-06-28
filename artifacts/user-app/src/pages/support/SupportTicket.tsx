import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateSupportTicket } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ticketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  category: z.string().min(1, "Please select a category"),
  message: z.string().min(20, "Message must be at least 20 characters")
});

export default function SupportTicket() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mutation = useCreateSupportTicket();

  const form = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { subject: "", category: "", message: "" },
  });

  const onSubmit = (values: z.infer<typeof ticketSchema>) => {
    mutation.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Ticket Submitted", description: "Our support team will get back to you shortly." });
        setLocation("/support");
      },
      onError: (err: any) => {
        toast({ title: "Submission failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Layout>
      <div className="p-5 pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/support")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Submit a Ticket</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-muted-foreground font-normal">Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-14 bg-card border-none rounded-xl px-4">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="account">Account & Security</SelectItem>
                      <SelectItem value="billing">Deposits & Withdrawals</SelectItem>
                      <SelectItem value="technical">Technical Issue</SelectItem>
                      <SelectItem value="bots">Trading Bots</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-muted-foreground font-normal">Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g. Deposit not showing" className="bg-card border-none h-14 rounded-xl px-4 text-base" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-muted-foreground font-normal">Message</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Please describe your issue in detail..." 
                      className="bg-card border-none min-h-[160px] rounded-xl p-4 text-base resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full h-14 rounded-xl text-lg font-medium shadow-none mt-8" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit"}
            </Button>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
