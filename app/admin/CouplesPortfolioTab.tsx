"use client";

// Admin → Couples Portfolio. Manages the photos on /portfolio/couples (and the
// couples guide gallery): add photos, hide/publish, pick the hero, feature,
// group by session, reorder photos and whole sessions, and remove. All writes go
// through /api/admin/couples-portfolio (requireAdmin + service role), which also
// refreshes the public pages. The page shows photos in exactly this order.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  groupBySession,
  type CouplesPortfolioAdminRow,
  type CouplesPortfolioUpdates,
} from "@/lib/couplesPortfolioAdmin";
import { COUPLES_PORTFOLIO_PATH } from "@/lib/couplesRoutes";
import CouplesPortfolioUpload from "./CouplesPortfolioUpload";
import CouplesPortfolioPhotoCard from "./CouplesPortfolioPhotoCard";

type Props = { showToast: (message: string, ok?: boolean) => void };
type Row = CouplesPortfolioAdminRow;

const API = "/api/admin/couples-portfolio";
const NO_SESSION = "Not grouped yet";
const MEASURE_WIDTH = 400;

async function request(method: string, body?: unknown, query = "") {
  const res = await fetch(`${API}${query}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as { photos?: Row[]; photo?: Row };
}

// A small transformed copy is enough to read the aspect ratio.
function measureUrl(url: string) {
  return url.includes("/storage/v1/object/public/")
    ? `${url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=${MEASURE_WIDTH}&resize=contain`
    : url;
}

function measure(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => resolve(null);
    img.src = measureUrl(url);
  });
}

function swap<T>(list: T[], index: number, direction: -1 | 1): T[] | null {
  const target = index + direction;
  if (target < 0 || target >= list.length) return null;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function CouplesPortfolioTab({ showToast }: Props) {
  const [photos, setPhotos] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPhotos((await request("GET")).photos ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load couples photos", false);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // Photos added without a recorded size (older uploads) are measured once here
  // so the public gallery can keep their real aspect ratio.
  useEffect(() => {
    const missing = photos.filter((photo) => !photo.width || !photo.height);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const photo of missing) {
        const size = await measure(photo.image_url);
        if (cancelled || !size) continue;
        try {
          const { photo: saved } = await request("PATCH", { id: photo.id, updates: size });
          if (saved && !cancelled) setPhotos((current) => current.map((row) => (row.id === saved.id ? saved : row)));
        } catch (err) {
          console.error("[couples portfolio] could not save photo size", err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [photos]);

  const groups = useMemo(() => groupBySession(photos), [photos]);
  const sessionLabels = useMemo(() => groups.map((g) => g.label).filter(Boolean), [groups]);
  const publishedCount = photos.filter((photo) => photo.published).length;

  async function update(photo: Row, updates: CouplesPortfolioUpdates, message: string) {
    setBusyId(photo.id);
    try {
      const { photo: saved } = await request("PATCH", { id: photo.id, updates });
      if (saved) setPhotos((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      showToast(message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      setBusyId(null);
    }
  }

  async function replaceAll(action: () => Promise<{ photos?: Row[] }>, message: string, busy: number | null = null) {
    setBusyId(busy);
    try {
      const { photos: next } = await action();
      if (next) setPhotos(next);
      showToast(message);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", false);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function saveOrder(nextGroups: Array<{ rows: Row[] }>) {
    const ordered = nextGroups.flatMap((group) => group.rows);
    setPhotos(ordered); // optimistic
    return replaceAll(() => request("PUT", { order: ordered.map((row) => row.id) }), "Order saved.");
  }

  function movePhoto(groupIndex: number, rowIndex: number, direction: -1 | 1) {
    const rows = swap(groups[groupIndex].rows, rowIndex, direction);
    if (!rows) return;
    saveOrder(groups.map((group, index) => (index === groupIndex ? { ...group, rows } : group)));
  }

  function moveGroup(groupIndex: number, direction: -1 | 1) {
    const next = swap(groups, groupIndex, direction);
    if (next) saveOrder(next);
  }

  async function renameGroup(rows: Row[], label: string) {
    const next = label.trim();
    if (next === (rows[0]?.session_label ?? "")) return;
    for (const row of rows) {
      await update(row, { session_label: next || null }, "Session renamed.");
    }
  }

  function remove(photo: Row) {
    if (!window.confirm("Remove this photo from the couples portfolio? To keep it but take it off the site, use Hide instead.")) return;
    replaceAll(async () => {
      await request("DELETE", undefined, `?id=${photo.id}`);
      return { photos: photos.filter((row) => row.id !== photo.id) };
    }, "Photo removed.", photo.id);
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-800">Couples Portfolio</h2>
        <p className="text-sm text-slate-500 mt-1">
          Photos on the public couples portfolio, in the order shown here. Hidden photos stay saved but never appear on the site.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <a href={COUPLES_PORTFOLIO_PATH} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 underline hover:text-emerald-800">
            View the couples portfolio ↗
          </a>
          <span className="text-xs text-slate-500">{publishedCount} published · {photos.length - publishedCount} hidden · {groups.length} sessions</span>
        </div>
      </div>

      <CouplesPortfolioUpload sessionLabels={sessionLabels} showToast={showToast} onUploaded={setPhotos} />

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-slate-500">No couples photos yet. Add some above or publish a couples session from the Content Engine.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((group, groupIndex) => (
            <section key={group.label || NO_SESSION} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  defaultValue={group.label}
                  placeholder={NO_SESSION}
                  onBlur={(e) => renameGroup(group.rows, e.target.value)}
                  aria-label="Session name"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800"
                />
                <span className="text-xs text-slate-500">{group.rows.length} photos</span>
                <button type="button" onClick={() => moveGroup(groupIndex, -1)} disabled={groupIndex === 0} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40" aria-label="Move session earlier">
                  ↑ Session
                </button>
                <button type="button" onClick={() => moveGroup(groupIndex, 1)} disabled={groupIndex === groups.length - 1} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40" aria-label="Move session later">
                  ↓ Session
                </button>
              </div>
              <ul className="space-y-2">
                {group.rows.map((photo, rowIndex) => (
                  <CouplesPortfolioPhotoCard
                    key={photo.id}
                    photo={photo}
                    busy={busyId === photo.id}
                    isFirst={rowIndex === 0}
                    isLast={rowIndex === group.rows.length - 1}
                    onUpdate={(updates, message) => update(photo, updates, message)}
                    onHero={() => replaceAll(() => request("POST", { action: "hero", id: photo.id }), "Hero photo updated.", photo.id)}
                    onMove={(direction) => movePhoto(groupIndex, rowIndex, direction)}
                    onRemove={() => remove(photo)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
