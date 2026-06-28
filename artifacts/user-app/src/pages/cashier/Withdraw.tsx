import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useListPaymentMethods, useCreateWithdrawal, useGetDashboardSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ChevronLeft, Loader2, CreditCard, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { SiTether, SiBitcoin } from "react-icons/si";

const withdrawSchema = z.object({
  amount: z.coerce.number().min(50, "Minimum withdrawal is $50"),
  paymentMethod: z.string().min(1, "Select a payment method"),
  walletAddress: z.string().min(10, "Valid wallet address is required")
});

const QUICK_AMOUNTS = [100, 250, 500, 1000];

export default function Withdraw() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: paymentMethods, isLoading: loadingMethods } = useListPaymentMethods();
  const withdrawMutation = useCreateWithdrawal();

  const form = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: 50, paymentMethod: "", walletAddress: "" },
  });

  const onSubmit = (values: z.infer<typeof withdrawSchema>) => {
    if (summary && values.amount > summary.availableBalance) {
      form.setError("amount", { message: "Insufficient balance" });
      return;
    }

    withdrawMutation.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Withdrawal initiated", description: "Your transaction is pending." });
        setLocation("/cashier/transactions");
      },
      onError: (err: any) => {
        toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const selectedMethod = form.watch("paymentMethod");
  const activeMethod = paymentMethods?.find((m) => m.id === selectedMethod);

  const getMethodIcon = (name: string) => {
    if (name.includes('USDT') || name.includes('Tether')) return <SiTether className="w-6 h-6 text-[#26A17B]" />;
    if (name.includes('BTC') || name.includes('Bitcoin')) return <SiBitcoin className="w-6 h-6 text-[#F7931A]" />;
    return <CreditCard className="w-6 h-6 text-primary" />;
  };

  return (
    <Layout>
      <div className="p-5 pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/cashier")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Withdraw</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Select Payment Method</p>
              <div className="space-y-3">
                {loadingMethods ? (
                  Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
                ) : (
                  paymentMethods?.map((method) => (
                    <div 
                      key={method.id}
                      className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                        selectedMethod === method.id 
                          ? 'bg-card border-primary border' 
                          : 'bg-card border border-transparent'
                      }`}
                      onClick={() => form.setValue("paymentMethod", method.id)}
                    >
                      <div className="flex items-center gap-3">
                        {getMethodIcon(method.name)}
                        <span className="font-medium text-sm">
                          {method.name} {method.network ? `(${method.network})` : ''}
                        </span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedMethod === method.id ? 'border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {selectedMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {form.formState.errors.paymentMethod && (
                <p className="text-sm font-medium text-destructive">{form.formState.errors.paymentMethod.message}</p>
              )}
            </div>

            <FormField
              control={form.control}
              name="walletAddress"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-muted-foreground font-normal">
                    {activeMethod?.network ? `Withdrawal Address (${activeMethod.network} network)` : "Withdrawal Address"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={activeMethod?.network ? `Paste your ${activeMethod.network} address` : "Paste your wallet address"}
                      className="bg-card border-none h-14 rounded-xl px-4"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="space-y-4">
                  <div className="flex justify-between items-center">
                    <FormLabel className="text-muted-foreground font-normal">Enter Amount</FormLabel>
                    <span className="text-xs text-muted-foreground">
                      Available Balance: {loadingSummary ? <Skeleton className="w-10 h-3 inline-block" /> : `$${summary?.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
                    </span>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xl font-bold">$</div>
                      <Input type="number" className="pl-10 pr-4 bg-card border-none h-16 rounded-xl text-xl font-bold" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map(amount => (
                  <Button
                    key={amount}
                    type="button"
                    className={`h-12 rounded-xl text-sm font-medium shadow-none ${
                      form.watch("amount") === amount 
                        ? "bg-primary text-white" 
                        : "bg-card text-foreground hover:bg-card/80 border border-border"
                    }`}
                    onClick={() => form.setValue("amount", amount)}
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <p className="text-xs leading-relaxed text-amber-200/90">
                Double-check your withdrawal address and confirm it matches the selected network
                {activeMethod?.network ? ` (${activeMethod.network})` : ""}. Crypto transactions are
                irreversible — funds sent to a wrong address or over the wrong network are permanently
                lost and cannot be recovered or refunded.
              </p>
            </div>

            <Button type="submit" className="w-full h-14 rounded-xl text-lg font-medium shadow-none mt-8" disabled={withdrawMutation.isPending}>
              {withdrawMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continue"}
            </Button>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
