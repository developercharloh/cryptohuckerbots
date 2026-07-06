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
        const formData = new FormData();
        formData.append("file", file);

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
