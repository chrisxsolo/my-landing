"use client";

// Admin → Page Photos. Every grad school page and location guide picks its
// photos automatically from photos that are already public (portfolio, Content
// Engine placements, guide uploads), matched by school or place. This tab
// shows each page exactly as visitors see it and lets you choose the hero,
// pin and order photos, or hide one from just that page. Writes go through
// /api/admin/page-photos, which refreshes the public pages.

import { useCallback, useEffect, useState } from "react";
import type { PagePhotoReport, PageSummary, PageView, PageViewPhoto } from "@/lib/pagePhotos/adminView";
import type { CurationAction } from "@/lib/pagePhotos/curationStore";
import PagePhotoCard from "./PagePhotoCard";
import PagePhotosSchoolPanel from "./PagePhotosSchoolPanel";

type Props = { showToast: (message: string, ok?: boolean) => void };

const API = "/api/admin/page-photos";

const ACTION_MESSAGES: Record<CurationAction, string> = {
  pin: "Pinned.", unpin: "Unpinned.", hide: "Hidden on this page.", unhide: "Shown again.",
  hero: "Hero set.", unhero: "Hero cleared.", up: "Moved.", down: "Moved.",
};

async function request<T>(method: string, query = "", body?: unknown): Promise<T> {
  const res = await fetch(`${API}${query}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as T;
}

function PageList({ pages, selected, onSelect }: { pages: PageSummary[]; selected: string | null; onSelect: (key: string) => void }) {
  return (
    <ul className="space-y-1">
      {pages.map((page) => (
        <li key={page.key}>
          <button
            type="button"
            onClick={() => onSelect(page.key)}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selected === page.key ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"} border border-slate-200`}
          >
            <span className="block font-semibold">{page.label}</span>
            <span className={`text-xs ${selected === page.key ? "text-slate-300" : page.shownCount === 0 ? "text-amber-600" : "text-slate-500"}`}>
              {page.shownCount === 0 ? "No photos yet" : `${page.shownCount} shown · ${page.ownCount + page.matchedCount} eligible`}
              {page.hiddenCount > 0 ? ` · ${page.hiddenCount} hidden` : ""}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PhotoGrid({ title, note, photos, busyUrl, onAction }: {
  title: string; note?: string; photos: PageViewPhoto[]; busyUrl: string | null;
  onAction: (photo: PageViewPhoto, action: CurationAction) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <section className="mb-6">
      <h3 className="text-sm font-bold text-slate-800">{title} <span className="font-normal text-slate-500">({photos.length})</span></h3>
      {note && <p className="mb-2 text-xs text-slate-500">{note}</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {photos.map((photo) => (
          <PagePhotoCard key={photo.url} photo={photo} busy={busyUrl === photo.url} onAction={(a) => onAction(photo, a)} />
        ))}
      </ul>
    </section>
  );
}

export default function PagePhotosTab({ showToast }: Props) {
  const [report, setReport] = useState<PagePhotoReport | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<PageView | null>(null);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    try {
      const next = await request<PagePhotoReport>("GET");
      setReport(next);
      if (next.errors.length) showToast(`Some photo sources could not be read: ${next.errors.join("; ")}`, false);
      setSelected((current) => current ?? next.pages[0]?.key ?? null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load page photos", false);
    }
  }, [showToast]);

  useEffect(() => { loadReport(); }, [loadReport]);

  useEffect(() => {
    if (!selected) return;
    setView(null);
    request<PageView>("GET", `?page=${encodeURIComponent(selected)}`)
      .then(setView)
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load page", false));
  }, [selected, showToast]);

  async function act(photo: PageViewPhoto, action: CurationAction) {
    if (!selected) return;
    setBusyUrl(photo.url);
    try {
      setView(await request<PageView>("POST", "", { page: selected, imageUrl: photo.url, action }));
      showToast(ACTION_MESSAGES[action]);
      loadReport();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      setBusyUrl(null);
    }
  }

  async function setSchool(portfolioId: number, school: string) {
    try {
      await request("PATCH", "", { portfolioId, school });
      showToast("School saved — the photo now appears on that school page.");
      await loadReport();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", false);
    }
  }

  if (!report) return <p className="text-sm text-slate-500">Loading page photos…</p>;

  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        School pages and location guides fill themselves from photos that are already public — the portfolio,
        Content Engine placements, and guide uploads — matched by school or place. Pin to choose the order,
        set a hero, or hide a photo from one page without touching anywhere else.
      </p>
      <PagePhotosSchoolPanel photos={report.unmatchedGrads} onSetSchool={setSchool} />
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <PageList pages={report.pages} selected={selected} onSelect={setSelected} />
        <div>
          {!view && <p className="text-sm text-slate-500">Loading…</p>}
          {view && (
            <>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">{view.label}</h2>
                <a href={view.path} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-700 hover:underline">
                  View page ↗
                </a>
              </div>
              {view.shown.length === 0 && <p className="mb-4 text-sm text-slate-500">No eligible photos for this page yet — its gallery stays hidden.</p>}
              <PhotoGrid title="On the page" note="In display order. The first photo is the hero." photos={view.shown} busyUrl={busyUrl} onAction={act} />
              <PhotoGrid title="Eligible but not shown" note="Over the page's limit. Pin one to show it." photos={view.overflow} busyUrl={busyUrl} onAction={act} />
              <PhotoGrid title="Hidden on this page" photos={view.hidden} busyUrl={busyUrl} onAction={act} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
