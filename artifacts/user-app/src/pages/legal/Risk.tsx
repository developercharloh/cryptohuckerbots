import { LegalLayout } from "@/components/LegalLayout";
import { AlertTriangle, BookOpen, LockKeyhole, WalletCards } from "lucide-react";

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

      <section className="rounded-2xl border border-blue-400/20 bg-blue-400/5 p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-300" />
          <h2 className="!mt-0">How VIXUS works</h2>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-background/30 p-3">
            <WalletCards className="h-4 w-4 text-amber-300" />
            <p className="mt-2 text-xs font-semibold">Main Wallet</p>
            <p className="mt-1 text-[11px] leading-relaxed">Spendable funds used for eligible deposits, withdrawals, and account actions.</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/30 p-3">
            <LockKeyhole className="h-4 w-4 text-blue-300" />
            <p className="mt-2 text-xs font-semibold">Vault Capital</p>
            <p className="mt-1 text-[11px] leading-relaxed">Capital assigned to an active VIP strategy and shown separately from spendable funds.</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/30 p-3">
            <BookOpen className="h-4 w-4 text-emerald-300" />
            <p className="mt-2 text-xs font-semibold">Recorded activity</p>
            <p className="mt-1 text-[11px] leading-relaxed">Completed deposits, withdrawals, rewards, fees, and trade outcomes are reflected in your ledger.</p>
          </div>
        </div>
      </section>

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
        <h2>Signal rewards</h2>
        <p>
          Eligible completed signals receive a fixed $1.50 Signal Reward
          credited to the Main Wallet and reflected in the Portfolio Wallet total.
          This is a disclosed program credit and is recorded separately from
          trading P&amp;L; it is not a statement of market performance or a
          guarantee of trading returns.
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
