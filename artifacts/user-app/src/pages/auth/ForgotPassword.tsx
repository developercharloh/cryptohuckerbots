import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForgotPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mutation = useForgotPassword();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    mutation.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Reset link sent", description: "Check your email for further instructions." });
        form.reset();
      },
      onError: (err: any) => {
        toast({ 
          title: "Failed to send link", 
          description: err.message || "An error occurred",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background p-5">
      <div className="pt-2 pb-6">
        <button onClick={() => setLocation("/login")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col mt-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Forgot Password</h1>
          <p className="text-muted-foreground text-[15px]">We'll send you a reset link to regain access to your account.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Email Address" type="email" className="bg-card border-none h-14 rounded-xl px-4" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full h-14 rounded-xl text-[17px] font-medium shadow-none mt-2" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Reset Link"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
