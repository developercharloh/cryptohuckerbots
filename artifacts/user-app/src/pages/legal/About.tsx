import { LegalLayout } from "@/components/LegalLayout";
import { VixusLogo } from "@/components/VixusLogo";
import { Target, Users, ShieldCheck } from "lucide-react";

export default function About() {
  return (
    <LegalLayout title="About Us">
      <div className="flex flex-col items-center text-center py-2">
        <VixusLogo className="w-16 h-16 mb-4" />
        <h2 className="text-lg font-bold text-foreground">VIXUS AI</h2>
        <p className="text-muted-foreground mt-2 max-w-[300px]">
          We make automated trading accessible to everyone — not just Wall
          Street.
        </p>
      </div>

      <section>
        <h2>Our mission</h2>
        <p>
          VIXUS AI was founded in 2023 with a simple goal: give everyday
          investors access to the kind of algorithmic trading tools that were
          once reserved for institutions. We believe transparency, security, and
          ease of use should be the standard, not the exception.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-start gap-3 bg-card rounded-2xl p-4">
          <Target className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground text-sm">Simplicity</h3>
            <p className="text-muted-foreground mt-1">
              Powerful strategies, made approachable for beginners and pros
              alike.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-card rounded-2xl p-4">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground text-sm">Security</h3>
            <p className="text-muted-foreground mt-1">
              Your account is protected with encryption and two-factor
              authentication.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-card rounded-2xl p-4">
          <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground text-sm">Community</h3>
            <p className="text-muted-foreground mt-1">
              A growing community of traders across the country trust our
              platform.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Get in touch</h2>
        <p>
          Questions? Our support team is available Monday–Friday, 9am–6pm ET.
          Reach us anytime at{" "}
          <span className="text-primary">support@vixus.ai</span> or
          through the in-app Support center.
        </p>
      </section>
    </LegalLayout>
  );
}
