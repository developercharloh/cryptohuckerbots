import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db, chatMessagesTable, usersTable } from "@workspace/db";

export const SIGNAL_TRIAL_DURATION_MS = 60 * 24 * 60 * 60 * 1000;
export const SIGNAL_TRIAL_REMINDER_LEAD_MS = 3 * 24 * 60 * 60 * 1000;

const SIGNAL_TRIAL_REMINDER_MESSAGE =
  "Your current signal access window ends in 3 days. Upgrade to VIP 2 to continue receiving signals after it ends.";

export type SignalTrialStatus = {
  active: boolean;
  expired: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  remainingMs: number;
};

export function getSignalTrialStatus(
  user: Pick<typeof usersTable.$inferSelect, "signalTrialStartedAt" | "signalTrialEndsAt">,
  now = Date.now(),
): SignalTrialStatus {
  const startsAt = user.signalTrialStartedAt ?? null;
  const endsAt = user.signalTrialEndsAt ?? null;
  if (!startsAt || !endsAt) {
    return { active: false, expired: false, startsAt: null, endsAt: null, remainingMs: 0 };
  }

  const remainingMs = Math.max(0, endsAt.getTime() - now);
  return {
    active: remainingMs > 0,
    expired: remainingMs === 0,
    startsAt,
    endsAt,
    remainingMs,
  };
}

export async function ensureSignalTrialReminder(userId: number, now = Date.now()): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);
    const [user] = await tx.select({
      signalTrialStartedAt: usersTable.signalTrialStartedAt,
      signalTrialEndsAt: usersTable.signalTrialEndsAt,
      signalTrialReminderSentAt: usersTable.signalTrialReminderSentAt,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (
      !user?.signalTrialStartedAt ||
      !user.signalTrialEndsAt ||
      user.signalTrialReminderSentAt ||
      now < user.signalTrialEndsAt.getTime() - SIGNAL_TRIAL_REMINDER_LEAD_MS ||
      now >= user.signalTrialEndsAt.getTime()
    ) {
      return false;
    }

    await tx.insert(chatMessagesTable).values({
      userId,
      sender: "admin",
      message: SIGNAL_TRIAL_REMINDER_MESSAGE,
    });
    await tx.update(usersTable)
      .set({ signalTrialReminderSentAt: new Date(now), updatedAt: new Date(now) })
      .where(and(
        eq(usersTable.id, userId),
        isNull(usersTable.signalTrialReminderSentAt),
      ));
    return true;
  });
}

/**
 * Serverless-safe sweep for due reminders. It is called from authenticated
 * signal reads and the admin user workspace; the per-user advisory lock makes
 * concurrent invocations idempotent.
 */
export async function ensureDueSignalTrialReminders(now = Date.now()): Promise<number> {
  const dueUsers = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(and(
      isNull(usersTable.signalTrialReminderSentAt),
      lte(usersTable.signalTrialEndsAt, new Date(now + SIGNAL_TRIAL_REMINDER_LEAD_MS)),
      gte(usersTable.signalTrialEndsAt, new Date(now)),
    ));

  let sent = 0;
  for (const user of dueUsers) {
    if (await ensureSignalTrialReminder(user.id, now)) sent++;
  }
  return sent;
}