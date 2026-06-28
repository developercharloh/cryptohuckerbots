export function formatUSD(
  amount: number | null | undefined,
  opts?: { decimals?: number }
): string {
  const value = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  const decimals = opts?.decimals ?? 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
