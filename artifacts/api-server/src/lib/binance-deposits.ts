import {
  binanceDepositEventsTable,
  db,
  depositSessionsTable,
  transactionsTable,
} from "@workspace/db";
import { and, eq, gte, isNull, lte, inArray } from "drizzle-orm";
import { BSC_DEPOSIT_ADDRESS, BSC_PAYMENT_METHOD } from "./payment-methods";

const BSC_RPC_URL = process.env.BSC_RPC_URL?.trim() || "https://bsc.publicnode.com";
const USDT_BSC_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BSC_SCAN_BLOCK_WINDOW = 1_000;
const SESSION_EXPIRY_GRACE_MS = 2 * 60 * 60 * 1000;
const SYNC_THROTTLE_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;

type RpcResponse<T> = {
  result?: T;
  error?: { code?: number; message?: string };
};

type BscTransferLog = {
  topics?: string[];
  data?: string;
  blockNumber?: string;
  transactionHash?: string;
};

type ChainDeposit = {
  amount?: string;
  coin?: string;
  network?: string;
  status?: number;
  address?: string;
  txId?: string;
  insertTime?: number;
  confirmTimes?: string;
};

let lastSyncAt = 0;
let syncPromise: Promise<void> | null = null;

async function bscRpc<T>(method: string, params: unknown[]): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(BSC_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`BSC RPC request failed (${response.status}): ${body.slice(0, 240)}`);
    }
    const payload = await response.json() as RpcResponse<T>;
    if (payload.error) {
      throw new Error(`BSC RPC ${method} failed: ${payload.error.message ?? "unknown error"}`);
    }
    if (payload.result === undefined) throw new Error(`BSC RPC ${method} returned no result`);
    return payload.result;
  } finally {
    clearTimeout(timeout);
  }
}

