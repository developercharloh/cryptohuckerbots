import { LegalLayout } from "@/components/LegalLayout";
import { Mail, MessageCircle, Clock } from "lucide-react";

export default function Contact() {
  return (
    <LegalLayout title="Contact Us">
      <section className="space-y-3">
        <div className="flex items-start gap-3 bg-card rounded-2xl p-4">
          <Mail className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground text-sm">Email support</h3>
            <p className="text-muted-foreground mt-1">
              For account, billing, or trading questions, email us at{" "}
              <span className="text-primary">support@vixus.ai</span>. We
              typically respond within 24 hours.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-card rounded-2xl p-4">
          <MessageCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground text-sm">In-app support</h3>
            <p className="text-muted-foreground mt-1">
              Signed in already? Open the Support center from your profile to
              start a live chat or submit a ticket directly from your account.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-card rounded-2xl p-4">
          <Clock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground text-sm">Hours</h3>
            <p className="text-muted-foreground mt-1">
              Our support team is available Monday–Friday, 9am–6pm ET.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Before you reach out</h2>
        <p>
          Check our{" "}
          <a href="/legal/risk" className="text-primary">Risk Disclosure</a>{" "}
          and{" "}
          <a href="/legal/terms" className="text-primary">Terms of Service</a>{" "}
          for answers to common questions about trading risk, deposits, and
          withdrawals.
        </p>
      </section>
    </LegalLayout>
  );
}
