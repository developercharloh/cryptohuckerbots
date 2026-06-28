import { LegalLayout } from "@/components/LegalLayout";
import { AlertTriangle } from "lucide-react";

export default function Risk() {
  return (
    <LegalLayout title="Risk Disclosure" updated="June 2026">
      <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
        <p className="text-yellow-200/90 text-sm m-0">
          Trading involves substantial risk of loss and is not suitable for every
          investor. Only invest capital you can afford to lose.
        </p>
      </div>

      <section>
        <h2>No guarantee of profit</h2>
        <p>
          Automated trading strategies can and do lose money. Nothing on this
          platform should be interpreted as a promise or guarantee of returns.
          Any performance figures, charts, or statistics are illustrative and do
          not guarantee future results.
        </p>
      </section>

      <section>
        <h2>Past performance</h2>
        <p>
          Past performance is not indicative of future results. Market conditions
          change, and a strategy that performed well historically may perform
          poorly going forward.
        </p>
      </section>

      <section>
        <h2>Market and volatility risk</h2>
        <p>
          Foreign exchange and cryptocurrency markets are highly volatile. Prices
          can move rapidly against your position, and you may lose your entire
          investment in a short period of time.
        </p>
      </section>

      <section>
        <h2>Your responsibility</h2>
        <ul>
          <li>Understand the risks before depositing funds.</li>
          <li>Never invest borrowed money or funds you cannot afford to lose.</li>
          <li>Consider seeking advice from an independent financial advisor.</li>
        </ul>
      </section>

      <section>
        <h2>Not financial advice</h2>
        <p>
          The Service provides trading tools, not personalized financial,
          investment, legal, or tax advice. You are solely responsible for your
          trading decisions.
        </p>
      </section>
    </LegalLayout>
  );
}
