const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

export const API_BASE =
  configuredApiUrl || (import.meta.env.DEV ? "" : "https://api.vixus.trade");