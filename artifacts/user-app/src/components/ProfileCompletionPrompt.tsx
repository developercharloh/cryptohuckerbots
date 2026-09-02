import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, MapPin, Phone, X } from "lucide-react";
import { useGetProfile } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

export function ProfileCompletionPrompt() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetProfile({
    query: { enabled: Boolean(user) } as any,
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [user?.id]);

  if (!user || isLoading || !profile || dismissed) return null;

  const missingPhone = !profile.phone?.trim();
  const missingCountry = !profile.country?.trim();
  if (!missingPhone && !missingCountry) return null;

  const close = () => setDismissed(true);
  const completeProfile = () => {
    setDismissed(true);
    setLocation("/profile/personal-info");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-profile-title"
        className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-primary/25 bg-[#0B1220] p-6 text-white shadow-[0_24px_90px_rgba(0,0,0,0.65)]"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close profile reminder"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-300">
          One quick step
        </p>
        <h2 id="complete-profile-title" className="mt-2 text-2xl font-black tracking-tight">
          Complete your profile
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
          Add your contact details so your VIXUS account is ready for secure account updates and support.
        </p>

        <div className="mt-5 space-y-2">
          {missingPhone && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
              <Phone className="h-4 w-4 text-blue-300" />
              <span className="text-sm text-slate-200">Phone number</span>
            </div>
          )}
          {missingCountry && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
              <MapPin className="h-4 w-4 text-amber-300" />
              <span className="text-sm text-slate-200">Country of residence</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-bold text-slate-300 transition hover:bg-white/5"
          >
            Later
          </button>
          <button
            type="button"
            onClick={completeProfile}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#F5B942] px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:brightness-110"
          >
            Update details <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}