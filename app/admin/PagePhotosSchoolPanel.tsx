"use client";

// Admin → Page Photos: grads photos the system could not confidently give a
// school (no school named, two schools named, or a school with no page). Setting
// a school here writes the photo's explicit school tag, which always wins.

import { useState } from "react";
import { BUILT_IN_SCHOOLS } from "@/lib/contentEngine/schools";
import { SCHOOL_SLUGS } from "@/lib/contentEngine/taxonomy";
import type { UnmatchedPhoto } from "@/lib/pagePhotos/adminView";
import { thumbUrl } from "./PagePhotoCard";

type Props = {
  photos: UnmatchedPhoto[];
  onSetSchool: (portfolioId: number, school: string) => Promise<void>;
};

export default function PagePhotosSchoolPanel({ photos, onSetSchool }: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  if (photos.length === 0) return null;

  async function choose(portfolioId: number, school: string) {
    if (!school) return;
    setBusyId(portfolioId);
    try {
      await onSetSchool(portfolioId, school);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <button type="button" onClick={() => setOpen(!open)} className="text-left text-sm font-bold text-amber-800">
        {open ? "▾" : "▸"} {photos.length} grad photo{photos.length === 1 ? "" : "s"} without a school page
      </button>
      <p className="mt-1 text-xs text-amber-700">
        These stay in the grads portfolio but don&apos;t appear on any school page. Pick a school to place one.
      </p>
      {open && (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.portfolioId} className={`flex gap-3 rounded-lg border border-amber-200 bg-white p-2 ${busyId === photo.portfolioId ? "opacity-60" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl(photo.url)} alt="" loading="lazy" className="h-20 w-16 flex-shrink-0 rounded object-cover bg-slate-100" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800" title={photo.title}>{photo.title}</p>
                <p className="text-[11px] text-slate-500">{photo.note}</p>
                <select
                  aria-label={`School for ${photo.title}`}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                  defaultValue=""
                  disabled={busyId === photo.portfolioId}
                  onChange={(e) => choose(photo.portfolioId, e.target.value)}
                >
                  <option value="">Set school…</option>
                  {SCHOOL_SLUGS.map((slug) => (
                    <option key={slug} value={slug}>{BUILT_IN_SCHOOLS[slug].shortName}</option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
