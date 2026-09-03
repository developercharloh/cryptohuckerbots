import { usersTable } from "@workspace/db";

export const SIGNAL_PAIR_ALLOWANCE = 60;

export type SignalTrialStatus = {
  active: boolean;
  expired: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  remainingMs: number;
};

export function getSignalTrialStatus(
  user: Pick<typeof usersTable.$inferSelect, "signalAccessStartedAt" | "signalPairsRemaining">,
): SignalTrialStatus {
  const startsAt = user.signalAccessStartedAt ?? null;
  const remaining = user.signalPairsRemaining ?? 0;
  if (!startsAt || user.signalPairsRemaining === null) {
    return { active: false, expired: false, startsAt: null, endsAt: null, remainingMs: 0 };
  }

  return {
    active: remaining > 0,
    expired: remaining <= 0,
    startsAt,
    endsAt: null,
    remainingMs: 0,
  };
}

/**
 * Kept as a compatibility export for older route imports. Signal access is
 * usage-based now, so there is no calendar reminder to send.
 */
export async function ensureSignalTrialReminder(_userId: number): Promise<boolean> {
  return false;
}

export async function ensureDueSignalTrialReminders(): Promise<number> {
  return 0;
}