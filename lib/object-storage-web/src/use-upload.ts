import { useState, useCallback } from "react";
import { upload } from "@vercel/blob/client";

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

/**
 * React hook for handling file uploads via Vercel Blob's client-upload flow.
 *
 * The file is uploaded directly from the browser to Vercel Blob storage —
 * it never passes through this server's request body, so it isn't subject
 * to serverless function body-size limits (e.g. Vercel's ~4.5MB cap).
 * Works identically in Replit dev and on Vercel in production, since it
 * only needs the BLOB_READ_WRITE_TOKEN env var and outbound HTTPS access.
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
        const pathname = `uploads/${crypto.randomUUID()}-${file.name}`;
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: `${basePath}/uploads/request-url`,
          contentType: file.type || "application/octet-stream",
          onUploadProgress: (event) => setProgress(event.percentage),
        });

        const response: UploadResponse = { uploadURL: blob.url, objectPath: blob.url };
        setProgress(100);
        options.onSuccess?.(response);
        return response;
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
