import { useState, useEffect } from "react";
import { 
  useAdminListBots, 
  useAdminToggleBot,
  useAdminCreateBot,
  useAdminUpdateBot,
  useAdminDeleteBot,
  useAdminAssignBot,
  useAdminListUsers,
  getAdminListBotsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Play, Square, Settings, Users, Plus, Trash2, Link as LinkIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

export default function Bots() {
  const { data: bots, isLoading, error } = useAdminListBots();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const toggleMutation = useAdminToggleBot();
  const createMutation = useAdminCreateBot();
  const updateMutation = useAdminUpdateBot();
  const deleteMutation = useAdminDeleteBot();
  const assignMutation = useAdminAssignBot();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<any>(null);
  const [assigningBotId, setAssigningBotId] = useState<number | null>(null);
  const [searchUser, setSearchUser] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: users } = useAdminListUsers({ search: debouncedSearch || undefined }, { query: { enabled: isAssignOpen } as any });

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      category: "Forex",
      riskLevel: "medium",
      price: 0,
      monthlyReturn: 0,
      winRate: 0,
      minInvestment: 0,
      iconUrl: "",
      isActive: true
    }
  });

  useEffect(() => {
    if (editingBot) {
      form.reset({
        name: editingBot.name,
        description: editingBot.description,
        category: editingBot.category,
        riskLevel: editingBot.riskLevel,
        price: editingBot.price,
        monthlyReturn: editingBot.monthlyReturn || 0,
        winRate: editingBot.winRate,
        minInvestment: editingBot.minInvestment || 0,
        iconUrl: editingBot.iconUrl || "",
        isActive: editingBot.isActive
      });
    } else {
      form.reset({
        name: "",
        description: "",
        category: "Forex",
        riskLevel: "medium",
        price: 0,
        monthlyReturn: 0,
        winRate: 0,
        minInvestment: 0,
        iconUrl: "",
        isActive: true
      });
    }
  }, [editingBot, form]);

  const handleToggle = (id: number, currentStatus: boolean) => {
    toggleMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: `Bot ${currentStatus ? 'deactivated' : 'activated'}` });
          queryClient.invalidateQueries({ queryKey: getAdminListBotsQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to toggle bot", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this bot?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Bot deleted successfully" });
          queryClient.invalidateQueries({ queryKey: getAdminListBotsQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to delete bot", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const onSubmit = (data: any) => {
    const payload = {
      ...data,
      price: Number(data.price),
      monthlyReturn: Number(data.monthlyReturn),
      winRate: Number(data.winRate),
      minInvestment: Number(data.minInvestment)
    };

    if (editingBot) {
      updateMutation.mutate(
        { id: editingBot.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Bot updated successfully" });
            setIsFormOpen(false);
            queryClient.invalidateQueries({ queryKey: getAdminListBotsQueryKey() });
          },
          onError: (err) => {
            toast({ title: "Failed to update bot", description: err.message, variant: "destructive" });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Bot created successfully" });
            setIsFormOpen(false);
            queryClient.invalidateQueries({ queryKey: getAdminListBotsQueryKey() });
          },
          onError: (err) => {
            toast({ title: "Failed to create bot", description: err.message, variant: "destructive" });
          }
        }
      );
    }
  };

  const handleAssign = (userId: number) => {
    if (!assigningBotId) return;
    assignMutation.mutate(
      { id: assigningBotId, data: { userId } },
      {
        onSuccess: () => {
          toast({ title: "Bot assigned successfully" });
          setIsAssignOpen(false);
        },
        onError: (err) => {
          toast({ title: "Failed to assign bot", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bots</h1>
            <p className="text-muted-foreground mt-2">Manage the trading-bot catalog.</p>
          </div>
          
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingBot(null);
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingBot(null)} data-testid="btn-create-bot">
                <Plus className="w-4 h-4 mr-2" />
                Create Bot
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBot ? "Edit Bot" : "Create New Bot"}</DialogTitle>
                <DialogDescription>Configure bot parameters and availability.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Bot Name</FormLabel>
                        <FormControl><Input {...field} data-testid="input-bot-name" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl><Textarea {...field} rows={3} data-testid="input-bot-desc" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-bot-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Forex">Forex</SelectItem>
                            <SelectItem value="Crypto">Crypto</SelectItem>
                            <SelectItem value="Stocks">Stocks</SelectItem>
                            <SelectItem value="Commodities">Commodities</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="riskLevel" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Risk Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-bot-risk"><SelectValue placeholder="Select risk" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="price" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price ($)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} data-testid="input-bot-price" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="minInvestment" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Investment ($)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} data-testid="input-bot-min-invest" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="winRate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Win Rate (%)</FormLabel>
                        <FormControl><Input type="number" step="0.1" {...field} data-testid="input-bot-winrate" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="monthlyReturn" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Est. Monthly Return (%)</FormLabel>
                        <FormControl><Input type="number" step="0.1" {...field} data-testid="input-bot-return" /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="btn-save-bot">
                      {editingBot ? "Update Bot" : "Create Bot"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Bot to User</DialogTitle>
                <DialogDescription>Search for a user to grant them access to this bot directly.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Search by name or email..." 
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setDebouncedSearch(searchUser)}
                  />
                  <Button variant="secondary" onClick={() => setDebouncedSearch(searchUser)}>Search</Button>
                </div>
                <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
                  {users?.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No users found</div>
                  ) : (
                    users?.map(user => (
                      <div key={user.id} className="p-3 flex items-center justify-between hover:bg-secondary/50">
                        <div>
                          <div className="font-medium text-sm">{user.fullName}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleAssign(user.id)}
                          disabled={assignMutation.isPending}
                        >
                          Assign
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        ) : error || !bots ? (
          <div className="p-8 text-destructive">Failed to load bots</div>
        ) : bots.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
            No bots found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <Card key={bot.id} className={!bot.isActive ? "opacity-75 grayscale-[0.3]" : ""}>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="mb-2 bg-secondary text-secondary-foreground">{bot.category}</Badge>
                      <CardTitle className="text-xl">{bot.name}</CardTitle>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={bot.isActive ? "default" : "secondary"}>
                        {bot.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingBot(bot);
                            setIsFormOpen(true);
                          }}
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(bot.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2 mt-2">{bot.description}</CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Price</div>
                      <div className="font-medium">${bot.price}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Win Rate</div>
                      <div className="font-medium text-emerald-500">{bot.winRate}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Active Users</div>
                      <div className="font-medium flex items-center gap-1">
                        <Users className="w-3 h-3" /> {bot.activeUsers}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Risk Level</div>
                      <div className="font-medium capitalize">{bot.riskLevel}</div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border pt-4 flex gap-2">
                  <Button 
                    variant={bot.isActive ? "secondary" : "default"} 
                    className="flex-1"
                    onClick={() => handleToggle(bot.id, bot.isActive)}
                    disabled={toggleMutation.isPending}
                    data-testid={`btn-toggle-bot-${bot.id}`}
                  >
                    {bot.isActive ? <><Square className="w-4 h-4 mr-2" /> Stop</> : <><Play className="w-4 h-4 mr-2" /> Start</>}
                  </Button>
                  <Button 
                    variant="outline" 
                    title="Assign to User"
                    onClick={() => {
                      setAssigningBotId(bot.id);
                      setIsAssignOpen(true);
                    }}
                  >
                    <LinkIcon className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
