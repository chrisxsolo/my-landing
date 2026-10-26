"use client";
// One location: publish controls, hero, AI profile, editorial fields, its
// sessions and photos, plus connections (add a session, merge a duplicate,
// related pages). Every change round-trips through the API and re-renders
// from the server's answer, so the screen always shows what is saved.
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card } from "@/app/admin/content-engine/[id]/ui";
import { regionLabel } from "@/lib/locationLibrary/taxonomy";
import { libraryApi, type Detail, type DetailPhotoDto, type Overview } from "./locationLibraryApi";
import LocationFieldsEditor from "./LocationFieldsEditor";
import LocationSessionsPanel, { type SessionOp } from "./LocationSessionsPanel";
import LocationConnections from "./LocationConnections";
import { HERO_LABEL, Muted, STATUS_CHIP, formatWhen, selectStyle } from "./libraryUi";

function HeroPreview({ detail }: { detail: Detail }) {
  return (
    <div style={{ width: 180, aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden", background: T.inset, flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, already a resized render URL */}
      {detail.hero ? <img src={detail.hero.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <Muted style={{ padding: 12 }}>No public photo yet</Muted>}
    </div>
  );
}

function PlacePicker({ overview, busy, onPick }: { overview: Overview; busy: boolean; onPick: (key: string) => void }) {
  const free = overview.places.filter((p) => !p.hasLocation);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <Muted>Not linked to a verified place — sessions can only match it by hand.</Muted>
      <select defaultValue="" disabled={busy} style={selectStyle} onChange={(e) => e.target.value && onPick(e.target.value)}>
        <option value="">Link to a place…</option>
        {free.map((p) => <option key={p.key} value={p.key}>{p.name} · {p.city}</option>)}
      </select>
    </div>
  );
}

function Header({ detail, overview, busy, onPatch, onRegenerate, onDelete, onBack }: {
  detail: Detail; overview: Overview; busy: boolean;
  onPatch: (b: Record<string, unknown>) => void; onRegenerate: () => void; onDelete: () => void; onBack: () => void;
}) {
  const { row, location } = detail;
  const status = STATUS_CHIP[location.status];
  const heroSource = detail.hero?.source;
  return (
    <section style={card}>
      <button type="button" onClick={onBack} style={{ ...btn(), marginBottom: 12 }}>← All locations</button>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <HeroPreview detail={detail} />
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontFamily: T.display, fontSize: 24, color: T.ink }}>{row.title.trim()}</h1>
            <span style={status.style}>{status.label}</span>
          </div>
          <Muted style={{ marginTop: 4 }}>
            {row.city.trim()} · {regionLabel(row.region)} · {location.sessionCount} session{location.sessionCount === 1 ? "" : "s"} · {location.photoCount} public photos
            {detail.place ? ` · place: ${detail.place.name} (${detail.place.county})` : ""}
          </Muted>
          <Muted style={{ marginTop: 4 }}>
            Hero: {heroSource ? HERO_LABEL[heroSource] : "none"} · AI profile: {row.ai_generated_at ? formatWhen(row.ai_generated_at) : "not run"}
            {row.ai_error ? <span style={{ color: T.red }}> · last AI run failed: {row.ai_error}</span> : null}
          </Muted>
          {!detail.place ? <PlacePicker overview={overview} busy={busy} onPick={(key) => onPatch({ location_key: key })} /> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {row.active
              ? <button type="button" style={btn()} disabled={busy} onClick={() => onPatch({ active: false })}>Unpublish</button>
              : <button type="button" style={btn(true)} disabled={busy} onClick={() => onPatch({ active: true })}>Publish</button>}
            {!row.active && row.needs_review
              ? <button type="button" style={btn()} disabled={busy} onClick={() => onPatch({ needs_review: false })}>Mark reviewed</button> : null}
            <button type="button" style={btn()} disabled={busy || !detail.place} onClick={onRegenerate}>Regenerate AI text</button>
            {heroSource === "featured_photo"
              ? <button type="button" style={btn()} disabled={busy} onClick={() => onPatch({ featured_photo_id: null })}>Automatic hero</button> : null}
            {heroSource === "manual_image"
              ? <button type="button" style={btn()} disabled={busy} onClick={() => onPatch({ clear_manual_image: true })}>Stop using the manual photo</button> : null}
            {location.sessionCount === 0 && detail.sessions.length === 0
              ? <button type="button" style={btn(false, true)} disabled={busy} onClick={onDelete}>Delete</button> : null}
            <a href={`/bay-area-locations#${row.slug}`} target="_blank" rel="noreferrer" style={{ ...btn(), textDecoration: "none" }}>View on site ↗</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LocationDetail({ id, overview, onBack, onChanged, onNotice }: {
  id: number; overview: Overview; onBack: () => void; onChanged: () => void;
  onNotice: (msg: string, ok?: boolean) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    libraryApi.detail(id).then(setDetail).catch((err) => onNotice(err instanceof Error ? err.message : "could not load", false));
  }, [id, onNotice]);

  const run = useCallback(async (work: () => Promise<Detail | null>, ok: string) => {
    setBusy(true);
    try {
      const next = await work();
      if (next) setDetail(next);
      onNotice(ok);
      onChanged();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "something went wrong", false);
    } finally {
      setBusy(false);
    }
  }, [onChanged, onNotice]);

  if (!detail) return <div style={card}><Muted>Loading…</Muted></div>;

  const patch = (body: Record<string, unknown>) => run(() => libraryApi.patch(id, body), "Saved");
  const action = (body: Record<string, unknown>, ok: string) =>
    run(async () => {
      const res = await libraryApi.action(id, body);
      if (res.message) onNotice(res.message);
      return res.detail;
    }, ok);
  const setHero = (p: DetailPhotoDto) => {
    if (p.state === "not_public" && !window.confirm("This photo has no public web copy yet. Publish it and use it as the hero?")) return;
    void patch({ featured_photo_id: p.id, approve: p.state === "not_public" });
  };
  const op = (o: SessionOp) => action(o, "Updated");
  const remove = () => {
    if (!window.confirm("Delete this location? This cannot be undone.")) return;
    void run(async () => { await libraryApi.remove(id); onBack(); return null; }, "Deleted");
  };
  const others = overview.locations.filter((l) => l.id !== id);

  return (
    <div>
      <Header detail={detail} overview={overview} busy={busy} onPatch={(b) => void patch(b)}
        onRegenerate={() => void action({ action: "regenerate" }, "AI text updated")} onDelete={remove} onBack={onBack} />
      <LocationFieldsEditor key={`${detail.row.updated_at}|${detail.row.locked_fields.join(",")}`}
        row={detail.row} sessions={detail.sessions} busy={busy} onSave={patch} />
      <LocationSessionsPanel sessions={detail.sessions} heroId={detail.hero?.photoId ?? null}
        featuredSessionId={detail.row.featured_session_id} busy={busy} others={others}
        onFeaturedSession={(sessionId) => void patch({ featured_session_id: sessionId })}
        onHero={setHero} onOp={(o) => void op(o)} />
      <LocationConnections detail={detail} overview={overview} busy={busy}
        onAttach={(sessionId) => void op({ action: "attach_session", sessionId })}
        onMerge={(sourceId) => {
          const source = others.find((o) => o.id === sourceId);
          if (window.confirm(`Merge "${source?.title}" into this location? Its sessions move here and it is deleted.`)) {
            void action({ action: "merge", sourceId }, "Merged");
          }
        }} />
    </div>
  );
}
