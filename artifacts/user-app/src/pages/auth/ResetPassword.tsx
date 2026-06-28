import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useResetPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const schema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mutation = useResetPassword();

  const [showPwd, setShowPwd] = useState(false);
  const [showConfPwd, setShowConfPwd] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { token: "", password: "", confirmPassword: "" },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    mutation.mutate({ data: { token: values.token, password: values.password } }, {
      onSuccess: () => {
        toast({ title: "Password reset successful", description: "You can now login with your new password." });
        setLocation("/login");
      },
      onError: (err: any) => {
        toast({ 
          title: "Reset failed", 
          description: err.message || "An error occurred",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background p-5">
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Reset Password</h1>
          <p className="text-muted-foreground text-[15px]">Enter your reset token and new password below.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Reset Token" className="bg-card border-none h-14 rounded-xl px-4" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="New Password" 
                        type={showPwd ? "text" : "password"} 
                        className="bg-card border-none h-14 rounded-xl px-4 pr-12" 
                        {...field} 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Confirm New Password" 
                        type={showConfPwd ? "text" : "password"} 
                        className="bg-card border-none h-14 rounded-xl px-4 pr-12" 
                        {...field} 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowConfPwd(!showConfPwd)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showConfPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full h-14 rounded-xl text-[17px] font-medium shadow-none mt-6" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Reset Password"}
            </Button>
          </form>
        </Form>
        
        <div className="mt-8 text-center text-sm">
          <span className="text-muted-foreground">Remembered your password? </span>
          <Link href="/login" className="text-primary font-medium">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
