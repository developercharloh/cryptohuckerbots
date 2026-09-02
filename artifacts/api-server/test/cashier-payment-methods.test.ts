import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BSC_DEPOSIT_ADDRESS,
  BSC_NETWORK,
  BSC_PAYMENT_METHOD,
  isBscWalletAddress,
  validateBscWithdrawal,
} from "../src/lib/payment-methods.ts";

test("cashier exposes one canonical USDT settlement method", () => {
  assert.deepEqual(BSC_PAYMENT_METHOD, {
    id: "usdt_bep20",
    name: "BSC BNB Smart Chain (BEP20)",
    icon: "usdt",
    type: "crypto",
    network: BSC_NETWORK,
    depositAddress: BSC_DEPOSIT_ADDRESS,
    requiredConfirmations: 15,
    processingTime: "1–3 minutes",
  });
});

test("BSC wallet validation accepts EVM addresses and both canonical method identifiers", () => {
  const address = "0x1234567890abcdef1234567890ABCDEF12345678";

  assert.equal(isBscWalletAddress(address), true);
  assert.equal(validateBscWithdrawal(BSC_PAYMENT_METHOD.id, address), null);
  assert.equal(validateBscWithdrawal(BSC_PAYMENT_METHOD.name, address), null);
});

test("BSC withdrawal validation rejects unsupported methods and malformed addresses", () => {
  const address = "0x1234567890abcdef1234567890ABCDEF12345678";

  assert.equal(
    validateBscWithdrawal("USDT (TRC-20)", address),
    "Only USDT on BNB Smart Chain (BEP-20) is supported",
  );
  assert.equal(
    validateBscWithdrawal(BSC_PAYMENT_METHOD.id, "not-a-wallet"),
    "Enter a valid BNB Smart Chain (BEP-20) wallet address",
  );
  assert.equal(isBscWalletAddress("0x1234567890abcdef1234567890abcdef1234567"), false);
  assert.equal(isBscWalletAddress("0x1234567890abcdef1234567890abcdef123456789"), false);
});