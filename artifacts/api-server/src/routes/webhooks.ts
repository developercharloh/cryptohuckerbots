import { Router } from "express";
import crypto from "node:crypto";
import { db, kycTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

function timingSafeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

router.post("/webhooks/didit", async (req, res) => {
  const secret = process.env["DIDIT_WEBHOOK_SECRET"];
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const signature = req.headers["x-signature"] as string | undefined;
  const timestamp = req.headers["x-timestamp"] as string | undefined;

  if (secret && rawBody && signature && timestamp) {
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > 300) {
      return res.status(400).json({ error: "Timestamp expired" });
    }
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!timingSafeEqual(expected, signature)) {
      logger.warn("Didit webhook signature mismatch");
      return res.status(401).json({ error: "Invalid signature" });
    }
  } else if (secret) {
    logger.warn("Didit webhook received without a complete signature");
    return res.status(401).json({ error: "Webhook signature required" });
  }

  const body = req.body as {
    session_id?: string;
    status?: string;
    vendor_data?: string;
    webhook_type?: string;
  };

  const { session_id, status, vendor_data } = body;

  if (!session_id || !status) {
    return res.json({ ok: true });
  }

  const [kyc] = await db
    .select({ userId: kycTable.userId, status: kycTable.status })
    .from(kycTable)
    .where(eq(kycTable.diditSessionId, session_id))
    .limit(1);

  if (!kyc) {
    logger.warn({ session_id, status }, "Didit webhook does not match a KYC session");
    return res.json({ ok: true });
  }

  // Didit verifies the submitted identity documents, but VIXUS AI retains
  // the final account decision. Never let a provider callback bypass the
  // admin review action, and never let a late callback undo that decision.
  const adminHasReviewed = kyc.status === "verified" || kyc.status === "rejected";
  if (!adminHasReviewed) {
    await db
      .update(kycTable)
      .set({ status: "pending" })
      .where(eq(kycTable.diditSessionId, session_id));

    await db
      .update(usersTable)
      .set({ kycStatus: "pending" })
      .where(eq(usersTable.id, kyc.userId));
  }

  logger.info({
    session_id,
    providerStatus: status,
    appStatus: adminHasReviewed ? kyc.status : "pending",
    awaitingAdminReview: !adminHasReviewed,
  }, "Didit webhook processed");
  return res.json({ ok: true });
});

export default router;
