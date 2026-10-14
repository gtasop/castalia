"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Item = { name: string; progress: number; error?: string };

function upload(albumId: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.set("albumId", albumId);
    body.set("file", file);
    body.set("title", file.name.replace(/\.[^.]+$/, "").replace(/^\d+[\s._-]+/, ""));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/studio/tracks");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || "Upload failed")));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(body);
  });
}

/** Uploads lossless masters one at a time, in the order chosen. */
export function TrackUploader({ albumId }: { albumId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setItems(list.map((f) => ({ name: f.name, progress: 0 })));
    setBusy(true);
    for (const [i, f] of list.entries()) {
      try {
        await upload(albumId, f, (p) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, progress: p } : x))));
        setItems((xs) => xs.map((x, j) => (j === i ? { ...x, progress: 1 } : x)));
      } catch (e) {
        setItems((xs) => xs.map((x, j) => (j === i ? { ...x, error: (e as Error).message } : x)));
      }
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="card">
      <label className="block cursor-pointer rounded-xl border-[1.5px] border-dashed border-edge p-6 text-center hover:border-accent hover:bg-line/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
        <input type="file" multiple accept=".flac,.wav,.aif,.aiff,.m4a,.alac,.wv,.w64" className="sr-only" disabled={busy} onChange={(e) => onFiles(e.target.files)} />
        <span className="font-mono font-bold">{busy ? "uploading…" : "+ add tracks"}</span>
        <span className="mt-1 block text-sm text-muted">
          Lossless masters: FLAC, WAV, AIFF or ALAC, up to 24-bit / 192 kHz. Files are added in name order.
        </span>
      </label>
      {items.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {items.map((it, i) => (
            <li key={i}>
              <div className="flex justify-between">
                <span className="truncate">{it.name}</span>
                <span className={it.error ? "text-danger" : "text-muted"}>{it.error ?? `${Math.round(it.progress * 100)}%`}</span>
              </div>
              <div className="meter mt-1">
                <div className="transition-all" style={{ width: `${it.progress * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Refreshes the page while tracks are still being transcoded. */
export function RefreshWhileProcessing({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}

/** Picks an image and uploads it as the album cover straight away. */
const MAX_COVER_BYTES = 8 * 1024 ** 2;

export function CoverUploader({ albumId, action }: { albumId: string; action: (form: FormData) => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
    <label className={`btn-ghost block w-full cursor-pointer text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${pending ? "pointer-events-none opacity-60" : ""}`}>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          // Checked here too: the server's upload limit would otherwise fail with a bare error.
          if (file.size > MAX_COVER_BYTES) {
            setError("Cover images must be under 8 MB.");
            return;
          }
          setError(null);
          const form = new FormData();
          form.set("albumId", albumId);
          form.set("cover", file);
          startTransition(() => action(form));
        }}
      />
      {pending ? "Uploading…" : "Upload cover"}
    </label>
    {error && (
      <p role="alert" className="mt-2 text-xs text-danger">
        {error}
      </p>
    )}
    </div>
  );
}
