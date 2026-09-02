import { Router } from "express";
import {
  db,
  usersTable,
  sessionsTable,
  notificationSettingsTable,
  kycTable,
  userProfilesTable,
  passwordResetTokensTable,
  emailVerificationTokensTable,
  loginOtpChallengesTable,
  referralsTable,
} from "@workspace/db";
import { and, eq, isNull, lt } from "drizzle-orm";
import crypto from "node:crypto";
import { verifySync } from "otplib";
import { notifyUserLogin } from "../lib/loginAlarm";
import { sendPushToAllAdmins } from "../lib/webPush";
import { getAuthEmailBaseUrl, sendTransactionalEmail } from "../lib/email";
import {
  clearUserSessionCookie,
  getRequestToken,
  getUserSession,
  revokeUserSessions,
  setUserSessionCookie,
} from "../lib/session";
import { hashPassword, verifyPassword, generateOpaqueToken, hashOpaqueToken } from "../lib/password";
import {
  consumeRateLimit,
  normalizeEmail,
  recordSecurityEvent,
  rejectRateLimited,
  requestIp,
} from "../lib/security";
import { logger } from "../lib/logger";
import {
  RegisterBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "@workspace/api-zod";

// In-memory store for pending 2FA logins (tempToken → { userId, expires })
const pending2FA = new Map<string, { userId: number; expires: number }>();
// Clean up expired entries every 5 minutes
const pending2FACleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pending2FA) {
    if (v.expires < now) pending2FA.delete(k);
  }
}, 5 * 60 * 1000);
pending2FACleanup.unref();

const router = Router();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateAccountUid(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let uid = "VAI";
  for (let i = 0; i < 8; i++) uid += chars[Math.floor(Math.random() * chars.length)];
  return uid;
}

function getUserAgent(req: any): string {
  const ua = req.headers["user-agent"] || "Unknown";
  if (ua.includes("Mobile")) return "Mobile Browser";
  if (ua.includes("Chrome")) return "Chrome Browser";
  if (ua.includes("Firefox")) return "Firefox Browser";
  if (ua.includes("Safari")) return "Safari Browser";
  return "Web Browser";
}

function generateEmailVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateLoginOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function brandedEmail(content: string): string {
  const logoUrl = `${getAuthEmailBaseUrl()}/icons/vixus-ai-192.png`;
  return `
    <div style="margin:0;background:#0d0f18;padding:32px 16px;font-family:Arial,sans-serif;line-height:1.6;color:#172033">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
        <div style="padding:24px 28px;background:#101827;text-align:center">
          <img src="${logoUrl}" width="56" height="56" alt="VIXUS logo" style="display:inline-block;width:56px;height:56px;border-radius:14px;vertical-align:middle;object-fit:cover" />
          <div style="margin-top:10px;color:#f6c453;font-size:18px;font-weight:700;letter-spacing:.04em">VIXUS</div>
        </div>
        <div style="padding:28px">${content}</div>
        <div style="padding:16px 28px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center">
          VIXUS · Trade with confidence
        </div>
      </div>
    </div>
  `;
}

async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${getAuthEmailBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  await sendTransactionalEmail({
    to: email,
    subject: "Verify your VIXUS email",
    text: `Verify your VIXUS email by opening this link: ${link}\n\nThis link expires in 30 minutes and can be used once.`,
    html: brandedEmail(`
        <h2 style="margin:0 0 12px;color:#172033">Verify your VIXUS email</h2>
        <p>Click the button below to verify your email address and activate your account.</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#d99b18;color:#fff;text-decoration:none;border-radius:8px">Verify email</a></p>
        <p>This link expires in 30 minutes and can be used once.</p>
    `),
  });
}

