import { Router } from "express";
import { db, usersTable, sessionsTable, notificationSettingsTable, kycTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { verifySync } from "otplib";
import { notifyUserLogin } from "../lib/loginAlarm";
import { sendPushToAllAdmins } from "../lib/webPush";
import {
  RegisterBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "@workspace/api-zod";

// In-memory store for pending 2FA logins (tempToken → { userId, expires })
const pending2FA = new Map<string, { userId: number; expires: number }>();
// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pending2FA) {
    if (v.expires < now) pending2FA.delete(k);
  }
}, 5 * 60 * 1000);

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "vixus_salt_2024").digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateAccountUid(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let uid = "VAI";
  for (let i = 0; i < 8; i++) uid += chars[Math.floor(Math.random() * chars.length)];
  return uid;
}

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function getUserAgent(req: any): string {
  const ua = req.headers["user-agent"] || "Unknown";
  if (ua.includes("Mobile")) return "Mobile Browser";
  if (ua.includes("Chrome")) return "Chrome Browser";
  if (ua.includes("Firefox")) return "Firefox Browser";
  if (ua.includes("Safari")) return "Safari Browser";
  return "Web Browser";
}

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { fullName, email, password, referralCode } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    return res.status(400).json({ error: "Email already registered" });
  }

  let referredById: number | null = null;
  if (referralCode) {
    const referrer = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode)).limit(1);
    if (referrer.length > 0) {
      referredById = referrer[0].id;
    }
  }

  const [user] = await db.insert(usersTable).values({
    accountUid: generateAccountUid(),
    fullName,
    email,
    passwordHash: hashPassword(password),
    referralCode: generateReferralCode(),
    referredById: referredById ?? undefined,
    kycStatus: "not_verified",
    twoFAEnabled: false,
  }).returning();

  // Init notification settings and KYC
  await db.insert(notificationSettingsTable).values({
    userId: user.id,
    emailNotifications: true,
    botAlerts: true,
    depositWithdrawal: true,
    promotions: false,
  });
  await db.insert(kycTable).values({ userId: user.id, status: "not_submitted" });

  const token = generateToken();
  await db.insert(sessionsTable).values({
    userId: user.id,
    token,
    device: getUserAgent(req),
    ip: (req.ip || "0.0.0.0").replace("::ffff:", ""),
    location: "Unknown",
  });

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { email, password } = parsed.data;

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (users.length === 0 || users[0].passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const user = users[0];

  if (user.status === "suspended") {
    return res.status(403).json({ error: "Your account has been suspended. Please contact support." });
  }

  // If 2FA is enabled, return a temp token instead of a full session
  if (user.twoFAEnabled && user.twoFASecret) {
    const tempToken = crypto.randomBytes(24).toString("hex");
    pending2FA.set(tempToken, { userId: user.id, expires: Date.now() + 5 * 60 * 1000 });
    return res.json({ requires2FA: true, tempToken });
  }

  const token = generateToken();
  await db.insert(sessionsTable).values({
    userId: user.id,
    token,
    device: getUserAgent(req),
    ip: (req.ip || "0.0.0.0").replace("::ffff:", ""),
    location: "Unknown",
  });

  // Notify admin (fire-and-forget — must never throw or crash the server)
  void (async () => {
    try {
      const ip = (req.ip ?? "0.0.0.0").replace("::ffff:", "");
      let country = "Unknown";
      try {
        if (ip !== "0.0.0.0" && ip !== "127.0.0.1" && !ip.startsWith("::1")) {
          const geo = await fetch(`http://ip-api.com/json/${ip}?fields=country,status`);
          const geoJson = await geo.json() as { status?: string; country?: string };
          if (geoJson.status === "success" && geoJson.country) country = geoJson.country;
        }
      } catch { /* geo lookup failed — continue with Unknown */ }
      await notifyUserLogin({
        userId: user.id,
        accountUid: user.accountUid,
        name: user.fullName,
        email: user.email,
        ip,
        country,
      });
      await sendPushToAllAdmins({
        title: "🔐 User Login",
        body: `${user.fullName} (${user.email}) logged in · ${country}`,
        tag: "vixus-login",
        data: { type: "login", userId: user.id },
      });
    } catch { /* notification failed — login still succeeds */ }
  })();

  return res.json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

// Verify 2FA code after password login
router.post("/auth/2fa/verify", async (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) return res.status(400).json({ error: "Missing tempToken or code" });

  const pending = pending2FA.get(tempToken);
  if (!pending || pending.expires < Date.now()) {
    pending2FA.delete(tempToken);
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, pending.userId)).limit(1);
  if (users.length === 0) return res.status(401).json({ error: "User not found" });
  const user = users[0];

  if (!user.twoFASecret || !verifySync({ token: code, secret: user.twoFASecret }).valid) {
    return res.status(401).json({ error: "Invalid 2FA code" });
  }

  pending2FA.delete(tempToken);
  const token = generateToken();
  await db.insert(sessionsTable).values({
    userId: user.id,
    token,
    device: getUserAgent(req),
    ip: (req.ip || "0.0.0.0").replace("::ffff:", ""),
    location: "Unknown",
  });

  return res.json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  return res.json({ message: "Logged out successfully" });
});

router.post("/auth/forgot-password", async (req, res) => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  // In production this would send an email. We just return success.
  return res.json({ message: "Password reset link sent to your email" });
});

router.post("/auth/reset-password", async (req, res) => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  // In production, verify token and update password
  return res.json({ message: "Password reset successfully" });
});

router.get("/auth/me", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
  if (sessions.length === 0) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, sessions[0].userId)).limit(1);
  if (users.length === 0) {
    return res.status(401).json({ error: "User not found" });
  }
  const user = users[0];

  return res.json({
    id: user.id,
    accountUid: user.accountUid,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    kycStatus: user.kycStatus,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
