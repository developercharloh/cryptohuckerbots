import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ReactNode, useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      setLocation("/login");
    }
  }, [isLoading, token, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (!token) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