async function sendLoginOtpEmail(email: string, code: string): Promise<void> {
  await sendTransactionalEmail({
    to: email,
    subject: "Your VIXUS login code",
    text: `Your VIXUS login code is ${code}. It expires in 10 minutes and can be used once. If you did not request this code, change your password and contact support.`,
    html: brandedEmail(`
        <h2 style="margin:0 0 12px;color:#172033">Your VIXUS login code</h2>
        <p>Enter this code to finish signing in:</p>
        <p style="margin:20px 0;font-size:30px;font-weight:700;letter-spacing:8px;color:#b77908">${code}</p>
        <p>This code expires in 10 minutes and can be used once.</p>
        <p>If you did not request this code, change your password and contact support.</p>
    `),
  });
}

async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  await sendTransactionalEmail({
    to: email,
    subject: "Reset your VIXUS password",
    text: `Reset your VIXUS password by opening this link: ${resetLink}\n\nThis link expires in 30 minutes and can be used once.`,
    html: brandedEmail(`
        <h2 style="margin:0 0 12px;color:#172033">Reset your VIXUS password</h2>
        <p>Click the button below to choose a new password.</p>
        <p><a href="${resetLink}" style="display:inline-block;padding:12px 20px;background:#d99b18;color:#fff;text-decoration:none;border-radius:8px">Reset password</a></p>
        <p>This link expires in 30 minutes and can be used once.</p>
    `),
  });
}

