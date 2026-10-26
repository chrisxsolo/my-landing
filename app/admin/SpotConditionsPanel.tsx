"use client";

// Admin → Page Photos: light tags and "Gets busy" notes for a school's
// location guide spots. Firsthand knowledge only — a spot shows chips on the
// public guide once you tag it here. Same vocabulary as the Bay Area library.

import { useEffect, useRef, useState } from "react";
import type { SpotOption } from "@/lib/pagePhotos/adminView";
import { CROWD_NOTE_MAX, LIGHT_TAGS } from "@/lib/photoConditions";

const API = "/api/admin/school-spot-conditions";

type Condition = { lightTags: string[]; crowdNote: string | null };
type Draft = { lightTags: string[]; crowdNote: string };
type Props = {
  school: string;
  spots: SpotOption[];
  showToast: (message: string, ok?: boolean) => void;
};

const toDraft = (c: Condition | undefined): Draft => ({ lightTags: c?.lightTags ?? [], crowdNote: c?.crowdNote ?? "" });
const sameDraft = (a: Draft, b: Draft) =>
  a.crowdNote.trim() === b.crowdNote.trim() && a.lightTags.slice().sort().join() === b.lightTags.slice().sort().join();

function SpotRow({ name, draft, saved, busy, onChange, onSave }: {
  name: string; draft: Draft; saved: Draft; busy: boolean; onChange: (d: Draft) => void; onSave: () => void;
}) {
  const toggle = (tag: string) => onChange({
    ...draft, lightTags: draft.lightTags.includes(tag) ? draft.lightTags.filter((t) => t !== tag) : [...draft.lightTags, tag],
  });
  return (
    <li className="rounded-lg border border-slate-100 p-3">
      <p className="text-xs font-semibold text-slate-700">{name}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {LIGHT_TAGS.map((t) => {
          const on = draft.lightTags.includes(t.value);
          return (
            <button key={t.value} type="button" aria-pressed={on} onClick={() => toggle(t.value)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? "border-transparent bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600"}`}>
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          aria-label={`${name}: when it gets busy`}
          value={draft.crowdNote}
          maxLength={CROWD_NOTE_MAX}
          onChange={(e) => onChange({ ...draft, crowdNote: e.target.value })}
          placeholder="Gets busy? e.g. Packed after commencement; go before 10am"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="button" disabled={sameDraft(draft, saved) || busy} onClick={onSave}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </li>
  );
}

export default function SpotConditionsPanel({ school, spots, showToast }: Props) {
  const [saved, setSaved] = useState<Record<string, Condition> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
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
        if (!res.ok) throw new Error(json.error ?? "Could not load spot conditions");
        if (live) { setSaved(json.conditions); setDrafts({}); }
      })
      .catch((err) => {
        console.error("[spot-conditions] load failed", err);
        if (live) toastRef.current(err instanceof Error ? err.message : "Could not load spot conditions", false);
      });
    return () => { live = false; };
  }, [school]);

  async function save(spotKey: string, draft: Draft) {
    setBusyKey(spotKey);
    try {
      const res = await fetch(API, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, spotKey, lightTags: draft.lightTags, crowdNote: draft.crowdNote }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSaved(json.conditions);
      setDrafts((all) => Object.fromEntries(Object.entries(all).filter(([key]) => key !== spotKey)));
      showToast(json.conditions[spotKey] ? "Conditions saved — they now show on the guide." : "Conditions cleared.");
    } catch (err) {
      console.error("[spot-conditions] save failed", err);
      showToast(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      setBusyKey(null);
    }
  }

  if (!saved) return null;
  return (
    <details className="mb-5 max-w-3xl rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-bold text-slate-800">
        Light &amp; crowds per guide spot <span className="font-normal text-slate-500">({Object.keys(saved).length} of {spots.length} set)</span>
      </summary>
      <p className="mt-2 text-xs text-slate-500">
        Optional. Light tags show as chips under the spot&apos;s name; a crowd note shows as a &ldquo;Gets busy&rdquo; line.
        Only tag what you&apos;ve seen yourself — untagged spots show nothing.
      </p>
      <ul className="mt-3 space-y-3">
        {spots.map((spot) => {
          const savedDraft = toDraft(saved[spot.key]);
          return (
            <SpotRow key={spot.key} name={spot.name} draft={drafts[spot.key] ?? savedDraft} saved={savedDraft}
              busy={busyKey === spot.key} onChange={(d) => setDrafts((all) => ({ ...all, [spot.key]: d }))}
              onSave={() => save(spot.key, drafts[spot.key] ?? savedDraft)} />
          );
        })}
      </ul>
    </details>
  );
}
