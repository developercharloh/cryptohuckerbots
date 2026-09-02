import { Router } from "express";
import { db, usersTable, sessionsTable, kycTable, notificationSettingsTable, userProfilesTable, referralsTable, vipPackagePurchasesTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import {
  UpdateProfileBody,
  ChangePasswordBody,
  Toggle2FABody,
  SubmitKYCBody,
  UpdateNotificationSettingsBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { clearUserSessionCookie, getUserSession, revokeUserSessions } from "../lib/session";
import { hashPassword, verifyPassword } from "../lib/password";
import { consumeRateLimit, rejectRateLimited, requestIp, recordSecurityEvent } from "../lib/security";

const router = Router();

async function getUserFromToken(token: string | undefined) {
  const record = await getUserSession(token);
  return record ?? { user: null, session: null };
}

router.get("/profile", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const profiles = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, user.id)).limit(1);
  const profile = profiles[0];

  return res.json({
    id: user.id,
    accountUid: user.accountUid,
    fullName: user.fullName,
    email: user.email,
    phone: profile?.phone ?? null,
    country: profile?.country ?? null,
    avatarUrl: user.avatarUrl,
    kycStatus: user.kycStatus,
    twoFAEnabled: user.twoFAEnabled,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/profile/referrals", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const rows = await db
    .select({
      referral: referralsTable,
      referred: usersTable,
      profile: userProfilesTable,
    })
    .from(referralsTable)
    .innerJoin(usersTable, eq(referralsTable.referredUserId, usersTable.id))
    .leftJoin(userProfilesTable, eq(referralsTable.referredUserId, userProfilesTable.userId))
    .where(eq(referralsTable.referrerUserId, user.id))
    .orderBy(desc(referralsTable.createdAt));

  const referredUserIds = rows.map(({ referred }) => referred.id);
  const vipPurchases = referredUserIds.length > 0
    ? await db.select({
        userId: vipPackagePurchasesTable.userId,
        vipLevel: vipPackagePurchasesTable.vipLevel,
      })
        .from(vipPackagePurchasesTable)
        .where(and(
          inArray(vipPackagePurchasesTable.userId, referredUserIds),
          eq(vipPackagePurchasesTable.status, "completed"),
        ))
        .orderBy(desc(vipPackagePurchasesTable.vipLevel))
    : [];
  const vipLevelByUser = new Map<number, number>();
  for (const purchase of vipPurchases) {
    if (!vipLevelByUser.has(purchase.userId)) vipLevelByUser.set(purchase.userId, purchase.vipLevel);
  }

  const referrals = rows.map(({ referral, referred, profile }) => {
    const currentVipLevel = vipLevelByUser.get(referred.id) ?? 0;
    const activityStatus = currentVipLevel >= 1 ? "active" : "inactive";
    const isQualified = activityStatus === "active" && referral.status === "credited";

    return {
      currentVipLevel,
      activityStatus,
      id: referral.id,
      referredName: referred.fullName,
      referredAccountUid: referred.accountUid,
      referredEmail: referred.email,
      referredPhone: profile?.phone ?? null,
      referredCountry: profile?.country ?? null,
      status: referral.status,
      bonusAmount: isQualified ? Number(referral.bonusAmount) : 0,
      createdAt: referral.createdAt.toISOString(),
      creditedAt: referral.creditedAt?.toISOString() ?? null,
    };
  });

  const qualifiedReferrals = referrals.filter((referral) => referral.activityStatus === "active" && referral.status === "credited");

  return res.json({
    referralCode: user.accountUid,
    totalEarned: qualifiedReferrals.reduce((total, referral) => total + referral.bonusAmount, 0),
    pendingCount: referrals.filter((referral) => referral.status === "pending").length,
    referrals,
  });
});

router.patch("/profile", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { fullName, phone, country } = parsed.data;

  if (fullName) {
    await db.update(usersTable).set({ fullName, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
  }

  // Upsert user profile
  const existing = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, user.id)).limit(1);
  if (existing.length === 0) {
    await db.insert(userProfilesTable).values({ userId: user.id, phone: phone ?? null, country: country ?? null });
  } else {
    await db.update(userProfilesTable).set({ phone: phone ?? existing[0].phone, country: country ?? existing[0].country })
      .where(eq(userProfilesTable.userId, user.id));
  }

  const profiles = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, user.id)).limit(1);
  const updatedUser = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);

  return res.json({
    id: updatedUser[0].id,
    fullName: updatedUser[0].fullName,
    email: updatedUser[0].email,
    phone: profiles[0]?.phone ?? null,
    country: profiles[0]?.country ?? null,
    avatarUrl: updatedUser[0].avatarUrl,
    kycStatus: updatedUser[0].kycStatus,
    twoFAEnabled: updatedUser[0].twoFAEnabled,
    createdAt: updatedUser[0].createdAt.toISOString(),
  });
});

