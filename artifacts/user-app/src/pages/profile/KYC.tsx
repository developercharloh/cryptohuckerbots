import { useState } from "react";
import { useLocation } from "wouter";
import { useGetKYC, useGetProfile, useCreateKycSession } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, CheckCircle2, Clock, XCircle, ShieldCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

const COUNTRIES = [
  "🇦🇫 Afghanistan","🇦🇱 Albania","🇩🇿 Algeria","🇦🇩 Andorra","🇦🇴 Angola",
  "🇦🇬 Antigua and Barbuda","🇦🇷 Argentina","🇦🇲 Armenia","🇦🇺 Australia","🇦🇹 Austria",
  "🇦🇿 Azerbaijan","🇧🇸 Bahamas","🇧🇭 Bahrain","🇧🇩 Bangladesh","🇧🇧 Barbados",
  "🇧🇾 Belarus","🇧🇪 Belgium","🇧🇿 Belize","🇧🇯 Benin","🇧🇹 Bhutan",
  "🇧🇴 Bolivia","🇧🇦 Bosnia and Herzegovina","🇧🇼 Botswana","🇧🇷 Brazil","🇧🇳 Brunei",
  "🇧🇬 Bulgaria","🇧🇫 Burkina Faso","🇧🇮 Burundi","🇰🇭 Cambodia","🇨🇲 Cameroon",
  "🇨🇦 Canada","🇨🇻 Cape Verde","🇨🇫 Central African Republic","🇹🇩 Chad","🇨🇱 Chile",
  "🇨🇳 China","🇨🇴 Colombia","🇰🇲 Comoros","🇨🇬 Congo","🇨🇩 DR Congo",
  "🇨🇷 Costa Rica","🇭🇷 Croatia","🇨🇺 Cuba","🇨🇾 Cyprus","🇨🇿 Czech Republic",
  "🇩🇰 Denmark","🇩🇯 Djibouti","🇩🇴 Dominican Republic","🇪🇨 Ecuador","🇪🇬 Egypt",
  "🇸🇻 El Salvador","🇬🇶 Equatorial Guinea","🇪🇷 Eritrea","🇪🇪 Estonia","🇸🇿 Eswatini",
  "🇪🇹 Ethiopia","🇫🇯 Fiji","🇫🇮 Finland","🇫🇷 France","🇬🇦 Gabon",
  "🇬🇲 Gambia","🇬🇪 Georgia","🇩🇪 Germany","🇬🇭 Ghana","🇬🇷 Greece",
  "🇬🇹 Guatemala","🇬🇳 Guinea","🇬🇾 Guyana","🇭🇹 Haiti","🇭🇳 Honduras",
  "🇭🇺 Hungary","🇮🇸 Iceland","🇮🇳 India","🇮🇩 Indonesia","🇮🇷 Iran",
  "🇮🇶 Iraq","🇮🇪 Ireland","🇮🇱 Israel","🇮🇹 Italy","🇨🇮 Ivory Coast",
  "🇯🇲 Jamaica","🇯🇵 Japan","🇯🇴 Jordan","🇰🇿 Kazakhstan","🇰🇪 Kenya",
  "🇰🇼 Kuwait","🇰🇬 Kyrgyzstan","🇱🇦 Laos","🇱🇻 Latvia","🇱🇧 Lebanon",
  "🇱🇸 Lesotho","🇱🇷 Liberia","🇱🇾 Libya","🇱🇹 Lithuania","🇱🇺 Luxembourg",
  "🇲🇬 Madagascar","🇲🇼 Malawi","🇲🇾 Malaysia","🇲🇻 Maldives","🇲🇱 Mali",
  "🇲🇹 Malta","🇲🇷 Mauritania","🇲🇺 Mauritius","🇲🇽 Mexico","🇲🇩 Moldova",
  "🇲🇳 Mongolia","🇲🇪 Montenegro","🇲🇦 Morocco","🇲🇿 Mozambique","🇲🇲 Myanmar",
  "🇳🇦 Namibia","🇳🇵 Nepal","🇳🇱 Netherlands","🇳🇿 New Zealand","🇳🇮 Nicaragua",
  "🇳🇪 Niger","🇳🇬 Nigeria","🇲🇰 North Macedonia","🇳🇴 Norway","🇴🇲 Oman",
  "🇵🇰 Pakistan","🇵🇸 Palestine","🇵🇦 Panama","🇵🇬 Papua New Guinea","🇵🇾 Paraguay",
  "🇵🇪 Peru","🇵🇭 Philippines","🇵🇱 Poland","🇵🇹 Portugal","🇶🇦 Qatar",
  "🇷🇴 Romania","🇷🇺 Russia","🇷🇼 Rwanda","🇸🇦 Saudi Arabia","🇸🇳 Senegal",
  "🇷🇸 Serbia","🇸🇱 Sierra Leone","🇸🇬 Singapore","🇸🇰 Slovakia","🇸🇮 Slovenia",
  "🇸🇴 Somalia","🇿🇦 South Africa","🇰🇷 South Korea","🇸🇸 South Sudan","🇪🇸 Spain",
  "🇱🇰 Sri Lanka","🇸🇩 Sudan","🇸🇷 Suriname","🇸🇪 Sweden","🇨🇭 Switzerland",
  "🇸🇾 Syria","🇹🇼 Taiwan","🇹🇯 Tajikistan","🇹🇿 Tanzania","🇹🇭 Thailand",
  "🇹🇬 Togo","🇹🇹 Trinidad and Tobago","🇹🇳 Tunisia","🇹🇷 Turkey","🇹🇲 Turkmenistan",
  "🇺🇬 Uganda","🇺🇦 Ukraine","🇦🇪 United Arab Emirates","🇬🇧 United Kingdom",
  "🇺🇸 United States","🇺🇾 Uruguay","🇺🇿 Uzbekistan","🇻🇪 Venezuela",
  "🇻🇳 Vietnam","🇾🇪 Yemen","🇿🇲 Zambia","🇿🇼 Zimbabwe",
];

