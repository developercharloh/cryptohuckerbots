import { pgTable, text, serial, integer, numeric, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Users
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  accountUid: varchar("account_uid", { length: 15 }).notNull().unique(),
  fullName: text("full_name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  kycStatus: varchar("kyc_status", { length: 50 }).notNull().default("not_verified"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  isAdmin: boolean("is_admin").notNull().default(false),
  twoFAEnabled: boolean("two_fa_enabled").notNull().default(false),
  twoFASecret: text("two_fa_secret"),
  referralCode: varchar("referral_code", { length: 50 }).notNull(),
  referredById: integer("referred_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// Sessions
export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  device: text("device").notNull().default("Unknown Device"),
  ip: varchar("ip", { length: 100 }).notNull().default("0.0.0.0"),
  location: text("location"),
  lastActive: timestamp("last_active").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Session = typeof sessionsTable.$inferSelect;

// Bots (marketplace templates)
export const botsTable = pgTable("bots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
  winRate: numeric("win_rate", { precision: 5, scale: 2 }).notNull(),
  riskLevel: varchar("risk_level", { length: 50 }).notNull().default("Medium"),
  monthlyReturn: numeric("monthly_return", { precision: 6, scale: 2 }).notNull().default("0"),
  minInvestment: numeric("min_investment", { precision: 12, scale: 2 }).notNull().default("0"),
  iconUrl: text("icon_url"),
  isMarketplace: boolean("is_marketplace").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Bot = typeof botsTable.$inferSelect;

// User bots (purchased/owned)
export const userBotsTable = pgTable("user_bots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  botId: integer("bot_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("paused"),
  profitToday: numeric("profit_today", { precision: 12, scale: 2 }).notNull().default("0"),
  profitTotal: numeric("profit_total", { precision: 12, scale: 2 }).notNull().default("0"),
  totalTrades: integer("total_trades").notNull().default(0),
  startedAt: timestamp("started_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UserBot = typeof userBotsTable.$inferSelect;

// Trade positions (open until TP/SL is hit or manually closed)
export const positionsTable = pgTable("positions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  botId: integer("bot_id").notNull(),
  botName: varchar("bot_name", { length: 255 }).notNull(),
  signalId: varchar("signal_id", { length: 100 }).notNull(),
  pair: varchar("pair", { length: 50 }).notNull(),
  direction: varchar("direction", { length: 10 }).notNull(),
  market: varchar("market", { length: 50 }).notNull(),
  winRate: numeric("win_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  stake: numeric("stake", { precision: 12, scale: 2 }).notNull(),
  targetProfit: numeric("target_profit", { precision: 12, scale: 2 }).notNull(),
  stopLoss: numeric("stop_loss", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  realizedPnl: numeric("realized_pnl", { precision: 12, scale: 2 }),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

export type Position = typeof positionsTable.$inferSelect;

// Transactions
export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  paymentMethod: varchar("payment_method", { length: 100 }).notNull(),
  walletAddress: text("wallet_address"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Transaction = typeof transactionsTable.$inferSelect;

// Earnings
export const earningsTable = pgTable("earnings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  date: timestamp("date").notNull().defaultNow(),
});

export type Earning = typeof earningsTable.$inferSelect;

// Referrals
export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  referredId: integer("referred_id").notNull(),
  earnings: numeric("earnings", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Referral = typeof referralsTable.$inferSelect;

// Notifications
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;

// Notification settings
export const notificationSettingsTable = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  botAlerts: boolean("bot_alerts").notNull().default(true),
  depositWithdrawal: boolean("deposit_withdrawal").notNull().default(true),
  promotions: boolean("promotions").notNull().default(false),
});

export type NotificationSetting = typeof notificationSettingsTable.$inferSelect;

// KYC
export const kycTable = pgTable("kyc", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  status: varchar("status", { length: 50 }).notNull().default("not_submitted"),
  documentType: varchar("document_type", { length: 100 }),
  documentFrontUrl: text("document_front_url"),
  selfieUrl: text("selfie_url"),
  proofOfAddressUrl: text("proof_of_address_url"),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at"),
  reviewedAt: timestamp("reviewed_at"),
  diditSessionId: text("didit_session_id"),
});

export type KYC = typeof kycTable.$inferSelect;

// Support tickets
// Deposit sessions (full crypto deposit flow)
export const depositSessionsTable = pgTable("deposit_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("created"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethodId: varchar("payment_method_id", { length: 100 }).notNull(),
  paymentMethodName: varchar("payment_method_name", { length: 100 }).notNull(),
  network: varchar("network", { length: 100 }).notNull(),
  depositAddress: text("deposit_address").notNull(),
  txid: varchar("txid", { length: 255 }),
  confirmations: integer("confirmations").notNull().default(0),
  requiredConfirmations: integer("required_confirmations").notNull().default(20),
  transactionId: integer("transaction_id"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type DepositSession = typeof depositSessionsTable.$inferSelect;

// Live Chat (user ↔ admin)
export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sender: varchar("sender", { length: 10 }).notNull(), // 'user' | 'admin'
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ChatMessage = typeof chatMessagesTable.$inferSelect;

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("open"),
  adminReply: text("admin_reply"),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;

// FAQ
export const faqTable = pgTable("faq", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
});

export type FAQ = typeof faqTable.$inferSelect;

// User profiles (phone, country)
export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  phone: varchar("phone", { length: 50 }),
  country: varchar("country", { length: 100 }),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;

// Platform settings (single row)
export type PaymentMethod = {
  id: string;
  name: string;
  network: string | null;
  address: string;
  enabled: boolean;
};

// Broadcasts (admin-sent announcements log)
export const broadcastsTable = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Broadcast = typeof broadcastsTable.$inferSelect;

// Admin-only login notifications (never visible to users)
export const adminLoginNotificationsTable = pgTable("admin_login_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountUid: varchar("account_uid", { length: 15 }).notNull(),
  fullName: text("full_name").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  ip: varchar("ip", { length: 100 }).notNull().default("Unknown"),
  country: varchar("country", { length: 100 }).notNull().default("Unknown"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdminLoginNotification = typeof adminLoginNotificationsTable.$inferSelect;

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  appName: text("app_name").notNull().default("VIXUS AI"),
  supportEmail: text("support_email").notNull().default("support@vixus.ai"),
  logoUrl: text("logo_url"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  withdrawalsEnabled: boolean("withdrawals_enabled").notNull().default(true),
  depositsEnabled: boolean("deposits_enabled").notNull().default(true),
  minDeposit: numeric("min_deposit", { precision: 12, scale: 2 }).notNull().default("50"),
  minWithdrawal: numeric("min_withdrawal", { precision: 12, scale: 2 }).notNull().default("20"),
  referralCommission: numeric("referral_commission", { precision: 6, scale: 2 }).notNull().default("10"),
  paymentMethods: jsonb("payment_methods").$type<PaymentMethod[]>().notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Settings = typeof settingsTable.$inferSelect;