router.post("/profile/change-password", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { currentPassword, newPassword } = parsed.data;
  const currentPasswordVerification = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentPasswordVerification.valid) {
    return res.status(400).json({ error: "Current password is incorrect" });
  }

  await db.update(usersTable).set({
    passwordHash: await hashPassword(newPassword),
    updatedAt: new Date(),
  }).where(eq(usersTable.id, user.id));

  await revokeUserSessions(user.id);
  clearUserSessionCookie(res);
  await recordSecurityEvent(req, "password_changed", user.id);

  return res.json({ message: "Password changed successfully. Please sign in again." });
});

router.get("/profile/2fa", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  return res.json({ enabled: user.twoFAEnabled });
});

// Generate secret + QR code (does NOT enable yet — user must verify first)
router.post("/profile/2fa/setup", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: "VIXUS", label: user.email, secret });
  const qrCode = await QRCode.toDataURL(otpauthUrl);

  // Save secret to DB (not enabled yet)
  await db.update(usersTable).set({ twoFASecret: secret, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  return res.json({ secret, qrCode });
});

// Verify code and activate 2FA
router.post("/profile/2fa/enable", async (req, res) => {
  const limited = await consumeRateLimit({
    key: `2fa-enable:ip:${requestIp(req)}`,
    limit: 6,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });
  if (rejectRateLimited(res, limited)) return;

  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code is required" });
  if (!user.twoFASecret) return res.status(400).json({ error: "Run setup first" });

  const isValid = verifySync({ token: code, secret: user.twoFASecret }).valid;
  if (!isValid) return res.status(400).json({ error: "Invalid code. Check your authenticator app." });

  await db.update(usersTable).set({ twoFAEnabled: true, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  return res.json({ enabled: true });
});

// Verify current code and disable 2FA
router.post("/profile/2fa/disable", async (req, res) => {
  const limited = await consumeRateLimit({
    key: `2fa-disable:ip:${requestIp(req)}`,
    limit: 6,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });
  if (rejectRateLimited(res, limited)) return;

  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code is required" });
  if (!user.twoFASecret) return res.status(400).json({ error: "2FA is not configured" });

  const isValid = verifySync({ token: code, secret: user.twoFASecret }).valid;
  if (!isValid) return res.status(400).json({ error: "Invalid code. 2FA was not disabled." });

  await db.update(usersTable).set({ twoFAEnabled: false, twoFASecret: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  return res.json({ enabled: false });
});

router.get("/profile/kyc", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const { user } = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const kycs = await db.select().from(kycTable).where(eq(kycTable.userId, user.id)).limit(1);
    const kyc = kycs[0];

    return res.json({
      status: kyc?.status ?? "not_submitted",
      submittedAt: kyc?.submittedAt?.toISOString() ?? null,
      reviewedAt: kyc?.reviewedAt?.toISOString() ?? null,
      rejectionReason: kyc?.rejectionReason ?? null,
    });
  } catch (err: any) {
    const cause = err?.cause?.message ?? err?.cause ?? "";
    logger.error({ errMsg: err?.message, cause }, "GET /profile/kyc error");
    return res.status(500).json({ error: "Failed to fetch KYC status", detail: err?.message, cause });
  }
});

router.post("/profile/kyc/session", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { firstName, lastName, country, documentType } = req.body as {
    firstName: string; lastName: string; country: string; documentType: string;
  };
  if (!firstName || !lastName || !country || !documentType) {
    return res.status(400).json({ error: "firstName, lastName, country and documentType are required" });
  }

  const apiKey = process.env["DIDIT_API_KEY"];
  const workflowId = process.env["DIDIT_WORKFLOW_ID"];
  const callbackUrl = process.env["DIDIT_CALLBACK_URL"];

  if (!apiKey || !workflowId) {
    return res.status(503).json({ error: "KYC verification service not configured. Set DIDIT_API_KEY and DIDIT_WORKFLOW_ID." });
  }
  if (!callbackUrl) {
    return res.status(503).json({ error: "KYC verification service not configured. Set DIDIT_CALLBACK_URL to the published user app's /profile/kyc page." });
  }

  try {
    // Save personal details to profile
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    await db.update(usersTable).set({ fullName, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    const existingProfile = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, user.id)).limit(1);
    if (existingProfile.length === 0) {
      await db.insert(userProfilesTable).values({ userId: user.id, country });
    } else {
      await db.update(userProfilesTable).set({ country }).where(eq(userProfilesTable.userId, user.id));
    }

    // Create Didit session
    const response = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ workflow_id: workflowId, callback: callbackUrl, vendor_data: String(user.id) }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error({ status: response.status, errText }, "Didit session creation failed");
      return res.status(502).json({ error: "Failed to create verification session", detail: errText });
    }

    const data = await response.json() as { session_id: string; url: string };

    // Persist session + document type
    const existingKyc = await db.select().from(kycTable).where(eq(kycTable.userId, user.id)).limit(1);
    if (existingKyc.length > 0) {
      await db.update(kycTable)
        .set({ diditSessionId: data.session_id, documentType, status: "pending", submittedAt: new Date() })
        .where(eq(kycTable.userId, user.id));
    } else {
      await db.insert(kycTable).values({ userId: user.id, documentType, status: "pending", submittedAt: new Date(), diditSessionId: data.session_id });
    }
    await db.update(usersTable).set({ kycStatus: "pending" }).where(eq(usersTable.id, user.id));

    return res.json({ url: data.url, sessionId: data.session_id });
  } catch (err: any) {
    const cause = err?.cause?.message ?? err?.cause ?? "";
    logger.error({ errMsg: err?.message, cause, stack: err?.stack }, "Didit session error");
    return res.status(500).json({ error: "Internal error creating KYC session", detail: err?.message ?? String(err), cause });
  }
});

