import crypto from "node:crypto";
import { db, botsTable, usersTable, faqTable, notificationSettingsTable, kycTable, sessionsTable, userBotsTable, positionsTable, transactionsTable, earningsTable, notificationsTable, depositSessionsTable, supportTicketsTable, userProfilesTable, referralsTable } from "@workspace/db";
import { eq, sql, notInArray, inArray, or, like } from "drizzle-orm";
import { logger } from "./logger";

const FAQ_ENTRIES = [
  { question: "How do I deposit funds?", answer: "Go to Wallet > Deposit, choose your preferred method (USDT TRC20/ERC20, BTC, or card), and follow the on-screen instructions. Your balance updates once the transaction is confirmed.", category: "Deposits" },
  { question: "How do I start a trading bot?", answer: "Go to Bots > Marketplace, select a bot, and tap Buy Bot. Once purchased, the bot activates automatically and begins trading on your behalf.", category: "Bots" },
  { question: "When are profits paid out?", answer: "Profits are credited to your Available Balance in real-time as each trade closes. You can withdraw anytime once your balance meets the minimum threshold.", category: "Earnings" },
  { question: "What is the minimum withdrawal amount?", answer: "The minimum withdrawal is $10 USD equivalent. Withdrawals are processed within 24 hours to your verified payment method.", category: "Withdrawals" },
  { question: "How does the referral program work?", answer: "Share your unique referral link from the Team tab. You earn a commission on every deposit made by users you refer. Track your team and earnings in the Team section.", category: "Referrals" },
  { question: "Is KYC verification required?", answer: "KYC is required to enable withdrawals and unlock higher deposit limits. Go to Profile > KYC Verification and upload a valid government-issued ID.", category: "Security" },
  { question: "How secure is my account?", answer: "We use industry-standard encryption, two-factor authentication (2FA), and session management. Enable 2FA in Profile > Security for maximum protection.", category: "Security" },
  { question: "What if I forget my password?", answer: "Tap Forgot Password on the login screen and enter your registered email. You will receive a reset link within a few minutes. Check your spam folder if it does not arrive.", category: "Account" },
];

// Primary admin accounts — always promoted on startup regardless of env vars.
const SEED_ADMINS = ["admin@vixus.ai"];

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "vixus_salt_2024").digest("hex");
}

function generateUid(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 9).toUpperCase();
}

export async function ensureAdminEmail(): Promise<void> {
  const fromEnv = process.env["ADMIN_EMAIL"];
  const emails = [...SEED_ADMINS, ...(fromEnv ? [fromEnv.toLowerCase().trim()] : [])];

  for (const email of [...new Set(emails)]) {
    // Try to promote existing user first
    const result = await db
      .update(usersTable)
      .set({ isAdmin: true })
      .where(eq(usersTable.email, email))
      .returning({ id: usersTable.id, email: usersTable.email });

    if (result.length > 0) {
      logger.info({ email }, "Admin email auto-promoted");
      continue;
    }

    // User doesn't exist — create the admin account automatically
    try {
      const adminPassword = process.env["ADMIN_ACCOUNT_PASSWORD"] ?? "Admin@VIXUS2027!";
      await db.insert(usersTable).values({
        accountUid: generateUid(),
        fullName: "Platform Admin",
        email,
        passwordHash: hashPassword(adminPassword),
        isAdmin: true,
        referralCode: generateReferralCode(),
        kycStatus: "verified",
        status: "active",
      });
      logger.info({ email }, "Admin user created and promoted automatically");
    } catch (err) {
      logger.warn({ email, err }, "Admin user creation failed (may already exist)");
      // Attempt promotion once more in case of race condition
      await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.email, email));
    }
  }
}

export async function seedDemoAndFaq(): Promise<void> {
  // FAQ
  const count = await db.select({ c: sql<number>`count(*)::int` }).from(faqTable);
  if ((count[0]?.c ?? 0) === 0) {
    await db.insert(faqTable).values(FAQ_ENTRIES);
    logger.info({ count: FAQ_ENTRIES.length }, "FAQ seeded");
  }
}

type SeedBot = {
  name: string;
  description: string;
  category: string;
  price: string;
  winRate: string;
  riskLevel: string;
};

