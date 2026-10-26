"use client";
// Location panel: where the engine thinks this session was photographed, how
// it knows, and which guide page covers that place. When the place can't be
// identified it asks — the engine never guesses from scenery.
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import type { LocationSummaryDto, PlaceDto } from "@/app/admin/content-engine/engineTypes";
import { btn, card, chip, input, label, sectionTitle } from "./ui";

const SOURCE_LABEL = { session_location: "from the session location", gps: "from photo GPS" } as const;

function GuideStatus({ s, sessionId }: { s: LocationSummaryDto; sessionId: string }) {
  if (!s.guide) return <p style={{ margin: 0, fontSize: 13, color: T.inkSoft }}>This session type has no location guide.</p>;
  if (s.existingGuide) {
    return (
      <p style={{ margin: 0, fontSize: 13 }}>
        Guide page: <a href={s.existingGuide.url} target="_blank" rel="noreferrer" style={{ color: T.blue }}>{s.existingGuide.url}</a>
        <span style={{ color: T.inkFaint }}> ({s.existingGuide.source === "static" ? "hand-written" : "published from the engine"})</span>
      </p>
    );
  }
  const open = s.openProposal;
  return (
    <p style={{ margin: 0, fontSize: 13 }}>
      <span style={chip(T.amber, T.amberBg)}>New location</span>{" "}
      No {s.guide} guide covers this place yet.{" "}
      {open
        ? open.sessionId === sessionId
          ? <>A guide for <code>{s.proposedGuide?.url}</code> is in review below ({open.status}).</>
          : <>A proposal from <a href={`/admin/content-engine/${open.sessionId}`} style={{ color: T.blue }}>another session</a> is in review ({open.status}).</>
        : <>The guide step will propose one at <code>{s.proposedGuide?.url}</code>.</>}
    </p>
  );
}

function ConfirmForm({ s, onSubmit, busy }: {
  s: LocationSummaryDto; onSubmit: (body: Record<string, unknown>) => void; busy: boolean;
}) {
  const [name, setName] = useState(s.sessionLocation ?? "");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [searchArea, setSearchArea] = useState("");
  const missing = [!name.trim() && "place name", !city.trim() && "city", !county.trim() && "county"].filter(Boolean);
  const disabled = missing.length > 0 || busy;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginTop: 8 }}>
      <div><span style={label}>Place name</span><input style={input} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><span style={label}>City / nearest town</span><input style={input} value={city} placeholder="e.g. Davenport" onChange={(e) => setCity(e.target.value)} /></div>
      <div><span style={label}>County</span><input style={input} value={county} placeholder="e.g. Santa Cruz County" onChange={(e) => setCounty(e.target.value)} /></div>
      <div><span style={label}>Searched as (optional)</span><input style={input} value={searchArea} placeholder="e.g. Santa Cruz" onChange={(e) => setSearchArea(e.target.value)} /></div>
      <button style={{ ...btn(true), alignSelf: "end", ...(disabled ? { opacity: 0.45, cursor: "not-allowed", boxShadow: "none" } : {}) }}
        disabled={disabled}
        onClick={() => onSubmit({ action: "confirm_new", name, city, county, searchArea })}>
        {busy ? "Saving…" : "Confirm location"}
      </button>
      {missing.length > 0 && (
        <span style={{ alignSelf: "center", fontSize: 12, color: T.inkFaint }}>Fill in the {missing.join(" and ")} to confirm.</span>
      )}
    </div>
  );
}

function Candidates({ places, onPick, busy }: { places: PlaceDto[]; onPick: (key: string) => void; busy: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      {places.map((p) => (
        <button key={p.key} style={btn(false)} disabled={busy} onClick={() => onPick(p.key)}>
          It&rsquo;s {p.name} ({p.city})
        </button>
      ))}
    </div>
  );
}

export default function LocationPanel({ sessionId, primaryLocation }: {
  sessionId: string; primaryLocation: string | null;
}) {
  const [summary, setSummary] = useState<LocationSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSummary(await engineApi.getLocation(sessionId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load location");
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load, primaryLocation]);

  const confirm = async (body: Record<string, unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await engineApi.confirmLocation(sessionId, body);
      setSummary(res.summary);
      setNotice("Location verified. Run the guide step again to place photos or propose a guide.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save location");
    } finally {
      setBusy(false);
    }
  };

  if (!summary) {
    return error ? <section style={card}><p style={{ color: T.red, margin: 0 }}>{error}</p></section> : null;
  }
  const verified = summary.status === "verified";
  return (
    <section style={card}>
      <h2 style={sectionTitle}>Location</h2>
      <p style={{ margin: "0 0 8px", fontSize: 14 }}>
        <span style={chip(verified ? T.green : T.amber, verified ? T.greenBg : T.amberBg)}>
          {verified ? "Verified" : "Needs confirmation"}
        </span>{" "}
        {verified
          ? <><strong>{summary.message}</strong> <span style={{ color: T.inkFaint }}>{summary.source ? SOURCE_LABEL[summary.source] : ""}</span></>
          : summary.message}
      </p>
      {verified && <GuideStatus s={summary} sessionId={sessionId} />}
      {!verified && summary.candidates.length > 0 && summary.sessionLocation && (
        <Candidates places={summary.candidates} busy={busy} onPick={(key) => void confirm({ action: "link_existing", key })} />
      )}
      {!verified && summary.reason === "unrecognized" && <ConfirmForm s={summary} busy={busy} onSubmit={(b) => void confirm(b)} />}
      {!verified && summary.visualHints.length > 0 && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: T.inkFaint }}>
          Photos show: {summary.visualHints.join(", ")} — a hint only, never used to identify the place.
        </p>
      )}
      {notice && <p style={{ margin: "8px 0 0", fontSize: 12, color: T.green }}>{notice}</p>}
      {error && <p style={{ margin: "8px 0 0", fontSize: 12, color: T.red }}>{error}</p>}
    </section>
  );
}
