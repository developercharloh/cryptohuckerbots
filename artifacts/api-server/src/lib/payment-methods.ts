export const BSC_NETWORK = "BEP-20";
export const BSC_CHAIN_NAME = "BNB Smart Chain";
export const BSC_DEPOSIT_ADDRESS = "0x50Ef0c6963Bf42Fd7f9E0Ba7003e036d2E994C6B";

export const BSC_PAYMENT_METHOD = {
  id: "usdt_bep20",
  name: "BSC BNB Smart Chain (BEP20)",
  icon: "usdt",
  type: "crypto",
  network: BSC_NETWORK,
  depositAddress: BSC_DEPOSIT_ADDRESS,
  requiredConfirmations: 15,
  processingTime: "1–3 minutes",
} as const;

export const BSC_PAYMENT_METHOD_SETTINGS = {
  id: BSC_PAYMENT_METHOD.id,
  name: BSC_PAYMENT_METHOD.name,
  network: BSC_PAYMENT_METHOD.network,
  address: BSC_PAYMENT_METHOD.depositAddress,
  enabled: true,
} as const;

export function isBscWalletAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function validateBscWithdrawal(paymentMethod: string, walletAddress: string): string | null {
  if (paymentMethod !== BSC_PAYMENT_METHOD.name && paymentMethod !== BSC_PAYMENT_METHOD.id) {
    return "Only USDT on BNB Smart Chain (BEP-20) is supported";
  }
  if (!isBscWalletAddress(walletAddress)) {
    return "Enter a valid BNB Smart Chain (BEP-20) wallet address";
  }
  return null;
}