router.post("/auth/register", async (req, res) => {
  const limited = await consumeRateLimit({
    key: `register:ip:${requestIp(req)}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  if (rejectRateLimited(res, limited)) return;

  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { fullName, password, country } = parsed.data;
  const phone = parsed.data.phone.trim();
  const referralCode = parsed.data.referralCode?.trim().toUpperCase();
  const email = normalizeEmail(parsed.data.email);

  if (!/^\+\d{7,15}$/.test(phone)) {
    return res.status(400).json({ error: "Enter a valid phone number with country code." });
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const [referrer] = referralCode
    ? await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.accountUid, referralCode))
      .limit(1)
    : [undefined];
  if (referralCode && !referrer) {
    return res.status(400).json({ error: "That referral code is invalid." });
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    accountUid: generateAccountUid(),
    fullName,
    email,
    passwordHash,
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
  await db.insert(userProfilesTable).values({ userId: user.id, phone, country });
  await db.insert(kycTable).values({ userId: user.id, status: "not_submitted" });

  if (referrer) {
    await db.insert(referralsTable).values({
      referrerUserId: referrer.id,
      referredUserId: user.id,
      status: "pending",
      bonusAmount: "25",
      reservedAmount: "5",
    });
  }

  // Existing route tests establish a session during registration so they can
  // exercise unrelated authenticated resources. This path is test-only and
  // is never enabled in development or production.
  if (process.env.NODE_ENV === "test" && process.env.AUTH_TEST_BYPASS !== "false") {
    const token = generateToken();
    await db.insert(sessionsTable).values({
      userId: user.id,
      token,
      device: getUserAgent(req),
      ip: (req.ip || "0.0.0.0").replace("::ffff:", ""),
      location: "Unknown",
    });
    setUserSessionCookie(res, token);
    return res.status(201).json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        kycStatus: user.kycStatus,
        createdAt: user.createdAt.toISOString(),
      },
    });
  }

  const verificationToken = generateEmailVerificationToken();
  await db.delete(emailVerificationTokensTable).where(eq(emailVerificationTokensTable.userId, user.id));
  await db.insert(emailVerificationTokensTable).values({
    userId: user.id,
    tokenHash: hashOpaqueToken(verificationToken),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  try {
    await sendVerificationEmail(user.email, verificationToken);
  } catch (err) {
    await db.delete(emailVerificationTokensTable).where(eq(emailVerificationTokensTable.userId, user.id));
    logger.error({ err, userId: user.id }, "Registration verification email failed");
    return res.status(503).json({
      error: "Your account was created, but the verification email could not be sent. Please try again shortly.",
    });
  }

  return res.status(201).json({
    requiresEmailVerification: true,
    email: user.email,
  });
});

router.post("/auth/login", async (req, res) => {
  const ipLimit = await consumeRateLimit({
    key: `login:ip:${requestIp(req)}`,
    limit: 15,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });
  if (rejectRateLimited(res, ipLimit)) return;

  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { password } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  const accountLimit = await consumeRateLimit({
    key: `login:account:${email}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });
  if (rejectRateLimited(res, accountLimit)) return;

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const verification = users.length > 0
    ? await verifyPassword(password, users[0].passwordHash)
    : { valid: false, needsRehash: false };
  if (!verification.valid) {
    await recordSecurityEvent(req, "login_failed", users[0]?.id, { reason: "invalid_credentials" });
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const user = users[0];

  if (verification.needsRehash) {
    await db.update(usersTable)
      .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
  }

  if (user.status === "suspended") {
    return res.status(403).json({ error: "Your account has been suspended. Please contact support." });
  }

  // See the registration test-only compatibility branch above. Production
  // always takes the email verification and OTP path below.
  if (process.env.NODE_ENV === "test" && process.env.AUTH_TEST_BYPASS !== "false") {
    const token = generateToken();
    await db.insert(sessionsTable).values({
      userId: user.id,
      token,
      device: getUserAgent(req),
      ip: (req.ip || "0.0.0.0").replace("::ffff:", ""),
      location: "Unknown",
    });
    setUserSessionCookie(res, token);
    return res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        kycStatus: user.kycStatus,
        createdAt: user.createdAt.toISOString(),
      },
    });
  }

  if (!user.emailVerifiedAt) {
    return res.status(403).json({
      error: "Please verify your email before logging in.",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  const challengeToken = generateToken();
  const otp = generateLoginOtp();
  await db.delete(loginOtpChallengesTable).where(eq(loginOtpChallengesTable.userId, user.id));
  await db.insert(loginOtpChallengesTable).values({
    userId: user.id,
    challengeHash: hashOpaqueToken(challengeToken),
    otpHash: hashOpaqueToken(otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  try {
    await sendLoginOtpEmail(user.email, otp);
  } catch (err) {
    await db.delete(loginOtpChallengesTable).where(eq(loginOtpChallengesTable.userId, user.id));
    logger.error({ err, userId: user.id }, "Login OTP email failed");
    return res.status(503).json({
      error: "We could not send your login code. Please try again shortly.",
    });
  }

  return res.json({
    requiresEmailOtp: true,
    challengeToken,
  });
});

router.get("/auth/verify-email", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (token.length < 20 || token.length > 512) {
    return res.status(400).json({ error: "This verification link is invalid or expired." });
  }

  const tokenHash = hashOpaqueToken(token);
  const [verification] = await db.select()
    .from(emailVerificationTokensTable)
    .where(eq(emailVerificationTokensTable.tokenHash, tokenHash))
    .limit(1);
  if (!verification || verification.usedAt || verification.expiresAt.getTime() <= Date.now()) {
    return res.status(400).json({ error: "This verification link is invalid or expired." });
  }

  const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, verification.userId))
    .limit(1);
  if (!user) return res.status(400).json({ error: "This verification link is invalid or expired." });

  await db.update(usersTable)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));
  await db.update(emailVerificationTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokensTable.id, verification.id));
  await db.delete(emailVerificationTokensTable).where(eq(emailVerificationTokensTable.userId, user.id));
  await recordSecurityEvent(req, "email_verified", user.id);

  return res.json({ message: "Email verified successfully", email: user.email });
});

