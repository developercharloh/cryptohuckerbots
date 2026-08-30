import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateVaultCapital, calculateWalletBalance, transactionDelta, vaultTransactionDelta } from "../src/utils/balance.ts";

test("wallet credits completed deposits and returns, including admin credits", () => {
  assert.equal(transactionDelta("deposit", 250), 250);
  assert.equal(transactionDelta("trade_profit", 75), 75);
  assert.equal(transactionDelta("trade_loss_return", 40), 40);
  assert.equal(transactionDelta("signal_reward", 2.5), 2.5);
  assert.equal(transactionDelta("vip_package_purchase", 500), -500);

  const balance = calculateWalletBalance([
    { type: "deposit", amount: "1000.00", status: "completed" },
    { type: "deposit", amount: "250.00", status: "completed" },
    { type: "trade_profit", amount: "75.25", status: "completed" },
    { type: "signal_reward", amount: "2.50", status: "completed" },
    { type: "withdrawal", amount: "100.00", status: "completed" },
    { type: "vip_package_purchase", amount: "500.00", status: "completed" },
    { type: "deposit", amount: "999.00", status: "pending" },
  ]);

  assert.equal(balance, 727.75);
});

test("Vault Capital is separate from Main Wallet ledger movements", () => {
  assert.equal(vaultTransactionDelta("vault_trade_stake", 2.5), -2.5);
  assert.equal(vaultTransactionDelta("vault_trade_return", 2.5), 2.5);
  assert.equal(vaultTransactionDelta("vault_trade_fee", 0.25), -0.25);
  assert.equal(vaultTransactionDelta("trade_profit", 75), 0);

  const vaultCapital = calculateVaultCapital(500, [
    { type: "vault_trade_stake", amount: "2.50", status: "completed" },
    { type: "vault_trade_return", amount: "2.50", status: "completed" },
    { type: "vault_trade_fee", amount: "0.25", status: "completed" },
    { type: "trade_profit", amount: "75.00", status: "completed" },
    { type: "vault_trade_stake", amount: "40.00", status: "pending" },
    { type: "deposit", amount: "1000.00", status: "completed" },
  ]);

  assert.equal(vaultCapital, 499.75);
});