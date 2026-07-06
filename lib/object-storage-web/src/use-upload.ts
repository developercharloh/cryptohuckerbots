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
const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_DIMENSION = 2000; // px, long edge

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!COMPRESSIBLE_TYPES.has(file.type) || file.size <= MAX_UPLOAD_BYTES) {
    return file;
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // Can't decode client-side (unsupported format, corrupt file, etc.) —
    // let it through as-is; the server/Vercel will reject it with a clear
    // size error if it's actually too big, instead of us silently dropping it.
    return file;
  }

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const targetWidth = Math.round(bitmap.width * scale);
  const targetHeight = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close?.();

  let quality = 0.85;
  for (let attempt = 0; attempt < 5; attempt++) {
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) break;
    if (blob.size <= MAX_UPLOAD_BYTES || quality <= 0.4) {
      return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
    }
    quality -= 0.15;
  }

  return file;
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

        if (uploadable.size > MAX_UPLOAD_BYTES) {
          throw new Error(
            "This file is too large even after compression. Please choose a smaller photo (under 4MB).",
          );
        }

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
            let data: unknown;
            try {
              data = JSON.parse(xhr.responseText);
            } catch {
              reject(new Error("Invalid response from server"));
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
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
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
