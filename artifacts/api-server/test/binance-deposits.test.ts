import assert from "node:assert/strict";
import { test } from "node:test";
import { BSC_PAYMENT_METHOD } from "../src/lib/payment-methods.ts";
import { getBscScanRange } from "../src/lib/binance-deposits.ts";

test("BSC scan resumes beyond the rolling RPC window after a polling gap", () => {
  const latestBlock = 25_000;
  const persistedNextBlock = 1_000;
  const range = getBscScanRange(persistedNextBlock, latestBlock);

  assert.ok(range);
  assert.equal(range.fromBlock, persistedNextBlock - 25);
  assert.equal(
    range.safeBlock,
    latestBlock - BSC_PAYMENT_METHOD.requiredConfirmations + 1,
  );
  assert.equal(range.nextBlock, range.safeBlock + 1);
  assert.ok(range.safeBlock > persistedNextBlock + 1_000);
});

test("BSC scan does not advance into unconfirmed blocks", () => {
  const latestBlock = 100;
  const range = getBscScanRange(1, latestBlock);

  assert.ok(range);
  assert.equal(
    range.safeBlock,
    latestBlock - BSC_PAYMENT_METHOD.requiredConfirmations + 1,
  );
  assert.ok(range.safeBlock < latestBlock);
});