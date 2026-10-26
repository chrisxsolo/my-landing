"use client";

// Upload form for Admin → Couples Portfolio. Files go browser → Storage through
// the existing signed upload (uploadImage, "portfolio" folder), each photo's
// pixel size is read in the browser, and the rows are created through
// /api/admin/couples-portfolio so they land in the couples category.

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/uploadImage";
import type { CouplesPortfolioAdminRow } from "@/lib/couplesPortfolioAdmin";

type Props = {
  sessionLabels: string[];
  showToast: (message: string, ok?: boolean) => void;
  onUploaded: (photos: CouplesPortfolioAdminRow[]) => void;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const API = "/api/admin/couples-portfolio";

async function readSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

export default function CouplesPortfolioUpload({ sessionLabels, showToast, onUploaded }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [session, setSession] = useState("");
  const [alt, setAlt] = useState("");
  const [publish, setPublish] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (files.length === 0) return showToast("Choose at least one photo.", false);
    if (!alt.trim()) return showToast("Add alt text describing the photos.", false);
    const rows = [];
    for (const [index, file] of files.entries()) {
      setProgress(`Uploading ${index + 1} of ${files.length}…`);
      const [url, size] = await Promise.all([uploadImage(file, "portfolio", showToast), readSize(file)]);
      if (!url) continue;
      rows.push({
        image_url: url,
        title: session.trim() ? `${session.trim()} — couples session` : "Bay Area couples session",
        alt: alt.trim(),
        session_label: session.trim() || null,
        ...(size ?? {}),
      });
    }
    if (rows.length === 0) {
      setProgress(null);
      return;
    }
    setProgress("Saving…");
    try {
      const res = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", rows, publish }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add photos");
      onUploaded(json.photos ?? []);
      showToast(`${rows.length} photo${rows.length === 1 ? "" : "s"} added${publish ? " and published" : " as hidden"}.`);
      setFiles([]);
      setAlt("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not add photos", false);
    } finally {
      setProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
      <p className="text-sm font-bold text-slate-700 mb-3">Add couples photos</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm text-slate-700"
        />
        <input
          type="text"
          list="couples-session-labels"
          value={session}
          onChange={(e) => setSession(e.target.value)}
          placeholder="Session (e.g. Baker Beach · Nov 2026)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-800"
        />
        <datalist id="couples-session-labels">
          {sessionLabels.map((label) => <option key={label} value={label} />)}
        </datalist>
      </div>
      <input
        type="text"
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        placeholder="Alt text (required) — e.g. Couple walking hand in hand on Baker Beach at sunset"
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-800"
      />
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Publish right away
        </label>
        <button
          type="submit"
          disabled={progress !== null}
          className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {progress ?? `Upload${files.length > 1 ? ` ${files.length} photos` : ""}`}
        </button>
        <span className="text-xs text-slate-500">Photos you publish from the Content Engine appear here automatically, grouped by session.</span>
      </div>
    </form>
  );
}
