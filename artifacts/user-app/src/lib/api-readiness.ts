import { API_BASE, fetchWithTimeout } from "./api-base";

const DEFAULT_READY_WAIT_MS = 25_000;
const READY_POLL_MS = 1_000;
const READY_REQUEST_TIMEOUT_MS = 5_000;

/**
 * Vercel can return a fast 503 while the API instance finishes migrations and
 * seeds. Keep auth flows from treating that transient response as a hard
 * outage.
 */
export async function waitForApiReady(
  maxWaitMs = DEFAULT_READY_WAIT_MS,
): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    try {
      const response = await fetchWithTimeout(
        `${API_BASE}/api/readyz`,
        { credentials: "include" },
        Math.min(READY_REQUEST_TIMEOUT_MS, remaining),
      );
      if (response.ok) return true;
    } catch {
      // Retry while the serverless instance is still waking up.
    }

    const waitMs = Math.min(READY_POLL_MS, Math.max(0, deadline - Date.now()));
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  return false;
}