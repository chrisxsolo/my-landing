"use client";
// Section 1 — Session facts (spec §7.4): editable fields; saving commits values.
// Taxonomy-invalid slugs are rejected server-side (422) and surfaced inline.
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { SERVICE_TYPES, SCHOOL_SLUGS, LIGHTING_CONDITIONS } from "@/lib/contentEngine/taxonomy";
import { btn, card, input, label, sectionTitle } from "./ui";
import DictationTextarea from "./DictationTextarea";

interface Props {
  session: Record<string, unknown>;
  sessionId: string;
  onSaved: () => void;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

export default function FactsSection({ session, sessionId, onSaved }: Props) {
  const [form, setForm] = useState({
    public_display_name: text(session.public_display_name),
    internal_client_name: text(session.internal_client_name),
    service_type: text(session.service_type) || "grads",
    school_slug: text(session.school_slug),
    primary_location: text(session.primary_location),
    session_date: text(session.session_date),
    lighting_condition: text(session.lighting_condition),
    public_session_summary: text(session.public_session_summary),
    internal_notes: text(session.internal_notes),
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await engineApi.patchFacts(sessionId, {
        ...form,
        school_slug: form.school_slug || null,
        lighting_condition: form.lighting_condition || null,
        session_date: form.session_date || null,
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
        <div>
          <span style={label}>School</span>
          <select style={input} value={form.school_slug} onChange={set("school_slug")}>
            <option value="">— none —</option>
            {SCHOOL_SLUGS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>Primary location</span>
          <input style={input} value={form.primary_location} onChange={set("primary_location")} />
        </div>
        <div>
          <span style={label}>Session date</span>
          <input style={input} type="date" value={form.session_date} onChange={set("session_date")} />
        </div>
        <div>
          <span style={label}>Lighting</span>
          <select style={input} value={form.lighting_condition} onChange={set("lighting_condition")}>
            <option value="">— unknown —</option>
            {LIGHTING_CONDITIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <span style={label}>Public session summary (may be sent to AI)</span>
        <DictationTextarea value={form.public_session_summary}
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
