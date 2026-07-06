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

function diditStatusToKycStatus(status: string): "pending" | "verified" | "rejected" {
  switch (status) {
    case "Approved": return "verified";
    case "Declined": return "rejected";
    default: return "pending";
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
    logger.warn("Didit webhook received without signature — verify DIDIT_WEBHOOK_SECRET is set in both Render and Didit console");
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

  const kycStatus = diditStatusToKycStatus(status);
  const isTerminal = status === "Approved" || status === "Declined";

  await db
    .update(kycTable)
    .set({
      status: kycStatus,
      reviewedAt: isTerminal ? new Date() : undefined,
    })
    .where(eq(kycTable.diditSessionId, session_id));

  if (vendor_data) {
    const userId = parseInt(vendor_data, 10);
    if (!Number.isNaN(userId)) {
      await db
        .update(usersTable)
        .set({ kycStatus })
        .where(eq(usersTable.id, userId));
    }
  }

  logger.info({ session_id, status, kycStatus }, "Didit webhook processed");
  return res.json({ ok: true });
});

export default router;
