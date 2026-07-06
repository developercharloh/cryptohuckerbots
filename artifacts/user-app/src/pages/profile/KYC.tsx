import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetKYC, useGetProfile, useSubmitKYC } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Loader2,
  Upload,
  FileCheck2,
} from "lucide-react";
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

type Tier = "tier1" | "tier2";

function statusMeta(status: string) {
  const isVerified = status === "verified" || status === "approved";
  const isPending = status === "pending" || status === "submitted" || status === "under_review";
  const isRejected = status === "rejected";
  return { isVerified, isPending, isRejected, canStart: !isVerified && !isPending };
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function FileUploadField({
  label,
  hint,
  fileUrl,
  onUploaded,
  capture,
}: {
  label: string;
  hint: string;
  fileUrl: string | null;
  onUploaded: (dataUrl: string) => void;
  capture?: "user" | "environment";
}) {
  const { toast } = useToast();
  const [isReading, setIsReading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({ title: "File too large", description: "Please upload an image under 8MB.", variant: "destructive" });
      return;
    }
    setIsReading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onUploaded(dataUrl);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message ?? "Could not read file", variant: "destructive" });
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <label className="flex items-center gap-3 h-14 rounded-xl bg-card border-0 px-3 cursor-pointer">
        <input
          type="file"
          accept={capture ? "image/*" : "image/*,application/pdf"}
          capture={capture}
          className="hidden"
          onChange={handleChange}
          disabled={isReading}
        />
        {isReading ? (
          <>
            <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
            <span className="text-sm text-muted-foreground">Processing…</span>
          </>
        ) : fileUrl ? (
          <>
            <FileCheck2 className="w-5 h-5 text-green-500 shrink-0" />
            <span className="text-sm truncate">File uploaded — tap to replace</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm text-muted-foreground">{hint}</span>
          </>
        )}
      </label>
    </div>
  );
}

