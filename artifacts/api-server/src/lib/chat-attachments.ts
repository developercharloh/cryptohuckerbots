import crypto from "node:crypto";
import { del, get, head } from "@vercel/blob";
import { handleUpload } from "@vercel/blob/client";
import type { Request, Response } from "express";
import { Readable } from "node:stream";
import { recordTechnicalIncident } from "./technical";

export const MAX_CHAT_ATTACHMENTS = 10;
export const MAX_CHAT_ATTACHMENT_BYTES = 5 * 1024 * 1024 * 1024 * 1024;
const UPLOAD_SESSION_TTL_MS = 15 * 60 * 1000;

export type AttachmentActor = "user" | "admin";

export type ChatAttachmentInput = {
  pathname: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadProof: string;
};

type UploadSessionPayload = {
  actor: AttachmentActor;
  actorId: number;
  userId: number;
  prefix: string;
  expiresAt: number;
};

function getAttachmentSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "local-development-attachment-secret";
  throw new Error("SESSION_SECRET must be configured for attachment uploads.");
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getAttachmentSecret()).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function encodePayload(payload: UploadSessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function createAttachmentUploadSession(
  actor: AttachmentActor,
  actorId: number,
  userId: number,
): { prefix: string; proof: string; expiresAt: number } {
  const expiresAt = Date.now() + UPLOAD_SESSION_TTL_MS;
  const prefix = `support/${userId}/${crypto.randomUUID()}`;
  const payload = encodePayload({ actor, actorId, userId, prefix, expiresAt });
  return {
    prefix,
    proof: `${payload}.${signPayload(payload)}`,
    expiresAt,
  };
}

function parseUploadProof(proof: unknown): UploadSessionPayload | null {
  if (typeof proof !== "string") return null;
  const [payload, signature] = proof.split(".");
  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as Partial<UploadSessionPayload>;
    const expiresAt = parsed.expiresAt;
    if (
      (parsed.actor !== "user" && parsed.actor !== "admin") ||
      !Number.isInteger(parsed.actorId) ||
      !Number.isInteger(parsed.userId) ||
      typeof parsed.prefix !== "string" ||
      typeof expiresAt !== "number" ||
      !Number.isFinite(expiresAt) ||
      Date.now() >= expiresAt
    ) return null;
    return parsed as UploadSessionPayload;
  } catch {
    return null;
  }
}

function isAllowedPath(pathname: string, session: UploadSessionPayload): boolean {
  return pathname.startsWith(`${session.prefix}/`) && pathname.length <= 1024;
}

export function validateAttachmentInputs(
  raw: unknown,
  actor: AttachmentActor,
  actorId: number,
  userId: number,
): ChatAttachmentInput[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_CHAT_ATTACHMENTS) {
    throw new Error(`You can attach up to ${MAX_CHAT_ATTACHMENTS} files per message.`);
  }

  return raw.map((value) => {
    const item = value as Partial<ChatAttachmentInput> | null;
    if (
      !item ||
      typeof item.pathname !== "string" ||
      typeof item.filename !== "string" ||
      typeof item.contentType !== "string" ||
      !Number.isSafeInteger(item.sizeBytes) ||
      typeof item.uploadProof !== "string"
    ) {
      throw new Error("One or more attachments are invalid.");
    }
    const pathname = item.pathname as string;
    const filename = item.filename as string;
    const contentType = item.contentType as string;
    const sizeBytes = item.sizeBytes as number;
    const uploadProof = item.uploadProof as string;
    const session = parseUploadProof(uploadProof);
    if (
      !session ||
      session.actor !== actor ||
      session.actorId !== actorId ||
      session.userId !== userId ||
      !isAllowedPath(pathname, session)
    ) {
      throw new Error("One or more attachments are not authorized for this conversation.");
    }
    if (filename.trim().length === 0 || filename.length > 255) {
      throw new Error("Attachment filenames must be between 1 and 255 characters.");
    }
    if (contentType.length > 180 || sizeBytes < 0 || sizeBytes > MAX_CHAT_ATTACHMENT_BYTES) {
      throw new Error("One or more attachments exceed the supported file size.");
    }
    return {
      pathname,
      filename: filename.trim(),
      contentType: contentType || "application/octet-stream",
      sizeBytes,
      uploadProof,
    };
  });
}

export async function confirmUploadedAttachments(
  inputs: ChatAttachmentInput[],
): Promise<Array<ChatAttachmentInput & { blobUrl: string }>> {
  const confirmed: Array<ChatAttachmentInput & { blobUrl: string }> = [];
  try {
    for (const input of inputs) {
      const blob = await head(input.pathname);
      if (blob.size !== input.sizeBytes) {
        throw new Error(`Attachment ${input.filename} is incomplete. Please upload it again.`);
      }
      confirmed.push({ ...input, blobUrl: blob.url });
    }
  } catch (error) {
    await cleanupUploadedAttachments(inputs).catch(() => undefined);
    throw error;
  }
  return confirmed;
}

export async function cleanupUploadedAttachments(inputs: Array<Pick<ChatAttachmentInput, "pathname">>) {
  if (inputs.length === 0) return;
  await del(inputs.map((input) => input.pathname));
}

export async function handleChatAttachmentUpload(
  req: Request,
  body: unknown,
  actor?: AttachmentActor,
  actorId?: number,
  userId?: number,
) {
  return handleUpload({
    request: req as any,
    body: body as any,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const session = parseUploadProof(clientPayload);
      if (
        !session ||
        (actor !== undefined && session.actor !== actor) ||
        (actorId !== undefined && session.actorId !== actorId) ||
        (userId !== undefined && session.userId !== userId) ||
        !isAllowedPath(pathname, session)
      ) {
        throw new Error("This upload session is invalid or expired.");
      }
      return {
        maximumSizeInBytes: MAX_CHAT_ATTACHMENT_BYTES,
        addRandomSuffix: false,
        tokenPayload: clientPayload,
      };
    },
  });
}

export function isAttachmentStorageFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /vercel blob|blob storage|read-write token|client token|storage credential|storage service/i.test(message);
}

export async function recordAttachmentStorageFailure(route: string): Promise<void> {
  await recordTechnicalIncident({
    source: "api",
    event: "support_attachment_storage_failed",
    route,
    message: "Support attachment storage is unavailable.",
    statusCode: 503,
  });
}

export async function streamPrivateAttachment(
  res: Response,
  pathname: string,
  filename: string,
): Promise<void> {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200) {
    res.status(404).json({ error: "Attachment not found." });
    return;
  }
  const safeFilename = filename.replace(/[^\w.\- ()[\]]/g, "_").slice(0, 180) || "attachment";
  res.status(200);
  res.setHeader("Content-Type", result.blob.contentType || "application/octet-stream");
  res.setHeader("Content-Length", String(result.blob.size));
  res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  Readable.fromWeb(result.stream as any).pipe(res);
}