function formatUnits(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

async function fetchBscDeposits(): Promise<ChainDeposit[]> {
  const latestHex = await bscRpc<string>("eth_blockNumber", []);
  const latestBlock = Number.parseInt(latestHex, 16);
  if (!Number.isFinite(latestBlock)) throw new Error("BSC RPC returned an invalid block number");

  const fromBlock = Math.max(0, latestBlock - BSC_SCAN_BLOCK_WINDOW);
  const recipientTopic = `0x${BSC_DEPOSIT_ADDRESS.slice(2).toLowerCase().padStart(64, "0")}`;
  const logs = await bscRpc<BscTransferLog[]>("eth_getLogs", [{
    address: USDT_BSC_CONTRACT,
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock: latestHex,
    topics: [TRANSFER_EVENT_TOPIC, null, recipientTopic],
  }]);

  const timestamps = new Map<string, number>();
  for (const log of logs) {
    if (!log.blockNumber || timestamps.has(log.blockNumber)) continue;
    const block = await bscRpc<{ timestamp?: string }>("eth_getBlockByNumber", [log.blockNumber, false]);
    const timestamp = block.timestamp ? Number.parseInt(block.timestamp, 16) * 1000 : NaN;
    if (Number.isFinite(timestamp)) timestamps.set(log.blockNumber, timestamp);
  }

  return logs.map((log) => {
    const blockNumber = Number.parseInt(log.blockNumber ?? "0x0", 16);
    const confirmations = Math.max(0, latestBlock - blockNumber + 1);
    const rawAmount = BigInt(log.data ?? "0x0");
    return {
      amount: formatUnits(rawAmount, 18),
      coin: "USDT",
      network: "BSC",
      status: confirmations >= BSC_PAYMENT_METHOD.requiredConfirmations ? 1 : 0,
      address: BSC_DEPOSIT_ADDRESS,
      txId: log.transactionHash,
      insertTime: timestamps.get(log.blockNumber ?? "") ?? Date.now(),
      confirmTimes: `${confirmations}/${BSC_PAYMENT_METHOD.requiredConfirmations}`,
    };
  });
}

function isUsdtBscDeposit(item: ChainDeposit): boolean {
  return item.coin === "USDT"
    && item.network === "BSC"
    && (item.status === 0 || item.status === 1)
    && typeof item.amount === "string"
    && Number.isFinite(Number(item.amount))
    && Number(item.amount) > 0
    && typeof item.address === "string"
    && item.address.toLowerCase() === BSC_DEPOSIT_ADDRESS.toLowerCase()
    && typeof item.txId === "string"
    && /^0x[a-fA-F0-9]{64}$/.test(item.txId)
    && typeof item.insertTime === "number"
    && Number.isFinite(item.insertTime);
}

async function recordBinanceDeposit(item: ChainDeposit) {
  if (!isUsdtBscDeposit(item)) return null;

  const [event] = await db.insert(binanceDepositEventsTable).values({
    txid: item.txId!,
    amount: item.amount!,
    coin: item.coin!,
    network: item.network!,
    address: item.address!,
    status: item.status!,
    confirmTimes: item.confirmTimes ?? null,
    insertTime: new Date(item.insertTime!),
    state: "unmatched",
  }).onConflictDoUpdate({
    target: binanceDepositEventsTable.txid,
    set: {
      amount: item.amount!,
      status: item.status!,
      confirmTimes: item.confirmTimes ?? null,
      updatedAt: new Date(),
    },
  }).returning();

  return event;
}

async function classifyAndCreditEvent(eventId: number): Promise<void> {
  const [event] = await db.select().from(binanceDepositEventsTable)
    .where(eq(binanceDepositEventsTable.id, eventId))
    .limit(1);
  if (!event || event.state === "credited") return;

  const graceStart = new Date(event.insertTime.getTime() - SESSION_EXPIRY_GRACE_MS);
  const candidates = await db.select().from(depositSessionsTable)
    .where(and(
      isNull(depositSessionsTable.txid),
      inArray(depositSessionsTable.status, ["created", "waiting_payment", "payment_detected", "confirming"]),
      eq(depositSessionsTable.amount, event.amount),
      lte(depositSessionsTable.createdAt, event.insertTime),
      gte(depositSessionsTable.expiresAt, graceStart),
    ));

  if (candidates.length !== 1) {
    await db.update(binanceDepositEventsTable)
      .set({
        state: candidates.length > 1 ? "ambiguous" : "unmatched",
        updatedAt: new Date(),
      })
      .where(eq(binanceDepositEventsTable.id, event.id));
    return;
  }

  const candidate = candidates[0];
  await db.transaction(async (tx) => {
    const [lockedSession] = await tx.select().from(depositSessionsTable)
      .where(eq(depositSessionsTable.id, candidate.id))
      .for("update")
      .limit(1);
    if (!lockedSession || lockedSession.txid || lockedSession.status === "completed") {
      await tx.update(binanceDepositEventsTable)
        .set({ state: "credited", matchedSessionId: candidate.id, updatedAt: new Date() })
        .where(eq(binanceDepositEventsTable.id, event.id));
      return;
    }

    const [existingSessionTxid, existingTransactionTxid] = await Promise.all([
      tx.select({ id: depositSessionsTable.id }).from(depositSessionsTable)
        .where(eq(depositSessionsTable.txid, event.txid)).limit(1),
      tx.select({ id: transactionsTable.id }).from(transactionsTable)
        .where(eq(transactionsTable.txid, event.txid)).limit(1),
    ]);
    if (existingSessionTxid[0] || existingTransactionTxid[0]) {
      await tx.update(binanceDepositEventsTable)
        .set({ state: "credited", matchedSessionId: candidate.id, updatedAt: new Date() })
        .where(eq(binanceDepositEventsTable.id, event.id));
      return;
    }

    const [transaction] = await tx.insert(transactionsTable).values({
      userId: lockedSession.userId,
      type: "deposit",
      amount: lockedSession.amount,
      status: "completed",
      paymentMethod: lockedSession.paymentMethodName,
      walletAddress: lockedSession.depositAddress,
      txid: event.txid,
      description: `Automatically confirmed Binance deposit via ${lockedSession.paymentMethodName}`,
      cryptoAmount: event.amount,
      cryptoAsset: event.coin,
    }).returning();

    await tx.update(depositSessionsTable)
      .set({
        txid: event.txid,
        status: "completed",
        confirmations: lockedSession.requiredConfirmations,
        transactionId: transaction.id,
        cryptoAmount: event.amount,
        cryptoAsset: event.coin,
        updatedAt: new Date(),
      })
      .where(eq(depositSessionsTable.id, lockedSession.id));

    await tx.update(binanceDepositEventsTable)
      .set({
        state: "credited",
        matchedSessionId: lockedSession.id,
        updatedAt: new Date(),
      })
      .where(eq(binanceDepositEventsTable.id, event.id));
  });
}

async function runBinanceDepositSync(): Promise<void> {
  const deposits = await fetchBscDeposits();
  for (const deposit of deposits) {
    const event = await recordBinanceDeposit(deposit);
    if (event && event.status === 1 && event.state !== "credited") {
      await classifyAndCreditEvent(event.id);
    }
  }
}

/**
 * Binance is polled lazily from user/admin reads because the API server also
 * runs as a serverless handler. The database event ledger makes retries safe.
 */
export async function syncBinanceDeposits(): Promise<void> {
  if (process.env.NODE_ENV === "test") return;

  const now = Date.now();
  if (now - lastSyncAt < SYNC_THROTTLE_MS) return;
  if (syncPromise) return syncPromise;

  lastSyncAt = now;
  syncPromise = runBinanceDepositSync().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}