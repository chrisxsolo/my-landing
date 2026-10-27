"use client";
// The photo inspector for one photo: where it CAN appear (each public
// destination with its status and reason), where it DOES appear (every
// placement, with remove / replace here), and where it can be added. Loaded
// on demand from /api/admin/photo-distribution; every edit goes back through
// that route's POST, which edits exactly one placement.
import { useState } from "react";
import Link from "next/link";
import { T } from "@/app/admin/adminTheme";
import { btn } from "@/app/admin/content-engine/[id]/ui";
import ExistingPhotoPicker, { type PickerResult } from "@/app/admin/ExistingPhotoPicker";
import PlacementRow from "@/app/admin/photoDistribution/PlacementRow";
import {
  DISTRIBUTION_STATUS_LABELS, type Destination, type DistributionStatus,
} from "@/lib/photoSync/distribution";
import type { AddOption, DistributionPhoto } from "@/lib/photoSync/distributionLoad";
import type { Placement } from "@/lib/photoSync/placements";

const PATH = "/api/admin/photo-distribution";

const TONE: Record<DistributionStatus, { color: string; bg: string }> = {
  displayed: { color: T.green, bg: T.greenBg },
  eligible: { color: T.blue, bg: T.blueBg },
  review: { color: T.amber, bg: T.amberBg },
  "not-eligible": { color: T.inkFaint, bg: T.neutralBg },
};

interface Loaded {
  photo: DistributionPhoto;
  destinations: Destination[];
  placements: Placement[];
  addOptions: AddOption[];
  errors: string[];
}

/** One of the two is required: the tagging audit's photo key, or a photo URL (older journal images). */
interface Props {
  photoKey?: string;
  url?: string;
  /** Called after a placement edit so the surrounding list can refresh. */
  onChanged?: () => void | Promise<void>;
}

const heading = (text: string) => (
  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.4 }}>{text}</p>
);

function DestinationRow({ d }: { d: Destination }) {
  const tone = TONE[d.status];
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 12 }}>
      <span style={{ padding: "1px 8px", borderRadius: 999, background: tone.bg, color: tone.color, fontWeight: 700, flexShrink: 0 }}>
        {DISTRIBUTION_STATUS_LABELS[d.status]}
      </span>
      <span style={{ color: T.ink, fontWeight: 700 }}>
        {d.path ? <a href={d.path} target="_blank" rel="noreferrer" style={{ color: T.ink }}>{d.label}</a> : d.label}
      </span>
      <span style={{ color: T.inkSoft, flex: "1 1 200px" }}>{d.reason}</span>
      <Link href={d.editorHref} style={{ color: T.blue, fontWeight: 700, textDecoration: "none" }}>Edit →</Link>
    </li>
  );
}

function AddPicker({ options, busy, onAdd }: { options: AddOption[]; busy: boolean; onAdd: (option: AddOption) => void }) {
  const [index, setIndex] = useState(0);
  if (options.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <select value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label="Add this photo to"
        style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inset, color: T.ink, maxWidth: 320 }}>
        {options.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
      </select>
      <button type="button" style={{ ...btn(false), padding: "3px 10px", fontSize: 12, minHeight: 0 }} disabled={busy} onClick={() => onAdd(options[index])}>
        Add here
      </button>
    </div>
  );
}

async function request(init: RequestInit & { query?: string }): Promise<Record<string, unknown>> {
  const res = await fetch(`${PATH}${init.query ?? ""}`, { credentials: "include", ...init });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `request failed (${res.status})`);
  return body;
}

export default function DistributionPreview({ photoKey, url, onChanged }: Props) {
  const [state, setState] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState<Placement | null>(null);
  const query = photoKey ? `?key=${encodeURIComponent(photoKey)}` : `?url=${encodeURIComponent(url ?? "")}`;

  async function load() {
    setBusy(true);
    setError(null);
    try {
      setState((await request({ query })) as unknown as Loaded);
    } catch (err) {
      console.error("[photo-distribution] load failed", err);
      setError(err instanceof Error ? err.message : "Could not load where this photo appears");
    } finally {
      setBusy(false);
    }
  }

  async function edit(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const result = await request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setNotice(typeof result.message === "string" ? result.message : "Done");
      await load();
      await onChanged?.();
    } catch (err) {
      console.error("[photo-distribution] edit failed", err);
      setError(err instanceof Error ? err.message : "Could not edit the placement");
      setBusy(false);
    }
  }

  const photoUrl = state?.photo.url ?? null;
  const remove = (p: Placement) => {
    if (!photoUrl || !confirm(`Remove this photo from ${p.name}? Nothing else changes and the photo itself is kept.`)) return;
    void edit({ action: "remove", target: p.target, url: photoUrl });
  };
  const replaced = (p: Placement, pick: PickerResult) => {
    setReplacing(null);
    if (!photoUrl || !pick.url) return;
    void edit({ action: "replace", target: p.target, url: photoUrl, newUrl: pick.url, newAlt: pick.alt });
  };

  if (!state) {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <button type="button" style={{ ...btn(false), justifySelf: "start", padding: "3px 10px", fontSize: 12 }} disabled={busy} onClick={() => void load()}>
          {busy ? "Checking…" : "Where does this photo appear?"}
        </button>
        {error && <span style={{ fontSize: 12, color: T.red }}>{error}</span>}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {state.errors.length > 0 && (
        <span style={{ fontSize: 12, color: T.amber }}>Some data could not be read, so a status may be incomplete: {state.errors.join("; ")}</span>
      )}
      {error && <span style={{ fontSize: 12, color: T.red }}>{error}</span>}
      {notice && !error && <span style={{ fontSize: 12, color: T.green }}>{notice}</span>}
      {heading("Where it can appear")}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {state.destinations.map((d) => <DestinationRow key={d.id} d={d} />)}
      </ul>
      {heading(`Where it appears now (${state.placements.length})`)}
      {state.placements.length === 0 && <span style={{ fontSize: 12, color: T.inkSoft }}>Not placed anywhere yet.</span>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {state.placements.map((p) => (
          <PlacementRow key={p.id} placement={p} busy={busy} onRemove={() => remove(p)} onReplace={() => setReplacing(p)} />
        ))}
      </ul>
      {state.addOptions.length > 0 && heading("Add it somewhere it is eligible")}
      <AddPicker options={state.addOptions} busy={busy} onAdd={(o) => photoUrl && void edit({ action: "add", target: o.target, url: photoUrl })} />
      {replacing && (
        <ExistingPhotoPicker
          target={{ library: true, label: replacing.name }}
          mode="pick"
          school={state.photo.school ?? undefined}
          onClose={() => setReplacing(null)}
          onDone={(pick) => replaced(replacing, pick)}
          showToast={(message, ok) => (ok === false ? setError(message) : setNotice(message))}
        />
      )}
    </div>
  );
}
