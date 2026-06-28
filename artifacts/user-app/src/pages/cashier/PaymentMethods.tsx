import { useLocation } from "wouter";
import { useListPaymentMethods } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { ChevronLeft, Plus, CreditCard, Landmark, Apple, Smartphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SiTether, SiBitcoin } from "react-icons/si";

export default function PaymentMethods() {
  const [, setLocation] = useLocation();
  const { data: methods, isLoading } = useListPaymentMethods();

  const getMethodIcon = (name: string) => {
    if (name.includes('USDT') || name.includes('Tether')) return <SiTether className="w-6 h-6 text-[#26A17B]" />;
    if (name.includes('BTC') || name.includes('Bitcoin')) return <SiBitcoin className="w-6 h-6 text-[#F7931A]" />;
    if (name.includes('ACH') || name.includes('Bank')) return <Landmark className="w-6 h-6 text-sky-400" />;
    if (name.includes('Apple')) return <Apple className="w-6 h-6 text-foreground" />;
    if (name.includes('Google')) return <Smartphone className="w-6 h-6 text-emerald-400" />;
    return <CreditCard className="w-6 h-6 text-primary" />;
  };

  return (
    <Layout>
      <div className="p-5 pb-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/cashier")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold tracking-tight">Payment Methods</h1>
          </div>
          <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-white">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
          ) : (methods || []).length > 0 ? (
            methods?.map((method) => (
              <div key={method.id} className="flex items-center justify-between p-4 bg-card rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center border border-border">
                    {getMethodIcon(method.name)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-0.5">{method.name}</h3>
                    {method.network && (
                      <p className="text-xs text-muted-foreground">Network: {method.network}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl">
              No payment methods available.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
