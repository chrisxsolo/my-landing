"use client";
// Section 1 — Session facts (spec §7.4): editable fields; saving commits values.
// Service-aware (2026-07-02): grad-only fields (School) render only for grads;
// couples sessions get vibe / relationship type / outfit styling / best moment
// plus a secondary-location input. Taxonomy-invalid slugs are rejected
// server-side (422) and surfaced inline.
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import {
  SERVICE_TYPES, SCHOOL_SLUGS, LIGHTING_CONDITIONS, VIBES, RELATIONSHIP_TYPES,
} from "@/lib/contentEngine/taxonomy";
import { serviceConfigFor } from "@/lib/contentEngine/serviceConfig";
import { btn, card, input, label, sectionTitle } from "./ui";
import DictationTextarea from "./DictationTextarea";

interface Props {
  session: Record<string, unknown>;
  sessionId: string;
  onSaved: () => void;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as string[]).join(", ") : "");
const pretty = (v: string) => v.replace(/_/g, " ");

export default function FactsSection({ session, sessionId, onSaved }: Props) {
  const [form, setForm] = useState({
    public_display_name: text(session.public_display_name),
    internal_client_name: text(session.internal_client_name),
    service_type: text(session.service_type) || "grads",
    school_slug: text(session.school_slug),
    primary_location: text(session.primary_location),
    secondary_locations: list(session.secondary_locations),
    session_date: text(session.session_date),
    lighting_condition: text(session.lighting_condition),
    vibe: text(session.vibe),
    relationship_type: text(session.relationship_type),
    outfit_styling: text(session.outfit_styling),
    best_moment: text(session.best_moment),
    public_session_summary: text(session.public_session_summary),
    internal_notes: text(session.internal_notes),
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isGrads = form.service_type === "grads";
  const isCouples = form.service_type === "couples";
  const svc = serviceConfigFor(form.service_type);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await engineApi.patchFacts(sessionId, {
        ...form,
        // a non-grad session never keeps a school (grad-only fact)
        school_slug: isGrads ? form.school_slug || null : null,
        lighting_condition: form.lighting_condition || null,
        session_date: form.session_date || null,
        vibe: form.vibe || null,
        relationship_type: form.relationship_type || null,
        secondary_locations: form.secondary_locations
          .split(",").map((s) => s.trim()).filter(Boolean),
      });
      setNotice("Saved.");
      onSaved();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={card}>
      <h2 style={sectionTitle}>Session facts</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <div>
          <span style={label}>Public display name (may appear in published copy)</span>
          <input style={input} value={form.public_display_name} onChange={set("public_display_name")} />
        </div>
        <div>
          <span style={label}>Internal client name (never published)</span>
          <input style={input} value={form.internal_client_name} onChange={set("internal_client_name")} />
        </div>
        <div>
          <span style={label}>Service type</span>
          <select style={input} value={form.service_type} onChange={set("service_type")}>
            {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {isGrads && (
          <div>
            <span style={label}>School</span>
            <select style={input} value={form.school_slug} onChange={set("school_slug")}>
              <option value="">— none —</option>
              {SCHOOL_SLUGS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div>
          <span style={label}>Primary location</span>
          <input style={input} value={form.primary_location} onChange={set("primary_location")}
            placeholder={isCouples ? "e.g. Crissy Field" : undefined} />
        </div>
        {isCouples && (
          <div>
            <span style={label}>Secondary location (optional, comma-separated)</span>
            <input style={input} value={form.secondary_locations} onChange={set("secondary_locations")}
              placeholder="e.g. Lovers Lane" />
          </div>
        )}
        <div>
          <span style={label}>Session date</span>
          <input style={input} type="date" value={form.session_date} onChange={set("session_date")} />
        </div>
        <div>
          <span style={label}>Lighting</span>
          <select style={input} value={form.lighting_condition} onChange={set("lighting_condition")}>
            <option value="">— unknown —</option>
            {LIGHTING_CONDITIONS.map((l) => <option key={l} value={l}>{pretty(l)}</option>)}
          </select>
        </div>
        {isCouples && (
          <>
            <div>
              <span style={label}>Vibe</span>
              <select style={input} value={form.vibe} onChange={set("vibe")}>
                <option value="">— none —</option>
                {VIBES.map((v) => <option key={v} value={v}>{pretty(v)}</option>)}
              </select>
            </div>
            <div>
              <span style={label}>Relationship type</span>
              <select style={input} value={form.relationship_type} onChange={set("relationship_type")}>
                <option value="">— none —</option>
                {RELATIONSHIP_TYPES.map((r) => <option key={r} value={r}>{pretty(r)}</option>)}
              </select>
            </div>
            <div>
              <span style={label}>Outfit / styling</span>
              <input style={input} value={form.outfit_styling} onChange={set("outfit_styling")}
                placeholder="e.g. neutral earth tones, coordinated not matching" />
            </div>
            <div>
              <span style={label}>Best moment</span>
              <input style={input} value={form.best_moment} onChange={set("best_moment")}
                placeholder="e.g. the fog rolled in right at the bridge reveal" />
            </div>
          </>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <span style={label}>Public session summary (may be sent to AI)</span>
        <DictationTextarea value={form.public_session_summary}
          placeholder={svc.summaryPlaceholder}
          onValueChange={(v) => setForm((f) => ({ ...f, public_session_summary: v }))} />
        <span style={label}>Internal notes (never sent to AI, never published)</span>
        <DictationTextarea value={form.internal_notes}
          onValueChange={(v) => setForm((f) => ({ ...f, internal_notes: v }))} />
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <button style={btn(true)} onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save facts"}
        </button>
        {notice && <span style={{ fontSize: 13, color: notice === "Saved." ? T.inkSoft : T.red }}>{notice}</span>}
      </div>
    </section>
  );
}
