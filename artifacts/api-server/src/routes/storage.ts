import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import multer from "multer";
import { put } from "@vercel/blob";
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

function getSanitizedBlobToken(): string | undefined {
  const raw = process.env.BLOB_READ_WRITE_TOKEN;
  if (!raw) return undefined;
  // Defensively strip accidental surrounding quotes/whitespace from copy-paste
  // (e.g. re-pasting an already-quoted value can wrap it in multiple layers
  // of quotes, e.g. `"""token""""`). Strip repeatedly until stable so any
  // number of nested quote layers is removed, not just one.
  let cleaned = raw.trim();
  let previous: string;
  do {
    previous = cleaned;
    cleaned = cleaned.trim().replace(/^["']+|["']+$/g, "").trim();
  } while (cleaned !== previous);
  return cleaned;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

/**
 * POST /storage/uploads
 *
 * Accepts a file as multipart/form-data (binary, not base64/JSON) and
 * uploads it to Vercel Blob server-side using the raw BLOB_READ_WRITE_TOKEN.
 *
 * Why not base64-encode the file into a JSON body? Because base64 adds ~33%
 * overhead plus JSON escaping, which is what originally pushed KYC uploads
 * over Vercel's ~4.5MB serverless request body limit in production. Raw
 * multipart binary avoids that overhead entirely, so typical KYC documents
 * (photos, scanned IDs, PDFs up to a few MB) stay comfortably under the
 * limit. This also sidesteps the client-token direct-to-blob handshake,
 * which proved unreliable in practice — server-side `put()` with the raw
 * token is simple and has been verified to work consistently.
 */
router.post("/storage/uploads", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    if (!ALLOWED_UPLOAD_CONTENT_TYPES.includes(file.mimetype)) {
      res.status(400).json({ error: `Unsupported file type: ${file.mimetype}` });
      return;
    }

    const token = getSanitizedBlobToken();
    if (!token) {
      res.status(500).json({ error: "Blob storage is not configured" });
      return;
    }

    const pathname = `uploads/${crypto.randomUUID()}-${file.originalname}`;
    const blob = await put(pathname, file.buffer, {
      access: "private",
      contentType: file.mimetype,
      addRandomSuffix: false,
      token,
    });

    res.json({ uploadURL: blob.url, objectPath: blob.url });
  } catch (error) {
    req.log.error({ err: error }, "Error uploading file");
    res.status(500).json({ error: (error as Error).message || "Failed to upload file" });
  }
});

/**
 * GET /storage/blob-proxy?url=<blobUrl>
 *
 * Streams a private Vercel Blob object through the server using the
 * BLOB_READ_WRITE_TOKEN. Private blobs (e.g. KYC documents) cannot be
 * fetched directly by the browser since they require a bearer token;
 * this proxy lets authenticated admin clients view them via a plain URL.
 * Restricted to the configured blob storage hostname to avoid becoming
 * an open proxy.
 */
router.get("/storage/blob-proxy", async (req: Request, res: Response) => {
  try {
    const url = req.query.url;
    if (typeof url !== "string") {
      res.status(400).json({ error: "Missing url query parameter" });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      res.status(400).json({ error: "Invalid url" });
      return;
    }

    const isBlobHost =
      parsed.protocol === "https:" && /\.blob\.vercel-storage\.com$/.test(parsed.hostname);
    if (!isBlobHost) {
      res.status(400).json({ error: "URL is not a recognized blob storage host" });
      return;
    }

    const token = getSanitizedBlobToken();
    const upstream = await fetch(parsed.toString(), {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "Failed to fetch blob" });
      return;
    }

    res.status(200);
    const contentType = upstream.headers.get("content-type");
    const contentLength = upstream.headers.get("content-length");
    if (contentType) res.setHeader("content-type", contentType);
    if (contentLength) res.setHeader("content-length", contentLength);

    if (upstream.body) {
      const nodeStream = Readable.fromWeb(upstream.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error proxying blob object");
    res.status(500).json({ error: "Failed to proxy blob object" });
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
