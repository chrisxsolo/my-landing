"use client";
// Tag editor for one photo, opened from its status badge: what is present /
// missing / not applicable, suggestions to accept or dismiss, the tag inputs,
// "not applicable" marks, and an on-demand AI look for what records can't answer.
import { useState } from "react";
import Link from "next/link";
import { T } from "@/app/admin/adminTheme";
import { btn, card } from "@/app/admin/content-engine/[id]/ui";
import { pagePath } from "@/lib/pagePhotos/pageKeys";
import {
  categoryLabel, type AuditedPhoto, type NotApplicableField, type TagCheck, type TaggingOptions, type TagSuggestion,
} from "@/lib/photoTagging/types";
import SuggestionList from "./SuggestionList";
import TagFields, { draftToChanges, EMPTY_DRAFT, type TagDraft } from "./TagFields";
import TagStatusBadge from "./TagStatusBadge";
import { applySummary, taggingApi } from "./taggingApi";

const FIELD_LABEL: Record<TagCheck["field"], string> = {
  category: "Category", school: "University", location: "Location", spot: "Campus spot",
};
const STATE_TONE: Record<TagCheck["state"], string> = { ok: T.green, missing: T.amber, na: T.inkFaint };

interface Props {
  photo: AuditedPhoto;
  options: TaggingOptions;
  onChanged: () => Promise<void> | void;
  onClose: () => void;
}

function CheckRow({ check }: { check: TagCheck }) {
  const color = check.state === "missing" && check.critical ? T.red : STATE_TONE[check.state];
  const text = check.state === "ok" ? `${check.value}${check.source ? ` · from ${check.source}` : ""}`
    : check.state === "missing" ? `Missing — ${check.note}` : `Not applicable — ${check.note}`;
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "baseline" }}>
      <span style={{ width: 92, color: T.inkFaint, fontWeight: 700, flexShrink: 0 }}>{FIELD_LABEL[check.field]}</span>
      <span style={{ color }}>{text}{check.state === "ok" && check.note ? ` (${check.note})` : ""}</span>
    </div>
  );
}

export default function PhotoTagEditor({ photo, options, onChanged, onClose }: Props) {
  const [draft, setDraft] = useState<TagDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const check = (field: TagCheck["field"]) => photo.checks.find((c) => c.field === field);
  const isEngine = photo.source === "engine";
  const grads = (draft.category || photo.category) === "grads";

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ text: await action(), ok: true });
      await onChanged();
    } catch (err) {
      console.error("[photo-tagging] editor action failed", err);
      setMessage({ text: err instanceof Error ? err.message : "update failed", ok: false });
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(async () => {
    const changes = draftToChanges(draft);
    if (Object.keys(changes).length === 0) return "Nothing to save — pick a value first";
    const result = await taggingApi.apply([photo.key], changes, true);
    setDraft(EMPTY_DRAFT);
    return applySummary(result);
  });
  const accept = (s: TagSuggestion) => run(async () => applySummary(await taggingApi.apply([photo.key], { [s.field]: s.value }, false)));
  const dismiss = (s: TagSuggestion) => run(async () => { await taggingApi.dismiss(photo.key, s.id); return "Suggestion dismissed"; });
  const markNa = (field: NotApplicableField, on: boolean) =>
    run(async () => { await taggingApi.markNotApplicable([photo.key], field, on); return on ? "Marked not applicable" : "Mark removed"; });
  const askAi = () => run(async () => {
    const r = await taggingApi.aiSuggest([photo.key], photo.aiAnalyzedAt !== null);
    if (r.failed.length) throw new Error(r.failed[0].error);
    if (r.analyzed.length === 0) return "Nothing for AI to look at — every missing field already has an answer";
    return r.suggestions > 0 ? `AI suggested ${r.suggestions} tag(s) — review them above` : "AI found nothing it could identify with confidence";
  });

  const naField = (field: NotApplicableField) => {
    const c = check(field);
    const marked = c?.state === "na" && c.note === "marked not applicable";
    if (!marked && c?.state !== "missing") return null;
    return (
      <button type="button" style={{ ...btn(false), padding: "3px 10px", fontSize: 12 }} disabled={busy}
        onClick={() => void markNa(field, !marked)}>
        {marked ? `Undo "no ${field}"` : `No ${field === "spot" ? "campus spot" : "location"} applies`}
      </button>
    );
  };

  return (
    <div style={{ ...card, marginBottom: 0, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <TagStatusBadge photo={photo} />
          <span style={{ color: T.ink, fontWeight: 700, fontSize: 14 }}>{photo.title}</span>
          <span style={{ color: T.inkFaint, fontSize: 12 }}>
            {isEngine ? "Content Engine" : `Portfolio #${photo.portfolioId}`} · {categoryLabel(photo.category)} · {photo.published ? "public" : "not public"}
          </span>
        </div>
        <button type="button" style={btn(false)} onClick={onClose}>Close</button>
      </div>

      <div style={{ display: "grid", gap: 4 }}>{photo.checks.map((c) => <CheckRow key={c.field} check={c} />)}</div>

      {photo.pages.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: T.inkSoft }}>
          Eligible for: {photo.pages.map((k) => pagePath(k) ?? k).join(" · ")}
        </p>
      )}
      {photo.sessionId && (
        <p style={{ margin: 0, fontSize: 12, color: T.inkSoft }}>
          Session: <Link href={`/admin/content-engine/${photo.sessionId}`} style={{ color: T.blue }}>{photo.sessionName ?? "open"}</Link>
          {isEngine ? " — university and location apply to every photo of this session" : ""}
        </p>
      )}

      <SuggestionList suggestions={photo.suggestions} busy={busy} onAccept={(s) => void accept(s)} onDismiss={(s) => void dismiss(s)} />

      <TagFields draft={draft} setDraft={setDraft} options={options} allowCategory={!isEngine}
        builtInSchoolsOnly={!isEngine} currentSchool={photo.school} showSchool={grads}
        current={{ category: categoryLabel(photo.category), school: check("school")?.state === "ok" ? check("school")?.value ?? "" : "",
          location: check("location")?.state === "ok" ? check("location")?.value ?? "" : "",
          spot: check("spot")?.state === "ok" ? check("spot")?.value ?? "" : "" }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={btn(true)} disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save tags"}</button>
        {naField("location")}
        {grads && naField("spot")}
        {photo.status !== "full" && (
          <button type="button" style={btn(false)} disabled={busy} onClick={() => void askAi()}
            title="Looks at the photo for signage or a unique landmark. Suggestions always need your approval.">
            {photo.aiAnalyzedAt ? "Ask AI again" : "Ask AI to identify"}
          </button>
        )}
      </div>
      {message && <p style={{ margin: 0, fontSize: 13, color: message.ok ? T.green : T.red }}>{message.text}</p>}
    </div>
  );
}
