import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Camera, FileText, Paperclip, RotateCcw, X } from "lucide-react";
import { API_BASE, fetchWithTimeout } from "@/lib/api-base";

export type AdminUploadedChatAttachment = {
  pathname: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadProof: string;
};

type PendingFile = {
  id: string;
  file: File;
  uploaded?: AdminUploadedChatAttachment;
  progress: number;
  error?: string;
};

export function AdminChatAttachmentPicker({
  userId,
  disabled,
  onChange,
}: {
  userId: number;
  disabled?: boolean;
  onChange: (attachments: AdminUploadedChatAttachment[], uploading: boolean) => void;
}) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const filesRef = useRef<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const report = (next: PendingFile[]) => {
    filesRef.current = next;
    setFiles(next);
    onChange(
      next.flatMap((item) => item.uploaded ? [item.uploaded] : []),
      next.some((item) => !item.error && !item.uploaded),
    );
  };

  const uploadFile = async (item: PendingFile) => {
    try {
      const sessionResponse = await fetchWithTimeout(`${API_BASE}/api/admin/chat/${userId}/attachments/session`, {
        method: "POST",
        credentials: "include",
      });
      if (!sessionResponse.ok) throw new Error("Could not start the upload.");
      const session = await sessionResponse.json() as { prefix: string; proof: string };
      const safeName = item.file.name.replace(/[^\w.\- ()[\]]/g, "_").slice(0, 180) || "attachment";
      const result = await upload(`${session.prefix}/${safeName}`, item.file, {
        access: "private",
        handleUploadUrl: `${API_BASE}/api/admin/chat/${userId}/attachments/upload`,
        clientPayload: session.proof,
        contentType: item.file.type || "application/octet-stream",
        multipart: item.file.size > 4 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => {
          const next = filesRef.current.map((candidate) => candidate.id === item.id ? { ...candidate, progress: percentage } : candidate);
          filesRef.current = next;
          setFiles(next);
        },
      });
      const next = filesRef.current.map((candidate) => candidate.id === item.id ? {
        ...candidate,
        progress: 100,
        uploaded: {
          pathname: result.pathname,
          filename: item.file.name,
          contentType: item.file.type || "application/octet-stream",
          sizeBytes: item.file.size,
          uploadProof: session.proof,
        },
      } : candidate);
      report(next);
    } catch (error) {
      report(filesRef.current.map((candidate) => candidate.id === item.id ? {
        ...candidate,
        error: error instanceof Error ? error.message : "Upload failed.",
      } : candidate));
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const additions = Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      progress: 0,
    }));
    const acceptedAdditions = additions.slice(0, Math.max(0, 10 - filesRef.current.length));
    const next = [...filesRef.current, ...acceptedAdditions];
    report(next);
    acceptedAdditions.forEach((item) => void uploadFile(item));
  };

  const remove = (id: string) => report(filesRef.current.filter((item) => item.id !== id));
  const retry = (item: PendingFile) => {
    const next = filesRef.current.map((candidate) => candidate.id === item.id ? { ...candidate, error: undefined, uploaded: undefined, progress: 0 } : candidate);
    report(next);
    void uploadFile(next.find((candidate) => candidate.id === item.id)!);
  };

  return (
    <div className="space-y-1.5">
      {files.map((item) => (
        <div key={item.id} className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-2.5 py-2 text-xs">
          {item.file.type.startsWith("image/") ? <img src={URL.createObjectURL(item.file)} alt="" className="h-8 w-8 rounded object-cover" /> : <FileText className="h-4 w-4 text-primary" />}
          <div className="min-w-0 flex-1">
            <p className="truncate">{item.file.name}</p>
            <p className="text-[10px] text-muted-foreground">{item.error || (item.uploaded ? "Ready to send" : `${item.progress}% uploading`)}</p>
            {!item.error && !item.uploaded && <div className="mt-1 h-1 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${item.progress}%` }} /></div>}
          </div>
          {item.error && <button type="button" onClick={() => retry(item)} aria-label="Retry upload"><RotateCcw className="h-4 w-4 text-primary" /></button>}
          <button type="button" onClick={() => remove(item.id)} aria-label="Remove attachment"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
      ))}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }} />
      <div className="flex gap-1">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled || files.length >= 10} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:bg-card disabled:opacity-40"><Paperclip className="h-3.5 w-3.5" /> Attach</button>
        <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={disabled || files.length >= 10} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:bg-card disabled:opacity-40"><Camera className="h-3.5 w-3.5" /> Camera</button>
      </div>
    </div>
  );
}