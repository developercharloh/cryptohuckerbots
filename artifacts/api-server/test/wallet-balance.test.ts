import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateWalletBalance, transactionDelta } from "../src/utils/balance.ts";

test("wallet credits completed deposits and returns, including admin credits", () => {
  assert.equal(transactionDelta("deposit", 250), 250);
  assert.equal(transactionDelta("trade_profit", 75), 75);
  assert.equal(transactionDelta("trade_loss_return", 40), 40);
  assert.equal(transactionDelta("vip_package_purchase", 500), -500);

  const balance = calculateWalletBalance([
    { type: "deposit", amount: "1000.00", status: "completed" },
    { type: "deposit", amount: "250.00", status: "completed" },
    { type: "trade_profit", amount: "75.25", status: "completed" },
    { type: "withdrawal", amount: "100.00", status: "completed" },
    { type: "vip_package_purchase", amount: "500.00", status: "completed" },
    { type: "deposit", amount: "999.00", status: "pending" },
  ]);

  assert.equal(balance, 725.25);
});