const DOC_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID Card" },
  { value: "drivers_license", label: "Driver's License" },
];

export default function KYC() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: kyc, isLoading: kycLoading } = useGetKYC();
  const { data: profile, isLoading: profileLoading } = useGetProfile();
  const sessionMutation = useCreateKycSession();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [started, setStarted] = useState(false);

  const isLoading = kycLoading || profileLoading;
  const status = kyc?.status ?? "not_submitted";
  const isVerified = status === "verified" || status === "approved";
  const isPending = status === "pending" || status === "submitted" || status === "under_review";
  const isRejected = status === "rejected";
  const canStart = !isVerified && !isPending;

  // Pre-fill from profile
  const prefillDone = started;
  if (!prefillDone && profile && !firstName && !lastName) {
    const parts = (profile.fullName ?? "").trim().split(" ");
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" ") ?? "");
    setCountry((profile as any).country ?? "");
    setStarted(true);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !country || !documentType) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    sessionMutation.mutate(
      { data: { firstName: firstName.trim(), lastName: lastName.trim(), country, documentType } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: ["/api/profile/kyc"] });
          window.location.href = data.url;
        },
        onError: (err: any) => {
          const detail = err?.response?.data?.detail ?? err?.message ?? "Please try again later.";
          toast({
            title: "Could not start verification",
            description: detail,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="p-5 pb-10 space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocation("/profile")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-card"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">KYC Verification</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {isVerified && (
              <div className="p-5 rounded-2xl bg-green-500/10 flex items-center gap-4">
                <CheckCircle2 className="w-10 h-10 text-green-500 shrink-0" />
                <div>
                  <p className="font-bold text-green-500">Identity Verified</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your account is fully verified. All features and limits are unlocked.</p>
                </div>
              </div>
            )}

            {isPending && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-yellow-500/10 flex items-center gap-4">
                  <Clock className="w-10 h-10 text-yellow-500 shrink-0 animate-pulse" />
                  <div>
                    <p className="font-bold text-yellow-500">Verification In Progress</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Didit is reviewing your documents. Usually under 2 minutes.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-card/60 rounded-xl p-3">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                  <span>Your status will update automatically once Didit finishes processing.</span>
                </div>
              </div>
            )}

            {isRejected && (
              <div className="p-5 rounded-2xl bg-red-500/10 flex items-center gap-4">
                <XCircle className="w-10 h-10 text-red-500 shrink-0" />
                <div>
                  <p className="font-bold text-red-500">Verification Failed</p>
                  {kyc?.rejectionReason && <p className="text-xs text-muted-foreground mt-0.5">{kyc.rejectionReason}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">You can try again below.</p>
                </div>
              </div>
            )}

            {canStart && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold mb-0.5">Verify your identity</h2>
                  <p className="text-sm text-muted-foreground">Powered by Didit — takes under 2 minutes</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs text-muted-foreground">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-12 rounded-xl bg-card border-0"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs text-muted-foreground">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-12 rounded-xl bg-card border-0"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-xs text-muted-foreground">Country of Residence</Label>
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    className="w-full h-12 rounded-xl bg-card text-sm px-3 outline-none appearance-none border-0 text-foreground"
                  >
                    <option value="">Select your country</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="documentType" className="text-xs text-muted-foreground">Verification Document</Label>
                  <select
                    id="documentType"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    required
                    className="w-full h-12 rounded-xl bg-card text-sm px-3 outline-none appearance-none border-0 text-foreground"
                  >
                    <option value="">Select document type</option>
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-card/60 rounded-xl p-3">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                  <span>Your data is processed securely by Didit and never stored on our servers. 220+ countries supported.</span>
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 rounded-xl text-base font-semibold shadow-none"
                  disabled={sessionMutation.isPending}
                >
                  {sessionMutation.isPending ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Starting verification…</>
                  ) : (
                    "Start Verification →"
                  )}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
