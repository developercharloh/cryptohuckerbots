import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  referralCode: z.string().optional(),
  terms: z.boolean().refine(val => val, "You must accept the terms")
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", referralCode: "", terms: false },
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    const { terms, confirmPassword, ...data } = values;
    registerMutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Account created", description: "Please sign in with your new credentials." });
        setLocation(`/login?email=${encodeURIComponent(data.email)}`);
      },
      onError: (err: any) => {
        toast({ 
          title: "Registration failed", 
          description: err.message || "An error occurred",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background p-6 pt-12">
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold mb-2">Create Account</h1>
          <p className="text-muted-foreground text-sm">Enter your details to get started</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-muted-foreground font-normal">Full Name</FormLabel>
                  <FormControl>
                    <Input className="bg-card border-border h-12 rounded-xl text-base px-4" placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-muted-foreground font-normal">Email</FormLabel>
                  <FormControl>
                    <Input className="bg-card border-border h-12 rounded-xl text-base px-4" placeholder="name@example.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-muted-foreground font-normal">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="••••••••" 
                        type={showPassword ? "text" : "password"} 
                        className="bg-card border-border h-12 rounded-xl text-base px-4 pr-12"
                        {...field} 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                <FormItem className="space-y-2">
                  <FormLabel className="text-muted-foreground font-normal">Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="••••••••" 
                        type={showConfirmPassword ? "text" : "password"} 
                        className="bg-card border-border h-12 rounded-xl text-base px-4 pr-12"
                        {...field} 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="referralCode"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-muted-foreground font-normal">Referral Code (Optional)</FormLabel>
                  <FormControl>
                    <Input className="bg-card border-border h-12 rounded-xl text-base px-4" placeholder="VAI-12345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2 pb-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="rounded border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer">
                      I agree to the Terms & Conditions
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full h-14 rounded-xl text-lg font-medium shadow-none" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Register"}
            </Button>
          </form>
        </Form>

        <div className="mt-8 mb-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
