import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { ArrowDownCircle, ArrowUpCircle, History, ChevronRight } from "lucide-react";

export default function Cashier() {
  const menuItems = [
    {
      title: "Deposit",
      description: "Add funds to your account",
      icon: ArrowDownCircle,
      href: "/cashier/deposit",
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    {
      title: "Withdraw",
      description: "Transfer funds to your wallet",
      icon: ArrowUpCircle,
      href: "/cashier/withdraw",
      color: "text-red-500",
      bg: "bg-red-500/10"
    },
    {
      title: "Transactions",
      description: "View your payment history",
      icon: History,
      href: "/cashier/transactions",
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    }
  ];

  return (
    <Layout showNav>
      <div className="p-5 pb-8 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
        
        <div className="space-y-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href}>
                <div className="flex items-center justify-between p-4 bg-card rounded-2xl cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.bg}`}>
                      <Icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[15px]">{item.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
