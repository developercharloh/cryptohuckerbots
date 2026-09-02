const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

export const API_BASE =
  configuredApiUrl || (import.meta.env.DEV ? "" : "https://api.vixus.trade");

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const READY_WAIT_MS = 25_000;
const READY_POLL_MS = 1_000;
const READY_REQUEST_TIMEOUT_MS = 5_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  if (init.signal || typeof AbortController === "undefined") {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && (error as { name?: unknown }).name === "AbortError") {
      throw new Error("The connection timed out before the server responded. Please try again.");
    }
    const offline =
      typeof navigator !== "undefined" && navigator.onLine === false;
    throw new Error(
      offline
        ? "You appear to be offline. Check your connection and try again."
        : "Unable to reach the VIXUS API. Check your connection and try again.",
      { cause: error },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function waitForApiReady(maxWaitMs = READY_WAIT_MS): Promise<boolean> {
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
      // Retry while the serverless instance is waking up.
    }

    const waitMs = Math.min(READY_POLL_MS, Math.max(0, deadline - Date.now()));
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  return false;
}