import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Keep legacy bot links pointed at the current signal workspace.
 */
export default function Bots() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/trade");
  }, [setLocation]);

  return <div className="min-h-screen bg-background" aria-label="Opening signal workspace" />;
}