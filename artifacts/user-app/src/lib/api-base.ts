const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

export const API_BASE =
  configuredApiUrl || (import.meta.env.DEV ? "" : "https://api.vixus.trade");

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: unknown }).name === "AbortError",
  );
}

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
    if (isAbortError(error)) {
      throw new Error("Please try again in a moment.");
    }
    const offline =
      typeof navigator !== "undefined" && navigator.onLine === false;
    throw new Error("Please try again in a moment.", { cause: error });
  } finally {
    clearTimeout(timeoutId);
  }
}