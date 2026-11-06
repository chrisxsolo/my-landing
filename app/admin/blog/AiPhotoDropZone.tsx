"use client";
// The "AI: drop photos" box of the Blog tab (moved out of BlogTab.tsx). Two
// explicitly named actions: Generate draft (private, review then schedule or
// publish) and Generate & publish now (the legacy instant path).
import { useRef } from "react";

interface Props {
  files: File[];
  previews: string[];
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  generating: boolean;
  onGenerate: (mode: "draft" | "publish") => void;
}

export default function AiPhotoDropZone({ files, previews, dragging, setDragging, onFiles, onRemove, onClear, generating, onGenerate }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="mb-5 rounded-xl p-4" style={{ background: "rgba(111,194,150,0.08)", border: "1.5px dashed rgba(111,194,150,0.45)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">✨</span>
        <p className="text-xs font-bold uppercase tracking-widest m-0" style={{ color: "#6fc296" }}>AI: Drop Photos → Auto-Post</p>
      </div>
      <p className="text-xs text-slate-400 mb-3">Drop 10–30 photos. Claude picks the best 10 and writes the post — as a private draft to review and schedule, or published instantly.</p>
      <div className="w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
        style={{ minHeight: "100px", borderColor: dragging ? "#6fc296" : "rgba(111,194,150,0.35)", background: dragging ? "rgba(111,194,150,0.16)" : "rgba(111,194,150,0.06)" }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); onFiles(Array.from(e.dataTransfer.files)); }}>
        {files.length === 0 ? (
          <>
            <span className="text-2xl">📷</span>
            <span className="text-xs font-bold" style={{ color: "#6fc296" }}>Drop photos here or tap to select</span>
            <span className="text-xs text-slate-400">Up to 30 photos · JPG, PNG, HEIC</span>
          </>
        ) : (
          <div className="w-full p-2">
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {previews.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={e => { e.stopPropagation(); onRemove(i); }} aria-label={`Remove photo ${i + 1}`} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[9px] font-bold flex items-center justify-center">✕</button>
                </div>
              ))}
              <div className="aspect-square rounded-lg border border-dashed flex items-center justify-center" style={{ borderColor: "#86efac", background: "#dcfce7" }}>
                <span className="text-lg text-green-400">+</span>
              </div>
            </div>
            <p className="text-xs font-bold text-center" style={{ color: "#16a34a" }}>{files.length} photo{files.length !== 1 ? "s" : ""} selected — Claude picks the best 10</p>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onFiles(Array.from(e.target.files ?? []))} />
      {files.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => onGenerate("draft")} disabled={generating} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white min-h-[44px] transition-all hover:opacity-90 active:scale-95" style={{ background: generating ? "#86efac" : "#16a34a", opacity: generating ? 0.8 : 1 }}>
            {generating ? "✨ Working…" : "✨ Generate draft"}
          </button>
          <button onClick={() => onGenerate("publish")} disabled={generating} title="Writes the post AND publishes it to the live site immediately" className="py-2.5 px-4 rounded-xl font-bold text-sm min-h-[44px] transition-all hover:opacity-90 active:scale-95" style={{ background: "rgba(22,163,74,0.12)", color: "#15803d" }}>
            {generating ? "…" : "Generate & publish now"}
          </button>
          <button onClick={onClear} disabled={generating} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors min-h-[44px]">Clear</button>
        </div>
      )}
    </div>
  );
}
