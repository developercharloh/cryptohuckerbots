import {
  bscDepositScanStateTable,
  binanceDepositEventsTable,
  db,
  depositSessionsTable,
} from "@workspace/db";
import { and, eq, gte, isNull, lte, inArray, desc } from "drizzle-orm";
import { BSC_DEPOSIT_ADDRESS, BSC_PAYMENT_METHOD } from "./payment-methods";

const BSC_RPC_URL = process.env.BSC_RPC_URL?.trim() || "https://bsc.publicnode.com";
const USDT_BSC_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BSC_RPC_LOG_CHUNK = 1_000;
const BSC_SCAN_INITIAL_LOOKBACK = 10_000;
const BSC_SCAN_OVERLAP = 25;
const BSC_SCAN_STATE_ID = "usdt-bsc-deposits";
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

export type { ChainDeposit };

type DepositScanBatch = {
  deposits: ChainDeposit[];
  cursor: number;
  nextBlock: number;
};

export type UserDepositTxidResult = {
  outcome: "not_matched" | "matching" | "matched";
  sessionId: number | null;
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

async function getScanCursor(safeBlock: number): Promise<number> {
  const initialNextBlock = Math.max(0, safeBlock - BSC_SCAN_INITIAL_LOOKBACK + 1);
  await db.insert(bscDepositScanStateTable).values({
    id: BSC_SCAN_STATE_ID,
    nextBlock: initialNextBlock,
  }).onConflictDoNothing();

  const [state] = await db.select({ nextBlock: bscDepositScanStateTable.nextBlock })
    .from(bscDepositScanStateTable)
    .where(eq(bscDepositScanStateTable.id, BSC_SCAN_STATE_ID))
    .limit(1);
  return state?.nextBlock ?? initialNextBlock;
}

async function advanceScanCursor(cursor: number, nextBlock: number): Promise<void> {
  await db.update(bscDepositScanStateTable)
    .set({ nextBlock, updatedAt: new Date() })
    .where(and(
      eq(bscDepositScanStateTable.id, BSC_SCAN_STATE_ID),
      eq(bscDepositScanStateTable.nextBlock, cursor),
    ));
}

export function getBscScanRange(cursor: number, latestBlock: number): {
  fromBlock: number;
  safeBlock: number;
  nextBlock: number;
} | null {
  const safeBlock = latestBlock - BSC_PAYMENT_METHOD.requiredConfirmations + 1;
  if (safeBlock < 0) return null;
  const fromBlock = Math.max(0, cursor - BSC_SCAN_OVERLAP);
  return {
    fromBlock,
    safeBlock,
    nextBlock: safeBlock + 1,
  };
}

async function fetchBscDeposits(): Promise<DepositScanBatch> {
  const latestHex = await bscRpc<string>("eth_blockNumber", []);
  const latestBlock = Number.parseInt(latestHex, 16);
  if (!Number.isFinite(latestBlock)) throw new Error("BSC RPC returned an invalid block number");

  // Only scan blocks that are old enough to satisfy the confirmation policy.
  // This means a successful cursor advance never leaves an unconfirmed event
  // stranded outside the next scan range.
  const safeRange = getBscScanRange(0, latestBlock);
  if (!safeRange) return { deposits: [], cursor: 0, nextBlock: 0 };

  const cursor = await getScanCursor(safeRange.safeBlock);
  const range = getBscScanRange(cursor, latestBlock);
  if (!range || range.fromBlock > range.safeBlock) {
    return { deposits: [], cursor, nextBlock: cursor };
  }
  const { fromBlock, safeBlock } = range;

  const recipientTopic = `0x${BSC_DEPOSIT_ADDRESS.slice(2).toLowerCase().padStart(64, "0")}`;
  const logs: BscTransferLog[] = [];
  for (let chunkStart = fromBlock; chunkStart <= safeBlock; chunkStart += BSC_RPC_LOG_CHUNK) {
    const chunkEnd = Math.min(safeBlock, chunkStart + BSC_RPC_LOG_CHUNK - 1);
    const chunkLogs = await bscRpc<BscTransferLog[]>("eth_getLogs", [{
      address: USDT_BSC_CONTRACT,
      fromBlock: `0x${chunkStart.toString(16)}`,
      toBlock: `0x${chunkEnd.toString(16)}`,
      topics: [TRANSFER_EVENT_TOPIC, null, recipientTopic],
    }]);
    logs.push(...chunkLogs);
  }

  const timestamps = new Map<string, number>();
  for (const log of logs) {
    if (!log.blockNumber || timestamps.has(log.blockNumber)) continue;
    const block = await bscRpc<{ timestamp?: string }>("eth_getBlockByNumber", [log.blockNumber, false]);
    const timestamp = block.timestamp ? Number.parseInt(block.timestamp, 16) * 1000 : NaN;
    if (Number.isFinite(timestamp)) timestamps.set(log.blockNumber, timestamp);
  }

  const deposits = logs.map((log) => {
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

  return {
    deposits,
    cursor,
    nextBlock: range.nextBlock,
  };
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

async function classifyAndPrepareEvent(eventId: number): Promise<void> {
  const [event] = await db.select().from(binanceDepositEventsTable)
    .where(eq(binanceDepositEventsTable.id, eventId))
    .limit(1);
  if (!event || event.state === "credited" || event.state === "pending_approval") return;

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
    if (!lockedSession || lockedSession.status === "completed") {
      await tx.update(binanceDepositEventsTable)
        .set({ state: "credited", matchedSessionId: candidate.id, updatedAt: new Date() })
        .where(eq(binanceDepositEventsTable.id, event.id));
      return;
    }

    if (lockedSession.txid && lockedSession.txid !== event.txid) {
      await tx.update(binanceDepositEventsTable)
        .set({ state: "ambiguous", updatedAt: new Date() })
        .where(eq(binanceDepositEventsTable.id, event.id));
      return;
    }

    await tx.update(depositSessionsTable)
      .set({
        txid: event.txid,
        status: "payment_detected",
        confirmations: lockedSession.requiredConfirmations,
        cryptoAmount: event.amount,
        cryptoAsset: event.coin,
        updatedAt: new Date(),
      })
      .where(eq(depositSessionsTable.id, lockedSession.id));

    await tx.update(binanceDepositEventsTable)
      .set({
        state: "pending_approval",
        matchedSessionId: lockedSession.id,
        updatedAt: new Date(),
      })
      .where(eq(binanceDepositEventsTable.id, event.id));
  });
}

async function linkEventToSubmittedSession(eventId: number): Promise<UserDepositTxidResult | null> {
  const [event] = await db.select().from(binanceDepositEventsTable)
    .where(eq(binanceDepositEventsTable.id, eventId))
    .limit(1);
  if (!event) return null;

  const [session] = await db.select().from(depositSessionsTable)
    .where(eq(depositSessionsTable.txid, event.txid))
    .limit(1);
  if (!session) return null;

  if (
    Number(event.amount) !== Number(session.amount)
    || event.coin !== "USDT"
    || event.network !== "BSC"
    || event.address.toLowerCase() !== session.depositAddress.toLowerCase()
  ) {
    await db.update(binanceDepositEventsTable)
      .set({ state: "ambiguous", updatedAt: new Date() })
      .where(eq(binanceDepositEventsTable.id, event.id));
    return { outcome: "not_matched", sessionId: session.id };
  }

  const state = event.status === 1 ? "pending_approval" : "matching";
  await db.update(binanceDepositEventsTable)
    .set({
      state,
      matchedSessionId: session.id,
      updatedAt: new Date(),
    })
    .where(eq(binanceDepositEventsTable.id, event.id));
  return {
    outcome: event.status === 1 ? "matched" : "matching",
    sessionId: session.id,
  };
}

export async function submitUserDepositTxid(
  userId: number,
  txid: string,
): Promise<UserDepositTxidResult> {
  const [session] = await db.select().from(depositSessionsTable)
    .where(and(
      eq(depositSessionsTable.userId, userId),
      isNull(depositSessionsTable.txid),
      inArray(depositSessionsTable.status, ["created", "waiting_payment", "payment_detected", "confirming"]),
    ))
    .orderBy(desc(depositSessionsTable.createdAt))
    .limit(1);
  if (!session) return { outcome: "not_matched", sessionId: null };

  const [existingEvent] = await db.select().from(binanceDepositEventsTable)
    .where(eq(binanceDepositEventsTable.txid, txid))
    .limit(1);
  const [existingSessionForTxid] = await db.select({ id: depositSessionsTable.id })
    .from(depositSessionsTable)
    .where(eq(depositSessionsTable.txid, txid))
    .limit(1);
  if (existingSessionForTxid && existingSessionForTxid.id !== session.id) {
    return { outcome: "not_matched", sessionId: session.id };
  }

  const createdPlaceholder = !existingEvent;
  if (!existingEvent) {
    await db.insert(binanceDepositEventsTable).values({
      txid,
      amount: session.amount,
      coin: "USDT",
      network: "BSC",
      address: session.depositAddress,
      status: 0,
      confirmTimes: null,
      insertTime: new Date(),
      state: "unmatched",
      matchedSessionId: null,
    }).onConflictDoNothing();
  }

  await db.update(depositSessionsTable)
    .set({
      txid,
      status: "payment_detected",
      updatedAt: new Date(),
    })
    .where(eq(depositSessionsTable.id, session.id));

  const [event] = await db.select().from(binanceDepositEventsTable)
    .where(eq(binanceDepositEventsTable.txid, txid))
    .limit(1);
  if (!event) return { outcome: "not_matched", sessionId: session.id };
  if (createdPlaceholder) {
    await db.update(binanceDepositEventsTable)
      .set({ state: "matching", matchedSessionId: session.id, updatedAt: new Date() })
      .where(eq(binanceDepositEventsTable.id, event.id));
    return { outcome: "not_matched", sessionId: session.id };
  }
  const result = await linkEventToSubmittedSession(event.id);
  return result ?? { outcome: "not_matched", sessionId: session.id };
}

export async function processBscDeposit(deposit: ChainDeposit): Promise<void> {
  const event = await recordBinanceDeposit(deposit);
  if (event && event.status === 1 && !["credited", "pending_approval"].includes(event.state)) {
    const linked = await linkEventToSubmittedSession(event.id);
    if (!linked) await classifyAndPrepareEvent(event.id);
  }
}

async function runBinanceDepositSync(): Promise<void> {
  const batch = await fetchBscDeposits();
  for (const deposit of batch.deposits) {
    await processBscDeposit(deposit);
  }
  if (batch.nextBlock > batch.cursor) {
    await advanceScanCursor(batch.cursor, batch.nextBlock);
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