function TierForm({
  tier,
  title,
  subtitle,
  prefillFullName,
  prefillCountry,
  onCountryChange,
  isKenya,
  onSubmitted,
}: {
  tier: Tier;
  title: string;
  subtitle: string;
  prefillFullName: string;
  prefillCountry: string;
  onCountryChange?: (country: string) => void;
  isKenya?: boolean;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const submitMutation = useSubmitKYC();

  const [fullName, setFullName] = useState(prefillFullName);
  const [country, setCountry] = useState(prefillCountry);
  const [address, setAddress] = useState("");
  const [ssn, setSsn] = useState("");
  const [idType, setIdType] = useState("");
  const [documentFrontUrl, setDocumentFrontUrl] = useState<string | null>(null);
  const [documentBackUrl, setDocumentBackUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [proofOfAddressUrl, setProofOfAddressUrl] = useState<string | null>(null);

  useEffect(() => setFullName((prev) => prev || prefillFullName), [prefillFullName]);
  useEffect(() => setCountry((prev) => prev || prefillCountry), [prefillCountry]);

  const handleCountryChange = (value: string) => {
    setCountry(value);
    onCountryChange?.(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !country || !ssn.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (tier === "tier1" && !isKenya && !address.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (tier === "tier1" && (!documentFrontUrl || !documentBackUrl || !selfieUrl)) {
      toast({ title: "Please upload both sides of your ID and a selfie photo", variant: "destructive" });
      return;
    }
    if (tier === "tier1" && !isKenya && !idType) {
      toast({ title: "Please select an ID type", variant: "destructive" });
      return;
    }
    if (tier === "tier2" && !proofOfAddressUrl) {
      toast({ title: "Please upload a proof of address document", variant: "destructive" });
      return;
    }

    submitMutation.mutate(
      {
        data: {
          tier,
          fullName: fullName.trim(),
          country,
          address: isKenya ? undefined : address.trim(),
          ssn: ssn.trim(),
          idType: idType || undefined,
          documentType: tier === "tier1" ? idType : undefined,
          documentFrontUrl: documentFrontUrl ?? undefined,
          documentBackUrl: documentBackUrl ?? undefined,
          selfieUrl: selfieUrl ?? undefined,
          proofOfAddressUrl: proofOfAddressUrl ?? undefined,
        },
      },
      {
        onSuccess: onSubmitted,
        onError: (err: any) => {
          const detail = err?.response?.data?.error ?? err?.message ?? "Please try again later.";
          toast({ title: "Could not submit verification", description: detail, variant: "destructive" });
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-0.5">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`fullName-${tier}`} className="text-xs text-muted-foreground">Full Legal Name</Label>
        <Input
          id={`fullName-${tier}`}
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="h-12 rounded-xl bg-card border-0"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`country-${tier}`} className="text-xs text-muted-foreground">Country of Residence</Label>
        <select
          id={`country-${tier}`}
          value={country}
          onChange={(e) => handleCountryChange(e.target.value)}
          required
          className="w-full h-12 rounded-xl bg-card text-sm px-3 outline-none appearance-none border-0 text-foreground"
        >
          <option value="">Select your country</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {!isKenya && (
        <div className="space-y-1.5">
          <Label htmlFor={`address-${tier}`} className="text-xs text-muted-foreground">Residential Address</Label>
          <Textarea
            id={`address-${tier}`}
            placeholder="123 Main St, Apt 4B, City, State, ZIP"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="rounded-xl bg-card border-0 min-h-[80px]"
            required
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`ssn-${tier}`} className="text-xs text-muted-foreground">
          {isKenya ? "National ID Number" : "Social Security Number (SSN)"}
        </Label>
        <Input
          id={`ssn-${tier}`}
          placeholder={isKenya ? "12345678" : "XXX-XX-XXXX"}
          value={ssn}
          onChange={(e) => setSsn(e.target.value)}
          className="h-12 rounded-xl bg-card border-0"
          required
        />
      </div>

      {tier === "tier1" && (
        <>
          {!isKenya && (
            <div className="space-y-1.5">
              <Label htmlFor={`idType-${tier}`} className="text-xs text-muted-foreground">ID Type</Label>
              <select
                id={`idType-${tier}`}
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                required
                className="w-full h-12 rounded-xl bg-card text-sm px-3 outline-none appearance-none border-0 text-foreground"
              >
                <option value="">Select document type</option>
                {DOC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          <FileUploadField
            label="ID Document (Front)"
            hint="Upload a clear photo or scan of the front of your ID"
            fileUrl={documentFrontUrl}
            onUploaded={setDocumentFrontUrl}
          />

          <FileUploadField
            label="ID Document (Back)"
            hint="Upload a clear photo or scan of the back of your ID"
            fileUrl={documentBackUrl}
            onUploaded={setDocumentBackUrl}
          />

          <FileUploadField
            label="Selfie Photo"
            hint="Take or upload a clear selfie photo"
            fileUrl={selfieUrl}
            onUploaded={setSelfieUrl}
            capture="user"
          />
        </>
      )}

      {tier === "tier2" && (
        <FileUploadField
          label="Proof of Address"
          hint="Upload a recent utility bill or bank statement"
          fileUrl={proofOfAddressUrl}
          onUploaded={setProofOfAddressUrl}
        />
      )}

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-card/60 rounded-xl p-3">
        <ShieldCheck className="w-4 h-4 shrink-0 text-primary mt-0.5" />
        <span>Your information is reviewed manually by our compliance team and kept confidential.</span>
      </div>

      <Button type="submit" className="w-full h-14 rounded-xl text-base font-semibold shadow-none" disabled={submitMutation.isPending}>
        {submitMutation.isPending ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Submitting…</>
        ) : (
          "Submit for Review →"
        )}
      </Button>
    </form>
  );
}

function TierStatusCard({ tier, status, rejectionReason }: { tier: Tier; status: string; rejectionReason?: string | null }) {
  const { isVerified, isPending, isRejected } = statusMeta(status);
  const label = tier === "tier1" ? "Tier 1 (Identity)" : "Tier 2 (Address)";

  if (isVerified) {
    return (
      <div className="p-5 rounded-2xl bg-green-500/10 flex items-center gap-4">
        <CheckCircle2 className="w-10 h-10 text-green-500 shrink-0" />
        <div>
          <p className="font-bold text-green-500">{label} Verified</p>
          <p className="text-xs text-muted-foreground mt-0.5">This tier has been approved.</p>
        </div>
      </div>
    );
  }
  if (isPending) {
    return (
      <div className="p-5 rounded-2xl bg-yellow-500/10 flex items-center gap-4">
        <Clock className="w-10 h-10 text-yellow-500 shrink-0 animate-pulse" />
        <div>
          <p className="font-bold text-yellow-500">{label} — Under Review</p>
          <p className="text-xs text-muted-foreground mt-0.5">Our team is manually reviewing your submission.</p>
        </div>
      </div>
    );
  }
  if (isRejected) {
    return (
      <div className="p-5 rounded-2xl bg-red-500/10 flex items-center gap-4">
        <XCircle className="w-10 h-10 text-red-500 shrink-0" />
        <div>
          <p className="font-bold text-red-500">{label} — Rejected</p>
          {rejectionReason && <p className="text-xs text-muted-foreground mt-0.5">{rejectionReason}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">You can resubmit below.</p>
        </div>
      </div>
    );
  }
  return null;
}

export default function KYC() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: kycList, isLoading: kycLoading } = useGetKYC();
  const { data: profile, isLoading: profileLoading } = useGetProfile();

  const isLoading = kycLoading || profileLoading;

  const tier1 = kycList?.find((k: any) => k.tier === "tier1");
  const tier2 = kycList?.find((k: any) => k.tier === "tier2");
  const tier1Status = tier1?.status ?? "not_submitted";
  const tier2Status = tier2?.status ?? "not_submitted";
  const tier1Meta = statusMeta(tier1Status);
  const tier2Meta = statusMeta(tier2Status);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/profile/kyc"] });

  const fullName = (profile as any)?.fullName ?? "";
  const profileCountry = (profile as any)?.country ?? "";
  const [selectedCountry, setSelectedCountry] = useState(profileCountry);
  useEffect(() => setSelectedCountry((prev: string) => prev || profileCountry), [profileCountry]);
  const isKenya = /kenya/i.test(selectedCountry || "");

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
            <TierStatusCard tier="tier1" status={tier1Status} rejectionReason={tier1?.rejectionReason} />
            {tier1Meta.canStart && (
              <TierForm
                tier="tier1"
                title="Identity Verification"
                subtitle={isKenya ? "Provide your ID number, name, ID document and a selfie" : "Provide your details and a government-issued ID"}
                prefillFullName={fullName}
                prefillCountry={selectedCountry}
                onCountryChange={setSelectedCountry}
                isKenya={isKenya}
                onSubmitted={invalidate}
              />
            )}

            {!isKenya && (
              <div className="border-t border-border/50 pt-5">
                <TierStatusCard tier="tier2" status={tier2Status} rejectionReason={tier2?.rejectionReason} />
                {tier2Meta.canStart && (
                  <TierForm
                    tier="tier2"
                    title="Tier 2: Address Verification"
                    subtitle="Provide your details and a proof of address document"
                    prefillFullName={fullName}
                    prefillCountry={selectedCountry}
                    onSubmitted={invalidate}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
