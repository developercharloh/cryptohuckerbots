import type { Response } from "express";
import { db, adminLoginNotificationsTable } from "@workspace/db";

const clients = new Set<Response>();

export function addSseClient(res: Response): void {
  clients.add(res);
}

export function removeSseClient(res: Response): void {
  clients.delete(res);
}

function broadcast(payload: Record<string, unknown>): void {
  const data = JSON.stringify(payload);
  for (const res of clients) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {
      clients.delete(res);
    }
  }
}

export interface LoginPayload {
  userId: number;
  accountUid: string;
  name: string;
  email: string;
  ip: string;
  country: string;
}

export async function notifyUserLogin(payload: LoginPayload): Promise<void> {
  const [row] = await db
    .insert(adminLoginNotificationsTable)
    .values({
      userId: payload.userId,
      accountUid: payload.accountUid,
      fullName: payload.name,
      email: payload.email,
      ip: payload.ip,
      country: payload.country,
    })
    .returning();

  broadcast({
    type: "login",
    id: row.id,
    userId: payload.userId,
    accountUid: payload.accountUid,
    name: payload.name,
    email: payload.email,
    ip: payload.ip,
    country: payload.country,
    createdAt: row.createdAt.toISOString(),
  });
}

export interface DepositPayload {
  type: "deposit" | "withdrawal";
  name: string;
  email: string;
  userId: number;
  amount: string;
  paymentMethod: string;
  txId?: number;
}

export function notifyAdminTransaction(payload: DepositPayload): void {
  broadcast(payload as unknown as Record<string, unknown>);
}
