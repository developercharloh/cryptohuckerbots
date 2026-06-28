import { useState } from "react";
import { useLocation } from "wouter";
import { useListBots, useListMarketplaceBots, usePurchaseBot, Bot, MarketplaceBot } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronRight, Zap, Menu, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Bots() {
  const [, setLocation] = useLocation();
  const { data: myBots, isLoading: loadingMyBots } = useListBots();
  const { data: marketplaceBots, isLoading: loadingMarketplace } = useListMarketplaceBots();
  const purchaseMutation = usePurchaseBot();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("my-bots");

  const handlePurchase = (id: number) => {
    purchaseMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Bot purchased successfully" });
        queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
        queryClient.invalidateQueries({ queryKey: ["/api/marketplace-bots"] });
      },
      onError: (err: any) => {
        toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Layout showNav>
      <div className="p-5 pb-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <button className="w-10 h-10 bg-card rounded-xl flex items-center justify-center">
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <span className="font-semibold tracking-tight text-sm">VIXUS AI</span>
          </div>

          <button className="w-10 h-10 bg-card rounded-xl flex items-center justify-center relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-card" />
          </button>
        </div>

        <h1 className="text-2xl font-bold tracking-tight">My Bots</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-12 p-1 bg-card rounded-xl border border-border">
            <TabsTrigger 
              value="my-bots" 
              className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white font-medium"
            >
              Active Bots
            </TabsTrigger>
            <TabsTrigger 
              value="marketplace" 
              className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white font-medium text-muted-foreground"
            >
              Marketplace
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-bots" className="space-y-4">
            {loadingMyBots ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
            ) : (myBots || []).length > 0 ? (
              myBots?.map((bot: Bot, i) => (
                <Card key={bot.id} className="bg-card border-none rounded-2xl shadow-none">
                  <CardContent className="p-4 flex flex-col gap-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setLocation(`/bots/${bot.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                          ${i % 3 === 0 ? 'bg-gradient-to-br from-orange-400 to-red-500' : 
                            i % 3 === 1 ? 'bg-gradient-to-br from-blue-400 to-indigo-500' : 
                            'bg-gradient-to-br from-green-400 to-emerald-500'}`}>
                          {bot.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm mb-1">{bot.name}</h3>
                          <div className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center ${
                            bot.status === 'running' ? 'text-green-500 bg-green-500/10' : 'text-muted-foreground bg-muted'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${bot.status === 'running' ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                            {bot.status === 'running' ? 'Running' : 'Paused'}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] text-muted-foreground mb-1">Profit Today</div>
                        <div className="text-sm font-bold text-green-500">+${bot.profitToday}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground mb-1">Win Rate</div>
                        <div className="text-sm font-bold">{bot.winRate}%</div>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
                You don't have any active bots.
              </div>
            )}
            
            {!loadingMyBots && (
              <Button 
                className="w-full h-14 rounded-xl text-lg font-medium mt-4 shadow-none"
                onClick={() => setActiveTab("marketplace")}
              >
                Add New Bot
              </Button>
            )}
          </TabsContent>

          <TabsContent value="marketplace" className="space-y-4">
            {loadingMarketplace ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
            ) : (marketplaceBots || []).length > 0 ? (
              marketplaceBots?.map((bot: MarketplaceBot, i) => (
                <Card key={bot.id} className="bg-card border-none rounded-2xl shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                          ${i % 3 === 0 ? 'bg-gradient-to-br from-purple-400 to-pink-500' : 
                            i % 3 === 1 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 
                            'bg-gradient-to-br from-cyan-400 to-blue-500'}`}>
                          {bot.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{bot.name}</h3>
                          <Badge variant="outline" className={`text-[10px] border-none px-2 py-0 h-5 mt-1 ${
                            bot.riskLevel === 'Low' ? 'bg-green-500/10 text-green-500' : 
                            bot.riskLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-500' : 
                            'bg-red-500/10 text-red-500'
                          }`}>
                            {bot.riskLevel} Risk
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <div className="text-[10px] text-muted-foreground mb-1">Win Rate</div>
                        <div className="font-bold text-sm">{bot.winRate}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground mb-1">Price</div>
                        <div className="font-bold text-sm">
                          {bot.price > 0 ? `$${bot.price}` : <span className="text-green-500">Free</span>}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                      {bot.description}
                    </p>

                    <Button 
                      className={`w-full h-12 rounded-xl font-medium shadow-none ${bot.isPurchased ? 'bg-background text-muted-foreground hover:bg-background' : ''}`}
                      onClick={() => handlePurchase(bot.id)}
                      disabled={bot.isPurchased || purchaseMutation.isPending}
                    >
                      {bot.isPurchased
                        ? "Owned"
                        : purchaseMutation.isPending
                          ? "Purchasing..."
                          : bot.price > 0
                            ? "Buy"
                            : "Get Free"}
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl">
                No bots available in marketplace.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
