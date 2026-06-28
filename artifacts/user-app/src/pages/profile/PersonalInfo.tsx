import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetProfile, useUpdateProfile } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Loader2, Pencil, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const COUNTRIES = [
  { name: "🇦🇫 Afghanistan", dial: "+93" }, { name: "🇦🇱 Albania", dial: "+355" },
  { name: "🇩🇿 Algeria", dial: "+213" }, { name: "🇦🇩 Andorra", dial: "+376" },
  { name: "🇦🇴 Angola", dial: "+244" }, { name: "🇦🇬 Antigua and Barbuda", dial: "+1-268" },
  { name: "🇦🇷 Argentina", dial: "+54" }, { name: "🇦🇲 Armenia", dial: "+374" },
  { name: "🇦🇺 Australia", dial: "+61" }, { name: "🇦🇹 Austria", dial: "+43" },
  { name: "🇦🇿 Azerbaijan", dial: "+994" }, { name: "🇧🇸 Bahamas", dial: "+1-242" },
  { name: "🇧🇭 Bahrain", dial: "+973" }, { name: "🇧🇩 Bangladesh", dial: "+880" },
  { name: "🇧🇧 Barbados", dial: "+1-246" }, { name: "🇧🇾 Belarus", dial: "+375" },
  { name: "🇧🇪 Belgium", dial: "+32" }, { name: "🇧🇿 Belize", dial: "+501" },
  { name: "🇧🇯 Benin", dial: "+229" }, { name: "🇧🇹 Bhutan", dial: "+975" },
  { name: "🇧🇴 Bolivia", dial: "+591" }, { name: "🇧🇦 Bosnia and Herzegovina", dial: "+387" },
  { name: "🇧🇼 Botswana", dial: "+267" }, { name: "🇧🇷 Brazil", dial: "+55" },
  { name: "🇧🇳 Brunei", dial: "+673" }, { name: "🇧🇬 Bulgaria", dial: "+359" },
  { name: "🇧🇫 Burkina Faso", dial: "+226" }, { name: "🇧🇮 Burundi", dial: "+257" },
  { name: "🇰🇭 Cambodia", dial: "+855" }, { name: "🇨🇲 Cameroon", dial: "+237" },
  { name: "🇨🇦 Canada", dial: "+1" }, { name: "🇨🇻 Cape Verde", dial: "+238" },
  { name: "🇨🇫 Central African Republic", dial: "+236" }, { name: "🇹🇩 Chad", dial: "+235" },
  { name: "🇨🇱 Chile", dial: "+56" }, { name: "🇨🇳 China", dial: "+86" },
  { name: "🇨🇴 Colombia", dial: "+57" }, { name: "🇰🇲 Comoros", dial: "+269" },
  { name: "🇨🇬 Congo", dial: "+242" }, { name: "🇨🇷 Costa Rica", dial: "+506" },
  { name: "🇭🇷 Croatia", dial: "+385" }, { name: "🇨🇺 Cuba", dial: "+53" },
  { name: "🇨🇾 Cyprus", dial: "+357" }, { name: "🇨🇿 Czech Republic", dial: "+420" },
  { name: "🇩🇰 Denmark", dial: "+45" }, { name: "🇩🇯 Djibouti", dial: "+253" },
  { name: "🇩🇴 Dominican Republic", dial: "+1-809" }, { name: "🇨🇩 DR Congo", dial: "+243" },
  { name: "🇪🇨 Ecuador", dial: "+593" }, { name: "🇪🇬 Egypt", dial: "+20" },
  { name: "🇸🇻 El Salvador", dial: "+503" }, { name: "🇬🇶 Equatorial Guinea", dial: "+240" },
  { name: "🇪🇷 Eritrea", dial: "+291" }, { name: "🇪🇪 Estonia", dial: "+372" },
  { name: "🇸🇿 Eswatini", dial: "+268" }, { name: "🇪🇹 Ethiopia", dial: "+251" },
  { name: "🇫🇯 Fiji", dial: "+679" }, { name: "🇫🇮 Finland", dial: "+358" },
  { name: "🇫🇷 France", dial: "+33" }, { name: "🇬🇦 Gabon", dial: "+241" },
  { name: "🇬🇲 Gambia", dial: "+220" }, { name: "🇬🇪 Georgia", dial: "+995" },
  { name: "🇩🇪 Germany", dial: "+49" }, { name: "🇬🇭 Ghana", dial: "+233" },
  { name: "🇬🇷 Greece", dial: "+30" }, { name: "🇬🇹 Guatemala", dial: "+502" },
  { name: "🇬🇳 Guinea", dial: "+224" }, { name: "🇬🇾 Guyana", dial: "+592" },
  { name: "🇭🇹 Haiti", dial: "+509" }, { name: "🇭🇳 Honduras", dial: "+504" },
  { name: "🇭🇺 Hungary", dial: "+36" }, { name: "🇮🇸 Iceland", dial: "+354" },
  { name: "🇮🇳 India", dial: "+91" }, { name: "🇮🇩 Indonesia", dial: "+62" },
  { name: "🇮🇷 Iran", dial: "+98" }, { name: "🇮🇶 Iraq", dial: "+964" },
  { name: "🇮🇪 Ireland", dial: "+353" }, { name: "🇮🇱 Israel", dial: "+972" },
  { name: "🇮🇹 Italy", dial: "+39" }, { name: "🇨🇮 Ivory Coast", dial: "+225" },
  { name: "🇯🇲 Jamaica", dial: "+1-876" }, { name: "🇯🇵 Japan", dial: "+81" },
  { name: "🇯🇴 Jordan", dial: "+962" }, { name: "🇰🇿 Kazakhstan", dial: "+7" },
  { name: "🇰🇪 Kenya", dial: "+254" }, { name: "🇰🇼 Kuwait", dial: "+965" },
  { name: "🇰🇬 Kyrgyzstan", dial: "+996" }, { name: "🇱🇦 Laos", dial: "+856" },
  { name: "🇱🇻 Latvia", dial: "+371" }, { name: "🇱🇧 Lebanon", dial: "+961" },
  { name: "🇱🇸 Lesotho", dial: "+266" }, { name: "🇱🇷 Liberia", dial: "+231" },
  { name: "🇱🇾 Libya", dial: "+218" }, { name: "🇱🇹 Lithuania", dial: "+370" },
  { name: "🇱🇺 Luxembourg", dial: "+352" }, { name: "🇲🇬 Madagascar", dial: "+261" },
  { name: "🇲🇼 Malawi", dial: "+265" }, { name: "🇲🇾 Malaysia", dial: "+60" },
  { name: "🇲🇻 Maldives", dial: "+960" }, { name: "🇲🇱 Mali", dial: "+223" },
  { name: "🇲🇹 Malta", dial: "+356" }, { name: "🇲🇷 Mauritania", dial: "+222" },
  { name: "🇲🇺 Mauritius", dial: "+230" }, { name: "🇲🇽 Mexico", dial: "+52" },
  { name: "🇲🇩 Moldova", dial: "+373" }, { name: "🇲🇨 Monaco", dial: "+377" },
  { name: "🇲🇳 Mongolia", dial: "+976" }, { name: "🇲🇪 Montenegro", dial: "+382" },
  { name: "🇲🇦 Morocco", dial: "+212" }, { name: "🇲🇿 Mozambique", dial: "+258" },
  { name: "🇲🇲 Myanmar", dial: "+95" }, { name: "🇳🇦 Namibia", dial: "+264" },
  { name: "🇳🇵 Nepal", dial: "+977" }, { name: "🇳🇱 Netherlands", dial: "+31" },
  { name: "🇳🇿 New Zealand", dial: "+64" }, { name: "🇳🇮 Nicaragua", dial: "+505" },
  { name: "🇳🇪 Niger", dial: "+227" }, { name: "🇳🇬 Nigeria", dial: "+234" },
  { name: "🇰🇵 North Korea", dial: "+850" }, { name: "🇲🇰 North Macedonia", dial: "+389" },
  { name: "🇳🇴 Norway", dial: "+47" }, { name: "🇴🇲 Oman", dial: "+968" },
  { name: "🇵🇰 Pakistan", dial: "+92" }, { name: "🇵🇸 Palestine", dial: "+970" },
  { name: "🇵🇦 Panama", dial: "+507" }, { name: "🇵🇬 Papua New Guinea", dial: "+675" },
  { name: "🇵🇾 Paraguay", dial: "+595" }, { name: "🇵🇪 Peru", dial: "+51" },
  { name: "🇵🇭 Philippines", dial: "+63" }, { name: "🇵🇱 Poland", dial: "+48" },
  { name: "🇵🇹 Portugal", dial: "+351" }, { name: "🇶🇦 Qatar", dial: "+974" },
  { name: "🇷🇴 Romania", dial: "+40" }, { name: "🇷🇺 Russia", dial: "+7" },
  { name: "🇷🇼 Rwanda", dial: "+250" }, { name: "🇸🇦 Saudi Arabia", dial: "+966" },
  { name: "🇸🇳 Senegal", dial: "+221" }, { name: "🇷🇸 Serbia", dial: "+381" },
  { name: "🇸🇱 Sierra Leone", dial: "+232" }, { name: "🇸🇬 Singapore", dial: "+65" },
  { name: "🇸🇰 Slovakia", dial: "+421" }, { name: "🇸🇮 Slovenia", dial: "+386" },
  { name: "🇸🇴 Somalia", dial: "+252" }, { name: "🇿🇦 South Africa", dial: "+27" },
  { name: "🇰🇷 South Korea", dial: "+82" }, { name: "🇸🇸 South Sudan", dial: "+211" },
  { name: "🇪🇸 Spain", dial: "+34" }, { name: "🇱🇰 Sri Lanka", dial: "+94" },
  { name: "🇸🇩 Sudan", dial: "+249" }, { name: "🇸🇷 Suriname", dial: "+597" },
  { name: "🇸🇪 Sweden", dial: "+46" }, { name: "🇨🇭 Switzerland", dial: "+41" },
  { name: "🇸🇾 Syria", dial: "+963" }, { name: "🇹🇼 Taiwan", dial: "+886" },
  { name: "🇹🇯 Tajikistan", dial: "+992" }, { name: "🇹🇿 Tanzania", dial: "+255" },
  { name: "🇹🇭 Thailand", dial: "+66" }, { name: "🇹🇬 Togo", dial: "+228" },
  { name: "🇹🇹 Trinidad and Tobago", dial: "+1-868" }, { name: "🇹🇳 Tunisia", dial: "+216" },
  { name: "🇹🇷 Turkey", dial: "+90" }, { name: "🇹🇲 Turkmenistan", dial: "+993" },
  { name: "🇺🇬 Uganda", dial: "+256" }, { name: "🇺🇦 Ukraine", dial: "+380" },
  { name: "🇦🇪 United Arab Emirates", dial: "+971" }, { name: "🇬🇧 United Kingdom", dial: "+44" },
  { name: "🇺🇸 United States", dial: "+1" }, { name: "🇺🇾 Uruguay", dial: "+598" },
  { name: "🇺🇿 Uzbekistan", dial: "+998" }, { name: "🇻🇪 Venezuela", dial: "+58" },
  { name: "🇻🇳 Vietnam", dial: "+84" }, { name: "🇾🇪 Yemen", dial: "+967" },
  { name: "🇿🇲 Zambia", dial: "+260" }, { name: "🇿🇼 Zimbabwe", dial: "+263" },
];

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className="bg-card h-14 rounded-xl px-4 flex items-center">
        <span className="text-sm font-medium">{value || <span className="text-muted-foreground/50">—</span>}</span>
      </div>
    </div>
  );
}