router.post("/profile/kyc", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const parsed = SubmitKYCBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { documentType, documentFrontUrl, selfieUrl, proofOfAddressUrl } = parsed.data;

  const existing = await db.select().from(kycTable).where(eq(kycTable.userId, user.id)).limit(1);
  if (existing.length > 0) {
    await db.update(kycTable).set({
      status: "pending",
      documentType,
      documentFrontUrl,
      selfieUrl,
      proofOfAddressUrl: proofOfAddressUrl ?? null,
      submittedAt: new Date(),
    }).where(eq(kycTable.userId, user.id));
  } else {
    await db.insert(kycTable).values({
      userId: user.id,
      status: "pending",
      documentType,
      documentFrontUrl,
      selfieUrl,
      proofOfAddressUrl: proofOfAddressUrl ?? null,
      submittedAt: new Date(),
    });
  }

  await db.update(usersTable).set({ kycStatus: "pending", updatedAt: new Date() }).where(eq(usersTable.id, user.id));

  return res.json({
    status: "pending",
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    rejectionReason: null,
  });
});

router.get("/profile/notification-settings", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const settings = await db.select().from(notificationSettingsTable).where(eq(notificationSettingsTable.userId, user.id)).limit(1);
  const s = settings[0];

  if (!s) {
    return res.json({ emailNotifications: true, botAlerts: true, depositWithdrawal: true, promotions: false });
  }

  return res.json({
    emailNotifications: s.emailNotifications,
    botAlerts: s.botAlerts,
    depositWithdrawal: s.depositWithdrawal,
    promotions: s.promotions,
  });
});

router.patch("/profile/notification-settings", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const parsed = UpdateNotificationSettingsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const existing = await db.select().from(notificationSettingsTable).where(eq(notificationSettingsTable.userId, user.id)).limit(1);
  if (existing.length === 0) {
    await db.insert(notificationSettingsTable).values({ userId: user.id, ...parsed.data });
  } else {
    await db.update(notificationSettingsTable).set(parsed.data).where(eq(notificationSettingsTable.userId, user.id));
  }

  const updated = await db.select().from(notificationSettingsTable).where(eq(notificationSettingsTable.userId, user.id)).limit(1);
  const s = updated[0];

  return res.json({
    emailNotifications: s.emailNotifications,
    botAlerts: s.botAlerts,
    depositWithdrawal: s.depositWithdrawal,
    promotions: s.promotions,
  });
});

router.get("/profile/sessions", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user, session } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.userId, user.id));

  return res.json(sessions.map(s => ({
    id: s.id,
    device: s.device,
    ip: s.ip,
    location: s.location ?? null,
    lastActive: s.lastActive.toISOString(),
    isCurrent: s.token === token,
  })));
});

router.delete("/profile/sessions/:id", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { user } = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const deleted = await db.delete(sessionsTable)
    .where(and(eq(sessionsTable.id, id), eq(sessionsTable.userId, user.id)))
    .returning({ id: sessionsTable.id });
  if (deleted.length === 0) return res.status(404).json({ error: "Session not found" });

  return res.json({ message: "Session revoked" });
});

export default router;
