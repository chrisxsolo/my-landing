"use client";
// Admin → Content Engine → Locations: the Bay Area location library. Used by
// the standalone route and by the Bay Guide tab in the main admin.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { checkAuth } from "@/lib/adminAuth";
import { btn, card, input as inputStyle, overlay } from "@/app/admin/content-engine/[id]/ui";
import { LIBRARY_REGIONS } from "@/lib/locationLibrary/taxonomy";
import { libraryApi, type Overview } from "./locationLibraryApi";
import LocationTable from "./LocationTable";
import LocationSyncPanel from "./LocationSyncPanel";
import LocationDetail from "./LocationDetail";
import { Muted, Notice, selectStyle } from "./libraryUi";

function CreateDialog({ overview, onClose, onCreated, onNotice }: {
  overview: Overview; onClose: () => void; onCreated: (id: number) => void; onNotice: (m: string, ok?: boolean) => void;
}) {
  const [placeKey, setPlaceKey] = useState("");
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("san-francisco");
  const [busy, setBusy] = useState(false);
  const free = overview.places.filter((p) => !p.hasLocation);

  async function create() {
    setBusy(true);
    try {
      const { id } = await libraryApi.create(placeKey ? { placeKey } : { title, city, region });
      onCreated(id);
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "could not create", false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...card, background: T.panelSolid, width: "min(520px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 8px", fontFamily: T.display, color: T.ink }}>New location</h2>
        <Muted style={{ marginBottom: 10 }}>Pick a verified place (sessions there will match it automatically), or add a custom one.</Muted>
        <select value={placeKey} onChange={(e) => setPlaceKey(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
          <option value="">Custom location…</option>
          {free.map((p) => <option key={p.key} value={p.key}>{p.name} · {p.city}</option>)}
        </select>
        {!placeKey ? (
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Location name" style={inputStyle} />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={inputStyle} />
            <select value={region} onChange={(e) => setRegion(e.target.value)} style={selectStyle}>
              {LIBRARY_REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button type="button" style={btn()} onClick={onClose}>Cancel</button>
          <button type="button" style={btn(true)} disabled={busy || (!placeKey && (!title.trim() || !city.trim()))} onClick={create}>
            {busy ? "Creating…" : "Create draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LocationLibrary({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);

  const showNotice = useCallback((msg: string, ok = true) => {
    setNotice({ msg, ok });
    if (!ok) console.error("[locations]", msg);
    window.setTimeout(() => setNotice((n) => (n?.msg === msg ? null : n)), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      setOverview(await libraryApi.overview());
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "could not load locations", false);
    }
  }, [showNotice]);

  useEffect(() => {
    if (!embedded && !checkAuth()) {
      router.replace("/admin");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount; pattern matches EngineDashboard
    void load();
  }, [embedded, router, load]);

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: embedded ? 0 : "20px 16px 60px" }}>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {selected !== null && overview ? (
        <LocationDetail id={selected} overview={overview} onBack={() => setSelected(null)}
          onChanged={() => void load()} onNotice={showNotice} />
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h1 style={{ margin: 0, fontFamily: T.display, fontSize: 26, color: T.ink }}>Locations</h1>
              <Muted>
                The Bay Area location guide, fed by the Content Engine. One card per place; new places arrive as drafts for review.{" "}
                <Link href="/bay-area-locations" target="_blank" style={{ color: T.action }}>View public guide ↗</Link>
              </Muted>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {!embedded ? <Link href="/admin/content-engine" style={{ ...btn(), textDecoration: "none" }}>← Sessions</Link> : null}
              <button type="button" style={btn(true)} disabled={!overview} onClick={() => setCreating(true)}>+ New location</button>
            </div>
          </div>
          {overview ? (
            <>
              <LocationTable locations={overview.locations} onOpen={setSelected} />
              <LocationSyncPanel sessions={overview.sessions} lastSyncedAt={overview.lastSyncedAt}
                onChanged={() => void load()} onNotice={showNotice} />
            </>
          ) : <div style={card}><Muted>Loading…</Muted></div>}
        </>
      )}
      {creating && overview ? (
        <CreateDialog overview={overview} onClose={() => setCreating(false)} onNotice={showNotice}
          onCreated={(id) => { setCreating(false); void load(); setSelected(id); }} />
      ) : null}
    </div>
  );
}
