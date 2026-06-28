import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const SLIDES = [
  {
    title: "Automated Trading Made Simple",
    description: "VIXUS AI works 24/7 to grow your capital with advanced AI strategies.",
  },
  {
    title: "Maximize Your Profits",
    description: "Our advanced algorithms execute profitable trades automatically to optimize returns.",
  },
  {
    title: "Secure & Transparent",
    description: "Your funds are protected with bank-grade security and full visibility at all times.",
  }
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide === SLIDES.length - 1) {
      finishOnboarding();
    } else {
      setCurrentSlide((c) => c + 1);
    }
  };

  const finishOnboarding = () => {
    localStorage.setItem("vixus_onboarding_seen", "true");
    setLocation("/login");
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background p-6">
      <div className="flex justify-end pt-2">
        <Button variant="ghost" className="text-muted-foreground font-medium px-2" onClick={finishOnboarding}>
          Skip
        </Button>
      </div>

      <div className="px-1 pt-2">
        <h2 className="text-[30px] leading-[1.15] font-bold tracking-tight mb-3 max-w-[280px]">
          {SLIDES[currentSlide].title}
        </h2>
        <p className="text-muted-foreground leading-relaxed text-[15px] max-w-[260px]">
          {SLIDES[currentSlide].description}
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center">
          <div className="absolute inset-0 -m-4 rounded-full bg-primary/15 blur-3xl"></div>
          <svg className="relative z-10 w-4/5 h-4/5 drop-shadow-[0_0_40px_rgba(124,58,237,0.55)]" viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="60" y="60" width="80" height="80" rx="16" fill="url(#headGrad)" />
            <rect x="88" y="40" width="24" height="22" rx="8" fill="#7c3aed" />
            <circle cx="100" cy="29" r="8" fill="#a78bfa" />
            <circle cx="80" cy="95" r="10" fill="#1e1b4b" />
            <circle cx="120" cy="95" r="10" fill="#1e1b4b" />
            <circle cx="80" cy="95" r="5" fill="#7c3aed" />
            <circle cx="120" cy="95" r="5" fill="#7c3aed" />
            <circle cx="82" cy="93" r="2" fill="#c4b5fd" />
            <circle cx="122" cy="93" r="2" fill="#c4b5fd" />
            <rect x="82" y="115" width="36" height="8" rx="4" fill="#4c1d95" />
            <rect x="86" y="117" width="10" height="4" rx="2" fill="#7c3aed" />
            <rect x="40" y="70" width="20" height="40" rx="10" fill="url(#armGrad)" />
            <rect x="140" y="70" width="20" height="40" rx="10" fill="url(#armGrad)" />
            <rect x="55" y="148" width="90" height="50" rx="16" fill="url(#bodyGrad)" />
            <rect x="65" y="158" width="30" height="30" rx="8" fill="#1e1b4b" />
            <rect x="105" y="158" width="30" height="30" rx="8" fill="#1e1b4b" />
            <path d="M70 178 L80 168 L90 178" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M110 168 L120 178 L130 168" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="70" y="196" width="20" height="24" rx="8" fill="url(#legGrad)" />
            <rect x="110" y="196" width="20" height="24" rx="8" fill="url(#legGrad)" />
            <defs>
              <linearGradient id="headGrad" x1="60" y1="60" x2="140" y2="140" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6d28d9" />
                <stop offset="1" stopColor="#4c1d95" />
              </linearGradient>
              <linearGradient id="bodyGrad" x1="55" y1="148" x2="145" y2="198" gradientUnits="userSpaceOnUse">
                <stop stopColor="#5b21b6" />
                <stop offset="1" stopColor="#3b0764" />
              </linearGradient>
              <linearGradient id="armGrad" x1="40" y1="70" x2="60" y2="110" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7c3aed" />
                <stop offset="1" stopColor="#4c1d95" />
              </linearGradient>
              <linearGradient id="legGrad" x1="70" y1="196" x2="90" y2="220" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6d28d9" />
                <stop offset="1" stopColor="#3b0764" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <div className="mt-auto pb-2">
        <div className="flex justify-center gap-2 mb-8">
          {SLIDES.map((_, i) => (
            <div 
              key={i} 
              className={`h-2 rounded-full transition-all duration-300 ${i === currentSlide ? "w-6 bg-primary" : "w-2 bg-muted"}`} 
            />
          ))}
        </div>
        
        <Button className="w-full h-14 rounded-xl text-[17px] font-medium shadow-none" onClick={handleNext}>
          {currentSlide === SLIDES.length - 1 ? "Get Started" : "Next"}
        </Button>
      </div>
    </div>
  );
}