export default function PersonalInfo() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: profile, isLoading } = useGetProfile();
  const updateMutation = useUpdateProfile();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName ?? "");
      setPhone((profile as any).phone ?? "");
      setCountry((profile as any).country ?? "");
    }
  }, [profile]);

  const selectedCountry = COUNTRIES.find((c) => c.name === country);

  const handleCancel = () => {
    if (profile) {
      setFullName(profile.fullName ?? "");
      setPhone((profile as any).phone ?? "");
      setCountry((profile as any).country ?? "");
    }
    setError("");
    setEditing(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || fullName.trim().length < 2) {
      setError("Full name must be at least 2 characters");
      return;
    }
    setError("");
    updateMutation.mutate(
      { data: { fullName, phone, country } },
      {
        onSuccess: () => {
          toast({ title: "Profile updated successfully" });
          setEditing(false);
        },
        onError: (err: any) => toast({ title: "Update failed", description: err?.message, variant: "destructive" }),
      }
    );
  };

  return (
    <Layout>
      <div className="p-5 pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocation("/profile")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-card"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight flex-1">Personal Information</h1>
          {!isLoading && (
            <button
              type="button"
              onClick={() => editing ? handleCancel() : setEditing(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-card transition-colors hover:bg-primary/10"
              title={editing ? "Cancel editing" : "Edit personal details"}
            >
              {editing ? <X className="w-4.5 h-4.5 text-muted-foreground" /> : <Pencil className="w-4 h-4 text-primary" />}
            </button>
          )}
        </div>

        {!editing && !isLoading && (
          <p className="text-xs text-muted-foreground -mt-2 flex items-center gap-1.5">
            <Pencil className="w-3 h-3" /> Tap the edit icon to update your details
          </p>
        )}

        {isLoading ? (
          <div className="space-y-6">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : editing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Full Name</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="bg-card border-none h-14 rounded-xl px-4"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="space-y-2 opacity-60">
              <label className="text-xs text-muted-foreground font-medium">Email Address</label>
              <Input
                value={profile?.email ?? ""}
                className="bg-card border-none h-14 rounded-xl px-4"
                readOnly
                disabled
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Phone Number</label>
              <div className="flex gap-2">
                {selectedCountry && (
                  <div className="flex items-center bg-card rounded-xl px-3 h-14 shrink-0 text-sm text-muted-foreground font-medium">
                    {selectedCountry.dial}
                  </div>
                )}
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={selectedCountry ? "Enter number" : "+1 234 567 8900"}
                  className="bg-card border-none h-14 rounded-xl px-4 flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full h-14 rounded-xl px-4 text-sm font-medium border-none outline-none"
                style={{ background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
              >
                <option value="">Select your country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.dial})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-14 rounded-xl text-base font-medium"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-14 rounded-xl text-base font-medium shadow-none"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <ReadField label="Full Name" value={fullName} />
            <ReadField label="Email Address" value={profile?.email ?? ""} />
            <ReadField
              label="Phone Number"
              value={selectedCountry ? `${selectedCountry.dial} ${phone}` : phone || ""}
            />
            <ReadField label="Country" value={country} />
          </div>
        )}
      </div>
    </Layout>
  );
}
