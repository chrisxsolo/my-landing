"use client";

import type { AboutFact, AboutFactContent } from "@/lib/aboutFacts";
import {
  ABOUT_FACT_BODY_MAX_LENGTH,
  ABOUT_FACT_TITLE_MAX_LENGTH,
} from "@/lib/aboutFacts";
import { ALLOWED_ADMIN_PHOTO_TYPES } from "@/lib/photoAdminShared";

export type AboutPhotoRow = {
  id: string;
  fact_slug: string;
  image_url: string;
  storage_path: string;
  alt_text: string | null;
};

type Props = {
  fact: AboutFact;
  factIndex: number;
  factCount: number;
  photo?: AboutPhotoRow;
  contentDraft: AboutFactContent;
  contentDirty: boolean;
  altValue: string;
  fileValue: File | null;
  busy: boolean;
  dragging: boolean;
  converting: boolean;
  savingOrder: boolean;
  registerFileInput: (element: HTMLInputElement | null) => void;
  onContentChange: (content: AboutFactContent) => void;
  onSaveContent: () => void;
  onAltChange: (value: string) => void;
  onStageFile: (file: File | null) => void;
  onUpload: () => void;
  onSaveAlt: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
};

export default function AboutFactEditorCard({
  fact,
  factIndex,
  factCount,
  photo,
  contentDraft,
  contentDirty,
  altValue,
  fileValue,
  busy,
  dragging,
  converting,
  savingOrder,
  registerFileInput,
  onContentChange,
  onSaveContent,
  onAltChange,
  onStageFile,
  onUpload,
  onSaveAlt,
  onRemove,
  onMove,
  onDragOver,
  onDragLeave,
  onDrop,
}: Props) {
  const hasPhoto = !!photo;
  const borderClass = dragging
    ? "border-emerald-400 border-dashed bg-emerald-50"
    : hasPhoto
      ? "border-emerald-300"
      : "border-slate-200";

  return (
    <li
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-xl border bg-white p-4 transition-opacity ${busy ? "opacity-60" : ""} ${borderClass}`}
    >
      <div className="flex items-start gap-3">
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.image_url}
            alt={photo.alt_text ?? ""}
            className="h-20 w-28 flex-shrink-0 rounded-lg object-cover bg-slate-100"
          />
        ) : (
          <div className="h-20 w-28 flex-shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">
            <span className="text-[11px] font-bold text-slate-400 text-center leading-tight px-2">No photo yet</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">
            <span className="font-mono text-slate-400 mr-1.5">#{factIndex + 1}</span>
            {fact.title}
          </p>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">{fact.slug}</p>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{fact.body}</p>
        </div>

        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={savingOrder || factIndex === 0}
            aria-label={`Move "${fact.title}" up`}
            className="rounded-lg border border-slate-300 px-2 py-0.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={savingOrder || factIndex === factCount - 1}
            aria-label={`Move "${fact.title}" down`}
            className="rounded-lg border border-slate-300 px-2 py-0.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
          >
            ↓
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fact text</p>
        <label className="mt-2 block text-xs font-semibold text-slate-600" htmlFor={`fact-title-${fact.slug}`}>
          Headline
        </label>
        <input
          id={`fact-title-${fact.slug}`}
          type="text"
          maxLength={ABOUT_FACT_TITLE_MAX_LENGTH}
          value={contentDraft.title}
          onChange={(event) => onContentChange({ ...contentDraft, title: event.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          disabled={busy}
        />
        <label className="mt-3 block text-xs font-semibold text-slate-600" htmlFor={`fact-body-${fact.slug}`}>
          Description
        </label>
        <textarea
          id={`fact-body-${fact.slug}`}
          rows={3}
          maxLength={ABOUT_FACT_BODY_MAX_LENGTH}
          value={contentDraft.body}
          onChange={(event) => onContentChange({ ...contentDraft, body: event.target.value })}
          className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          disabled={busy}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            {contentDraft.body.length}/{ABOUT_FACT_BODY_MAX_LENGTH}
          </span>
          <button
            type="button"
            onClick={onSaveContent}
            disabled={busy || !contentDirty}
            className="inline-flex items-center rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save fact text"}
          </button>
        </div>
      </div>

      <label className="mt-4 block text-xs font-semibold text-slate-600" htmlFor={`fact-alt-${fact.slug}`}>
        Photo alt text
      </label>
      <input
        id={`fact-alt-${fact.slug}`}
        type="text"
        value={altValue}
        onChange={(event) => onAltChange(event.target.value)}
        placeholder="Descriptive alt text (required)"
        className="mt-1 mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
        disabled={busy}
      />

      <input
        ref={registerFileInput}
        type="file"
        accept={`${ALLOWED_ADMIN_PHOTO_TYPES.join(",")},image/heic,image/heif,.heic,.heif`}
        onChange={(event) => onStageFile(event.target.files?.[0] ?? null)}
        className="hidden"
        disabled={busy}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onUpload}
          disabled={busy || converting}
          className="inline-flex items-center rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy
            ? "Saving…"
            : converting
              ? "Converting…"
              : fileValue
                ? "Upload photo"
                : hasPhoto
                  ? "Replace photo…"
                  : "Choose photo…"}
        </button>

        {fileValue && !busy ? (
          <span className="text-xs text-slate-500 font-mono truncate max-w-[180px]" title={fileValue.name}>
            {fileValue.name}
          </span>
        ) : !busy ? (
          <span className="text-xs text-slate-400">or drag &amp; drop an image here</span>
        ) : null}

        {hasPhoto && (
          <button
            type="button"
            onClick={onSaveAlt}
            disabled={busy}
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Save alt text
          </button>
        )}

        {hasPhoto && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="inline-flex items-center rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Remove photo
          </button>
        )}
      </div>
    </li>
  );
}
