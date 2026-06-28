import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { VixusLogo } from "@/components/VixusLogo";

export default function Splash() {
  const [, setLocation] = useLocation();
  const { token, isLoading } = useAuth();
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (token) {
      const timer = setTimeout(() => {
        setLocation("/dashboard");
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setShowButton(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [setLocation, token, isLoading]);

  const handleGetStarted = () => {
    const seen = localStorage.getItem("vixus_onboarding_seen");
    if (seen) {
      setLocation("/login");
    } else {
      setLocation("/onboarding");
    }
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-[100dvh] bg-background p-6">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <div className="flex flex-col items-center gap-6">
          <div className="relative mb-4 flex items-center justify-center">
            <div className="absolute inset-0 -m-8 rounded-full bg-primary/20 blur-2xl"></div>
            <VixusLogo className="w-28 h-28 relative z-10 drop-shadow-[0_0_30px_rgba(124,58,237,0.5)]" />
          </div>
          
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-white">
              VIXUS<span className="text-primary"> AI</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Smart Trading Bots. Maximum Results.
            </p>
          </div>
        </div>
      </div>
      
      <div className={`w-full transition-opacity duration-500 pb-8 ${showButton ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <Button 
          className="w-full h-14 rounded-xl text-lg font-medium shadow-none" 
          onClick={handleGetStarted}
        >
          Get Started
        </Button>
      </div>
    </div>
  );
}
