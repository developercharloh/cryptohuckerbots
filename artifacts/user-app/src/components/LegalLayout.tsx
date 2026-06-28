import { ReactNode } from "react";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";

interface LegalLayoutProps {
  title: string;
  updated?: string;
  children: ReactNode;
}

export function LegalLayout({ title, updated, children }: LegalLayoutProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="max-w-[430px] mx-auto min-h-[100dvh] bg-background text-foreground relative overflow-x-hidden shadow-2xl">
      <div className="p-5 pb-12 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-card"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        </div>

        {updated && (
          <p className="text-xs text-muted-foreground">Last updated: {updated}</p>
        )}

        <div className="space-y-6 text-sm leading-relaxed text-foreground/90 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-2 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
          {children}
        </div>
      </div>
    </div>
  );
}
