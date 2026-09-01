import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Layout } from "@/components/Layout";

type Tutorial = {
  id: string;
  label: string;
  title: string;
  description: string;
  icon: typeof BookOpen;
  accent: string;
  steps: string[];
  href: string;
  action: string;
};

const TUTORIALS: Tutorial[] = [
  {
    id: "getting-started",
    label: "Start here",
    title: "Set up your trading workspace",
    description: "Complete your profile, review account protection, and understand the main areas of your VIXUS AI workspace.",
    icon: BookOpen,
    accent: "#60A5FA",
    steps: [
      "Complete your account and country-of-residence details.",
      "Review your verification status and security settings.",
      "Use the dashboard to see your wallets, activity, and available tools.",
    ],
    href: "/profile",
    action: "Open account",
  },
  {
    id: "market-analysis",
    label: "Learn the view",
    title: "Read the markets",
    description: "Use live pair data and market news to build context before deciding whether to review a trading opportunity.",
    icon: BarChart3,
    accent: "#F5B942",
    steps: [
      "Compare price movement and trends across available pairs.",
      "Open a pair to inspect its current market view.",
      "Read the news feed for wider forex, commodity, stock, and crypto context.",
    ],
    href: "/markets",
    action: "Explore markets",
  },
  {
    id: "signals",
    label: "Execute with care",
    title: "Use AI trading signals",
    description: "Review the signal direction, confidence, pair, and stake information before starting a position.",
    icon: Sparkles,
    accent: "#A78BFA",
    steps: [
      "Review the available signal and its confidence information.",
      "Choose one signal or use Execute All when your VIP allowance permits.",
      "Follow the activity feed as each selected signal is opened.",
    ],
    href: "/trade",
    action: "Open trade",
  },
  {
    id: "wallets",
    label: "Manage funds",
    title: "Understand your wallets",
    description: "Keep track of available Main Wallet funds, Vault Capital, deposits, withdrawals, and transaction history.",
    icon: Wallet,
    accent: "#34D399",
    steps: [
      "Use deposits to add funds through an available payment method.",
      "Check wallet balances and recent transactions from the Wallet area.",
      "Review withdrawal details and available-to-withdraw amounts before submitting.",
    ],
    href: "/cashier",
    action: "Open wallet",
  },
  {
    id: "vip-tools",
    label: "Grow your toolkit",
    title: "Explore VIP tools and bots",
    description: "See what each VIP level includes and review bot activity before starting or managing an automated strategy.",
    icon: Bot,
    accent: "#FB7185",
    steps: [
      "Compare the allowances and features available at each VIP level.",
      "Review bot details, stake requirements, and active positions.",
      "Use the analytics view to follow bot performance and activity.",
    ],
    href: "/bots",
    action: "View VIP levels",
  },
];

function TutorialCard({ tutorial, open, onToggle }: {
  tutorial: Tutorial;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = tutorial.icon;

  return (
    <article
      className={`group rounded-3xl border bg-card p-5 transition-all duration-200 ${
        open ? "border-primary/40 shadow-lg shadow-primary/5" : "border-border/60 hover:border-primary/25"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-4 text-left"
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
          style={{
            color: tutorial.accent,
            background: `${tutorial.accent}14`,
            borderColor: `${tutorial.accent}35`,
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {tutorial.label}
          </span>
          <span className="mt-1 block text-base font-bold text-foreground">{tutorial.title}</span>
          <span className="mt-2 block text-sm leading-6 text-muted-foreground">{tutorial.description}</span>
        </span>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180 text-primary" : ""}`} />
      </button>

      {open && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <ol className="space-y-3">
            {tutorial.steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm leading-5 text-foreground/85">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[10px] font-bold text-primary">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link
            href={tutorial.href}
            className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary no-underline hover:text-primary/80"
          >
            {tutorial.action}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </article>
  );
}

export default function Tutorials() {
  const [openTutorial, setOpenTutorial] = useState<string | null>("getting-started");

  return (
    <Layout showNav>
      <main className="min-h-screen bg-background px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-12">
        <div className="mx-auto max-w-6xl">
          <section className="relative overflow-hidden rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-amber-400/15 via-card to-blue-500/10 px-5 py-7 shadow-2xl shadow-black/10 sm:px-8 sm:py-9">
            <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-amber-300/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative max-w-2xl">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <BookOpen className="h-4 w-4" />
                VIXUS AI learning center
              </div>
              <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                Trade with a clearer view.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Learn the essentials of the platform, from reading market information to reviewing signals, managing wallets, and using VIP tools.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-foreground/80">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Risk-aware workflow
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-2">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Step-by-step guides
                </span>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Quick guides</p>
                <h2 className="mt-1 text-xl font-bold text-foreground">Choose a topic</h2>
              </div>
              <Link href="/support" className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground no-underline hover:text-foreground sm:inline-flex">
                <CircleHelp className="h-3.5 w-3.5" />
                Need help?
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {TUTORIALS.map((tutorial) => (
                <TutorialCard
                  key={tutorial.id}
                  tutorial={tutorial}
                  open={openTutorial === tutorial.id}
                  onToggle={() => setOpenTutorial((current) => current === tutorial.id ? null : tutorial.id)}
                />
              ))}
            </div>
          </section>

          <section className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-300/15 bg-blue-400/[0.06] p-4 text-xs leading-5 text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
            <p>
              Take time to review each opportunity and understand the information shown before acting. Trading involves risk, and past performance does not guarantee future results.
            </p>
          </section>
        </div>
      </main>
    </Layout>
  );
}