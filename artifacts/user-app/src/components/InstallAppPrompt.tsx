import { useEffect, useRef, useState } from "react";
import { Check, Download, MoreVertical, PlusSquare, Share2, Smartphone, X, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const PROMPT_SEEN_KEY = "vixus-install-prompt-seen";

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function getInstallPromptSeen(userId: number | string) {
  try {
    return sessionStorage.getItem(PROMPT_SEEN_KEY) === String(userId);
  } catch {
    return false;
  }
}

function rememberInstallPrompt(userId: number | string) {
  try {
    sessionStorage.setItem(PROMPT_SEEN_KEY, String(userId));
  } catch {
    // Storage may be unavailable in a private browsing context.
  }
}

export function InstallAppPrompt() {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(() => isStandaloneApp());
  const [showSteps, setShowSteps] = useState(false);
  const promptedUser = useRef<number | string | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!user || installed || promptedUser.current === user.id || getInstallPromptSeen(user.id)) return;
    promptedUser.current = user.id;
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [installed, user]);

  if (!user || installed || !open) return null;

  const baseUrl = import.meta.env.BASE_URL;
  const hasNativePrompt = Boolean(deferredPrompt);

  const closePrompt = () => {
    rememberInstallPrompt(user.id);
    setOpen(false);
  };

  const installApp = async () => {
    if (!deferredPrompt) {
      if (showSteps) {
        closePrompt();
      } else {
        setShowSteps(true);
      }
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      rememberInstallPrompt(user.id);
      setOpen(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-app-title"
        className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-amber-300/25 bg-[#0B1220] text-white shadow-[0_24px_90px_rgba(0,0,0,0.65)]"
      >
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-amber-400/15 blur-3xl" />
        <button
          type="button"
          onClick={closePrompt}
          aria-label="Close install prompt"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-6 sm:p-7">
          <div className="flex items-center gap-4">
            <img
              src={`${baseUrl}icons/vixus-ai-192.png`}
              alt="VIXUS"
              className="h-16 w-16 rounded-2xl border border-amber-300/30 object-cover shadow-[0_0_28px_rgba(37,99,235,0.3)]"
            />
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-300">
                <Smartphone className="h-3.5 w-3.5" /> Your trading companion
              </p>
              <h2 id="install-app-title" className="text-2xl font-black tracking-tight">Install VIXUS</h2>
              <p className="mt-1 text-sm text-slate-400">Faster access. Full-screen focus. Same secure account.</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5">
            {[
              ["AI Signals", "Review opportunities quickly"],
              ["Portfolio Wallet", "Track Main Wallet + Vault"],
              ["Market News", "Stay ahead of movement"],
              ["Secure access", "Open your account instantly"],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300/20 to-blue-500/20 text-amber-200">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs font-bold text-slate-100">{title}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">{description}</p>
              </div>
            ))}
          </div>

          {showSteps && !hasNativePrompt && (
            <div className="mt-4 rounded-2xl border border-blue-300/20 bg-blue-400/[0.08] p-4 text-xs leading-5 text-slate-300">
              <p className="font-bold text-blue-100">Install from your browser menu</p>
              <p className="mt-1">
                { /iPad|iPhone|iPod/.test(navigator.userAgent)
                  ? <>Tap <Share2 className="mx-1 inline h-3.5 w-3.5 text-blue-200" /> Share, then choose <strong className="text-white">Add to Home Screen</strong>.</>
                  : <>Tap <MoreVertical className="mx-1 inline h-3.5 w-3.5 text-blue-200" /> Menu, then choose <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home screen</strong>.</>}
              </p>
            </div>
          )}

          {!showSteps && (
            <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
              <Zap className="h-3.5 w-3.5 text-amber-300" /> The VIXUS logo will appear on your home screen.
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={closePrompt}
              className="flex-1 rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-bold text-slate-300 transition hover:bg-white/5"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={installApp}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F5B942] to-[#2563EB] px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:brightness-110"
            >
              {showSteps ? <PlusSquare className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {showSteps ? "Got it" : hasNativePrompt ? "Install app" : "How to install"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}