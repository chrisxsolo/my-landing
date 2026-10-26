"use client";

// Admin → Page Photos: "Where to find it" lines for a school's location guide
// spots. A spot shows its line on the public guide only after one is saved
// here, so write it once you've confirmed the exact spot on campus.

import { useEffect, useRef, useState } from "react";
import type { SpotOption } from "@/lib/pagePhotos/adminView";
import { SPOT_NOTE_MAX } from "@/lib/schoolSpots";

const API = "/api/admin/school-spot-notes";

type Props = {
  school: string;
  spots: SpotOption[];
  showToast: (message: string, ok?: boolean) => void;
};

export default function SpotNotesPanel({ school, spots, showToast }: Props) {
  const [saved, setSaved] = useState<Record<string, string> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // showToast changes on every admin render; a ref keeps the load per school.
  const toastRef = useRef(showToast);
  useEffect(() => { toastRef.current = showToast; }, [showToast]);

  useEffect(() => {
    let live = true;
    setSaved(null);
    fetch(`${API}?school=${encodeURIComponent(school)}`, { credentials: "include" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Could not load spot notes");
        if (live) { setSaved(json.notes); setDrafts(json.notes); }
      })
      .catch((err) => {
        console.error("[spot-notes] load failed", err);
        if (live) toastRef.current(err instanceof Error ? err.message : "Could not load spot notes", false);
      });
    return () => { live = false; };
  }, [school]);

  async function save(spotKey: string) {
    setBusyKey(spotKey);
    try {
      const res = await fetch(API, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, spotKey, note: drafts[spotKey] ?? "" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSaved(json.notes);
      setDrafts(json.notes);
      showToast(json.notes[spotKey] ? "Location saved — it now shows on the guide." : "Location cleared.");
    } catch (err) {
      console.error("[spot-notes] save failed", err);
      showToast(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      setBusyKey(null);
    }
  }

  if (!saved) return null;
  return (
    <details className="mb-5 max-w-3xl rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-bold text-slate-800">
        Where to find each guide spot <span className="font-normal text-slate-500">({Object.keys(saved).length} of {spots.length} set)</span>
      </summary>
      <p className="mt-2 text-xs text-slate-500">
        Optional. Shown on the guide as &ldquo;Where to find it&rdquo; under the spot&apos;s name. Leave a spot empty until
        you&apos;ve confirmed its exact location; empty spots show no line.
      </p>
      <ul className="mt-3 space-y-3">
        {spots.map((spot) => {
          const draft = drafts[spot.key] ?? "";
          const changed = draft.trim() !== (saved[spot.key] ?? "");
          return (
            <li key={spot.key}>
              <label className="block text-xs font-semibold text-slate-700" htmlFor={`spot-note-${spot.key}`}>{spot.name}</label>
              <div className="mt-1 flex gap-2">
                <input
                  id={`spot-note-${spot.key}`}
                  value={draft}
                  maxLength={SPOT_NOTE_MAX}
                  onChange={(e) => setDrafts((d) => ({ ...d, [spot.key]: e.target.value }))}
                  placeholder="Not confirmed yet"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={!changed || busyKey === spot.key}
                  onClick={() => save(spot.key)}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {busyKey === spot.key ? "Saving…" : "Save"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
