import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * POST /storage/uploads/request-url
 *
 * Vercel Blob client-upload handshake. The browser calls this via the
 * `upload()` helper from `@vercel/blob/client`, which POSTs a
 * "generate client token" event here, then uploads the file bytes
 * directly to Vercel Blob storage (never through this server / its body
 * size limits). Works identically on Replit and on Vercel since it only
 * needs BLOB_READ_WRITE_TOKEN and outbound HTTPS access.
 */
function getSanitizedBlobToken(): string | undefined {
  const raw = process.env.BLOB_READ_WRITE_TOKEN;
  if (!raw) return undefined;
  // Defensively strip accidental surrounding quotes/whitespace from copy-paste
  // (e.g. pasting the full `.env.local` line value with quotes intact).
  return raw.trim().replace(/^["']|["']$/g, "");
}

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const body = req.body as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      token: getSanitizedBlobToken(),
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ALLOWED_UPLOAD_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // No-op: the client receives the blob URL directly from upload()
        // and submits it as part of the relevant form (e.g. KYC).
      },
    });

    res.json(jsonResponse);
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload token");
    res.status(400).json({ error: (error as Error).message || "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
