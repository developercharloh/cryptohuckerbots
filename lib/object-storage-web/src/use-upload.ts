import { useState, useCallback } from "react";

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
}

interface UseUploadOptions {
  /** Base path where object storage routes are mounted (default: "/api/storage") */
  basePath?: string;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

// Vercel's Node.js serverless functions enforce a hard ~4.5MB request body
// limit that CANNOT be raised via config (unlike, say, Express body-parser
// limits) — it's enforced by Vercel's infrastructure before the request
// even reaches our code. Phone camera photos routinely come in at 3-10MB,
// so uploads of raw photos silently fail in production (413 from Vercel's
// edge, not something our own error handling ever sees) even though the
// exact same code works fine in local dev / smaller test payloads. To make
// this durable, we proactively downscale/recompress images client-side to
// comfortably clear that ceiling, and hard-fail with a clear message if an
// image still can't be brought under the limit, rather than sending it and
// getting a cryptic failure back.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stay safely under Vercel's ~4.5MB cap
// Formats we know for certain are NOT images and therefore can't be
// compressed client-side (scanned documents, etc).
const NON_COMPRESSIBLE_TYPES = new Set(["application/pdf"]);
const MAX_IMAGE_DIMENSION = 2000; // px, long edge

// Decoding a full-resolution 12MP+ photo (common on phone cameras) into a
// bitmap before downscaling can exhaust memory on lower-end/older Android
// devices, causing createImageBitmap (or the subsequent canvas draw) to
// silently fail — which previously meant we'd fall back to sending the
// original, oversized file and hitting Vercel's 413 anyway. Passing resize
// options directly into createImageBitmap lets the browser decode straight
// to a smaller target size, using far less peak memory, which is much more
// reliable on constrained devices.
async function decodeDownscaled(file: File, targetLongEdge: number): Promise<ImageBitmap> {
  // Probe natural dimensions first via a cheap decode-free path when possible.
  const probe = await createImageBitmap(file);
  const scale = Math.min(1, targetLongEdge / Math.max(probe.width, probe.height));
  if (scale === 1) return probe;
  const resizeWidth = Math.round(probe.width * scale);
  const resizeHeight = Math.round(probe.height * scale);
  probe.close?.();
  return createImageBitmap(file, {
    resizeWidth,
    resizeHeight,
    resizeQuality: "medium",
  });
}

async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES) {
    return file;
  }

  if (NON_COMPRESSIBLE_TYPES.has(file.type)) {
    // Known non-image format we can't shrink client-side (e.g. a scanned
    // PDF). Rather than let it hit the wire and hit Vercel's hard, silent
    // ~4.5MB platform limit (which returns a *plain-text* error our JSON
    // parsing chokes on, surfacing a cryptic "Invalid response from
    // server"), fail loudly now with an actionable message.
    throw new Error(
      "This file is too large to upload. Please choose a file under 4MB, or take a photo of the document instead.",
    );
  }

  // Deliberately do NOT gate this on `file.type` matching an exact image
  // MIME string (e.g. "image/jpeg"). Real-world phone cameras/scanner apps
  // routinely report inconsistent or missing types for image files
  // (`image/jpg`, empty string, `image/heic`, etc). Filtering on a strict
  // allowlist let those files skip compression entirely, sail through as
  // raw oversized uploads, and slam into Vercel's unraisable ~4.5MB body
  // limit — which returns plain text, not JSON, producing a confusing
  // "Invalid response from server" instead of a clear message. Instead we
  // attempt to decode ANY oversized non-PDF file as an image; if it
  // genuinely isn't one, createImageBitmap throws and we fail loudly below
  // with a clear message, rather than silently shipping the raw file.
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await decodeDownscaled(file, MAX_IMAGE_DIMENSION);
  } catch {
    bitmap = null;
  }

  if (!bitmap) {
    // Can't decode client-side (unsupported format, corrupt file, low
    // memory, etc.). Rather than silently sending the original oversized
    // file (which just produces a cryptic failure later), fail loudly now
    // with a message the user can act on.
    throw new Error(
      "This photo couldn't be processed on your device. Try taking a new photo at a lower resolution, or choose a smaller existing file.",
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("This device's browser doesn't support image processing needed for upload.");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  let quality = 0.85;
  for (let attempt = 0; attempt < 6; attempt++) {
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) {
      throw new Error("Couldn't compress this photo. Please try a different file.");
    }
    if (blob.size <= MAX_UPLOAD_BYTES || quality <= 0.35) {
      return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
    }
    quality -= 0.15;
  }

  throw new Error(
    "This photo is too large to upload even after compression. Please choose a smaller photo.",
  );
}

/**
 * React hook for handling file uploads.
 *
 * The file is sent as multipart/form-data (binary, not base64-encoded JSON)
 * directly to our server, which streams it to Vercel Blob storage using the
 * server's blob token. Multipart avoids the ~33% size overhead of base64
 * JSON payloads, which is what previously pushed uploads over Vercel's
 * ~4.5MB serverless function body limit. Works identically in Replit dev
 * and on Vercel in production.
 *
 * @example
 * ```tsx
 * function FileUploader() {
 *   const { uploadFile, isUploading, error } = useUpload({
 *     onSuccess: (response) => {
 *       console.log("Uploaded to:", response.uploadURL);
 *     },
 *   });
 *
 *   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (file) {
 *       await uploadFile(file);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleFileChange} disabled={isUploading} />
 *       {isUploading && <p>Uploading...</p>}
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUpload(options: UseUploadOptions = {}) {
  const basePath = options.basePath ?? "/api/storage";
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        const uploadable = await compressImageIfNeeded(file);

        const formData = new FormData();
        formData.append("file", uploadable);

        const uploadResponse = await new Promise<UploadResponse>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${basePath}/uploads`);
          xhr.withCredentials = true;

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setProgress(Math.round((event.loaded / event.total) * 100));
            }
          };

          xhr.onload = () => {
            // Defense in depth: even though compressImageIfNeeded() should
            // now catch essentially every case that used to slip through
            // and hit Vercel's hard ~4.5MB platform limit, that edge-level
            // rejection returns *plain text* (not JSON) when it does occur
            // (e.g. an unusually large file compression couldn't shrink
            // enough). Detect that case by status code before attempting to
            // parse JSON, so users get an actionable message instead of the
            // opaque "Invalid response from server".
            if (xhr.status === 413) {
              reject(new Error("This file is too large to upload. Please choose a smaller photo."));
              return;
            }

            let data: unknown;
            try {
              data = JSON.parse(xhr.responseText);
            } catch {
              reject(
                new Error(
                  xhr.status >= 200 && xhr.status < 300
                    ? "Invalid response from server"
                    : `Upload failed (${xhr.status}). Please try again.`,
                ),
              );
              return;
            }
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data as UploadResponse);
            } else {
              const message =
                (data as { error?: string } | null)?.error || `Upload failed (${xhr.status})`;
              reject(new Error(message));
            }
          };

          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(formData);
        });

        setProgress(100);
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        // NOTE: intentionally re-thrown below instead of only relying on the
        // `error` state value here. React state updates from setError() are
        // not visible to a caller that reads the `error` returned by this
        // hook in the same synchronous continuation after awaiting
        // uploadFile() — that reads a stale closure from the render that
        // created the callback, not the just-set value. Callers that need
        // the *specific* failure reason for this call must catch the thrown
        // error rather than inspect hook state immediately afterwards.
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [basePath, options],
  );

  return {
    uploadFile,
    isUploading,
    error,
    progress,
  };
}
