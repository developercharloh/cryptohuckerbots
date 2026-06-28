import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const VAPID_PUBLIC_KEY  = process.env["VAPID_PUBLIC_KEY"]  ?? "";
const VAPID_PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"] ?? "";
const VAPID_SUBJECT     = process.env["VAPID_SUBJECT"]     ?? "mailto:admin@vixus.ai";

export { VAPID_PUBLIC_KEY };

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

interface StoredSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function getAllSubscriptions(): Promise<StoredSub[]> {
  try {
    const rows = await db.execute(sql`SELECT endpoint, p256dh, auth FROM admin_push_subscriptions`);
    return (rows.rows as { endpoint: string; p256dh: string; auth: string }[]);
  } catch {
    return [];
  }
}

export async function sendPushToAllAdmins(payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  let webpush: typeof import("web-push");
  try {
    // Dynamic import defers web-push loading until first use — prevents
    // esbuild ESM/CJS interop issues from crashing the server at startup.
    webpush = (await import("web-push")).default as typeof import("web-push");
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    logger.warn({ err }, "web-push unavailable — push skipped");
    return;
  }

  const subs = await getAllSubscriptions();
  if (subs.length === 0) return;

  const message = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
        );
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          try {
            await db.execute(sql`DELETE FROM admin_push_subscriptions WHERE endpoint = ${sub.endpoint}`);
          } catch { /* ignore */ }
        } else {
          logger.warn({ err, endpoint: sub.endpoint }, "Push send failed");
        }
      }
    }),
  );
}