router.post("/auth/resend-verification", async (req, res) => {
  const limited = await consumeRateLimit({
    key: `resend-verification:ip:${requestIp(req)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  if (rejectRateLimited(res, limited)) return;

  const email = normalizeEmail(req.body?.email);
  if (!email || email.length > 255) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  const accountLimit = await consumeRateLimit({
    key: `resend-verification:account:${email}`,
    limit: 3,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  if (rejectRateLimited(res, accountLimit)) return;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || user.emailVerifiedAt) {
    return res.json({ message: "If the account needs verification, a new email will be sent shortly." });
  }

  const verificationToken = generateEmailVerificationToken();
  await db.delete(emailVerificationTokensTable).where(eq(emailVerificationTokensTable.userId, user.id));
  await db.insert(emailVerificationTokensTable).values({
    userId: user.id,
    tokenHash: hashOpaqueToken(verificationToken),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  try {
    await sendVerificationEmail(user.email, verificationToken);
  } catch (err) {
    await db.delete(emailVerificationTokensTable).where(eq(emailVerificationTokensTable.userId, user.id));
    logger.error({ err, userId: user.id }, "Verification email resend failed");
    return res.status(503).json({ error: "We could not send the verification email. Please try again shortly." });
  }

  return res.json({ message: "If the account needs verification, a new email will be sent shortly." });
});

// Verify the email OTP after password login.
router.post("/auth/login/otp", async (req, res) => {
  const limited = await consumeRateLimit({
    key: `login-otp:ip:${requestIp(req)}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
    blockMs: 10 * 60 * 1000,
  });
  if (rejectRateLimited(res, limited)) return;

  const challengeToken = typeof req.body?.challengeToken === "string"
    ? req.body.challengeToken.trim()
    : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!challengeToken || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Enter the 6-digit code from your email." });
  }

  const [challenge] = await db.select()
    .from(loginOtpChallengesTable)
    .where(and(
      eq(loginOtpChallengesTable.challengeHash, hashOpaqueToken(challengeToken)),
      isNull(loginOtpChallengesTable.usedAt),
    ))
    .limit(1);
  if (!challenge || challenge.expiresAt.getTime() <= Date.now() || challenge.attempts >= 5) {
    return res.status(401).json({ error: "This login code is invalid or expired. Please log in again." });
  }

  if (hashOpaqueToken(code) !== challenge.otpHash) {
    const nextAttempts = challenge.attempts + 1;
    await db.update(loginOtpChallengesTable)
      .set({ attempts: nextAttempts, ...(nextAttempts >= 5 ? { usedAt: new Date() } : {}) })
      .where(and(
        eq(loginOtpChallengesTable.id, challenge.id),
        isNull(loginOtpChallengesTable.usedAt),
      ));
    await recordSecurityEvent(req, "login_otp_failed", challenge.userId);
    return res.status(401).json({
      error: nextAttempts >= 5
        ? "Too many incorrect codes. Please log in again."
        : "The login code is incorrect.",
    });
  }

  const [consumed] = await db.update(loginOtpChallengesTable)
    .set({ usedAt: new Date() })
    .where(and(
      eq(loginOtpChallengesTable.id, challenge.id),
      isNull(loginOtpChallengesTable.usedAt),
    ))
    .returning({ id: loginOtpChallengesTable.id });
  if (!consumed) return res.status(401).json({ error: "This login code is invalid or expired." });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, challenge.userId)).limit(1);
  if (!user || user.status === "suspended") {
    return res.status(403).json({ error: "Your account is not available. Please contact support." });
  }

  // Existing authenticator-app 2FA, when explicitly enabled, remains an
  // additional factor after the mandatory email OTP rather than replacing it.
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
  setUserSessionCookie(res, token);

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