// The canonical trading-bot catalog. All bots are paid. Applied idempotently on
// every server start so the marketplace exists in any database (fresh production
// DBs included), matching bots by name to preserve existing IDs.
const BOT_CATALOG: SeedBot[] = [
  {
    name: "Alpha Signal Bot",
    description:
      "An entry-level forex signal bot that follows proven trend strategies. Ideal for traders starting their automated journey.",
    category: "Forex",
    price: "99",
    winRate: "80.00",
    riskLevel: "Medium",
  },
  {
    name: "Momentum Crypto Bot",
    description:
      "Captures momentum swings across major crypto pairs using balanced risk management and high-frequency signal analysis.",
    category: "Crypto",
    price: "149",
    winRate: "81.00",
    riskLevel: "Medium",
  },
  {
    name: "Breakout Pro Bot",
    description:
      "Detects and trades range breakouts on forex pairs, aiming to ride strong directional moves.",
    category: "Forex",
    price: "250",
    winRate: "84.00",
    riskLevel: "Medium",
  },
  {
    name: "Crypto Hunter Bot",
    description:
      "Hunts high-probability setups across major cryptocurrencies with disciplined risk management.",
    category: "Crypto",
    price: "450",
    winRate: "86.00",
    riskLevel: "Low",
  },
  {
    name: "VIXUS Apex Bot",
    description:
      "Our flagship AI bot combining multiple models for premium signal quality, top-tier win rates, and the lowest drawdown.",
    category: "AI",
    price: "1000",
    winRate: "93.00",
    riskLevel: "Low",
  },
];

// Delete users whose emails use obviously fake domains (test/migration artifacts).
// Runs once on startup; idempotent — safe to leave in place.
const FAKE_EMAIL_PATTERNS = ["%@ex.com", "%@example.com"];
const DEMO_EMAILS_TO_PURGE = ["demo@vixus.ai"];

export async function purgeTestUsers(): Promise<void> {
  const fakeUsers = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(or(
      ...FAKE_EMAIL_PATTERNS.map((p) => like(usersTable.email, p)),
      ...DEMO_EMAILS_TO_PURGE.map((e) => eq(usersTable.email, e)),
    ));

  if (fakeUsers.length === 0) {
    logger.info("purgeTestUsers: no fake users found");
    return;
  }

  const ids = fakeUsers.map((u) => u.id);
  logger.info({ ids, emails: fakeUsers.map((u) => u.email) }, "purgeTestUsers: deleting fake users");

  // Delete child rows in dependency order before removing the parent user rows.
  await db.delete(supportTicketsTable).where(inArray(supportTicketsTable.userId, ids));
  await db.delete(depositSessionsTable).where(inArray(depositSessionsTable.userId, ids));
  await db.delete(positionsTable).where(inArray(positionsTable.userId, ids));
  await db.delete(earningsTable).where(inArray(earningsTable.userId, ids));
  await db.delete(notificationsTable).where(inArray(notificationsTable.userId, ids));
  await db.delete(notificationSettingsTable).where(inArray(notificationSettingsTable.userId, ids));
  await db.delete(userBotsTable).where(inArray(userBotsTable.userId, ids));
  await db.delete(transactionsTable).where(inArray(transactionsTable.userId, ids));
  await db.delete(sessionsTable).where(inArray(sessionsTable.userId, ids));
  await db.delete(kycTable).where(inArray(kycTable.userId, ids));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.userId, ids));
  await db.delete(referralsTable).where(inArray(referralsTable.referrerId, ids));
  await db.delete(usersTable).where(inArray(usersTable.id, ids));

  logger.info({ count: ids.length }, "purgeTestUsers: done");
}

export async function seedBots(): Promise<void> {
  let inserted = 0;

  for (const bot of BOT_CATALOG) {
    const existing = await db
      .select()
      .from(botsTable)
      .where(eq(botsTable.name, bot.name))
      .limit(1);

    // Only insert if the bot doesn't exist yet — never overwrite admin edits
    if (existing.length === 0) {
      await db.insert(botsTable).values({
        name: bot.name,
        description: bot.description,
        category: bot.category,
        price: bot.price,
        winRate: bot.winRate,
        riskLevel: bot.riskLevel,
        isMarketplace: true,
      });
      inserted += 1;
    }
  }

  logger.info({ inserted, total: BOT_CATALOG.length }, "Bot catalog seeded");
}