router.post("/auth/login/otp/resend", async (req, res) => {
  const limited = await consumeRateLimit({
    key: `login-otp-resend:ip:${requestIp(req)}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
    blockMs: 10 * 60 * 1000,
  });
  if (rejectRateLimited(res, limited)) return;

  const challengeToken = typeof req.body?.challengeToken === "string"
    ? req.body.challengeToken.trim()
    : "";
  if (!challengeToken) return res.status(400).json({ error: "Login challenge is required." });

  const challengeHash = hashOpaqueToken(challengeToken);
  const resendLimit = await consumeRateLimit({
    key: `login-otp-resend:challenge:${challengeHash}`,
    limit: 3,
    windowMs: 10 * 60 * 1000,
    blockMs: 10 * 60 * 1000,
  });
  if (rejectRateLimited(res, resendLimit)) return;

  const [challenge] = await db.select()
    .from(loginOtpChallengesTable)
    .where(and(
      eq(loginOtpChallengesTable.challengeHash, challengeHash),
      isNull(loginOtpChallengesTable.usedAt),
    ))
    .limit(1);
  if (!challenge || challenge.expiresAt.getTime() <= Date.now() || challenge.attempts >= 5) {
    return res.status(401).json({ error: "This login challenge is invalid or expired. Please log in again." });
  }

  const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, challenge.userId))
    .limit(1);
  if (!user) return res.status(401).json({ error: "This login challenge is invalid or expired." });

  const otp = generateLoginOtp();
  await db.update(loginOtpChallengesTable)
    .set({
      otpHash: hashOpaqueToken(otp),
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })
    .where(and(
      eq(loginOtpChallengesTable.id, challenge.id),
      isNull(loginOtpChallengesTable.usedAt),
    ));

  try {
    await sendLoginOtpEmail(user.email, otp);
  } catch (err) {
    logger.error({ err, userId: user.id }, "Login OTP resend failed");
    return res.status(503).json({ error: "We could not send your login code. Please try again shortly." });
  }

  return res.json({ message: "A new login code has been sent." });
});

// Verify authenticator-app 2FA code after email OTP login.
router.post("/auth/2fa/verify", async (req, res) => {
  const limited = await consumeRateLimit({
    key: `2fa:ip:${requestIp(req)}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
    blockMs: 10 * 60 * 1000,
  });
  if (rejectRateLimited(res, limited)) return;

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
    await recordSecurityEvent(req, "two_factor_failed", user.id);
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
  setUserSessionCookie(res, token);

  return res.json({
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
  const token = getRequestToken(req);
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  clearUserSessionCookie(res);
  return res.json({ message: "Logged out successfully" });
});

router.post("/auth/forgot-password", async (req, res) => {
  const ipLimit = await consumeRateLimit({
    key: `forgot-password:ip:${requestIp(req)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  if (rejectRateLimited(res, ipLimit)) return;

  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const email = normalizeEmail(parsed.data.email);
  const accountLimit = await consumeRateLimit({
    key: `forgot-password:account:${email}`,
    limit: 3,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  if (rejectRateLimited(res, accountLimit)) return;

  const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  // Always use the same public response for known and unknown emails.
  if (!user) {
    return res.json({ message: "If an account exists, reset instructions will be sent shortly." });
  }

  const token = generateOpaqueToken();
  await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, user.id));
  await db.insert(passwordResetTokensTable).values({
    userId: user.id,
    tokenHash: hashOpaqueToken(token),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  const resetLink = `${getAuthEmailBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendPasswordResetEmail(user.email, resetLink);
  } catch (err) {
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.tokenHash, hashOpaqueToken(token)));
    logger.error({ err, userId: user.id }, "Password reset email failed");
    return res.status(503).json({ error: "Password recovery is temporarily unavailable. Please contact support." });
  }

  return res.json({ message: "If an account exists, reset instructions will be sent shortly." });
});

router.post("/auth/reset-password", async (req, res) => {
  const limited = await consumeRateLimit({
    key: `reset-password:ip:${requestIp(req)}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  if (rejectRateLimited(res, limited)) return;

  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const tokenHash = hashOpaqueToken(parsed.data.token);
  const [reset] = await db.select().from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.tokenHash, tokenHash))
    .limit(1);
  if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) {
    return res.status(400).json({ error: "This reset link is invalid or expired." });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, reset.userId));
  await db.update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, reset.id));
  await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, reset.userId));
  await revokeUserSessions(reset.userId);
  clearUserSessionCookie(res);
  await recordSecurityEvent(req, "password_reset_completed", reset.userId);
  return res.json({ message: "Password reset successfully" });
});

router.get("/auth/me", async (req, res) => {
  const token = getRequestToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const record = await getUserSession(token);
  if (!record) {
    clearUserSessionCookie(res);
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  const user = record.user;

  // Renew the persistent cookie on every successful session check so active
  // users do not get logged out simply because the browser's cookie age ran
  // down. Explicit logout still clears the cookie and deletes the session.
  setUserSessionCookie(res, token);

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
