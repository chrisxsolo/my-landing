"use client";
// Bulk tagging for the selected photos. Fills only EMPTY fields unless
// "Replace existing values" is on; fields left blank are never touched.
// Also applies high-confidence suggestions and runs AI vision over the
// selection (a few photos per request, resumable — already-analyzed photos
// are skipped by the server).
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card } from "@/app/admin/content-engine/[id]/ui";
import type { AuditedPhoto, TaggingOptions } from "@/lib/photoTagging/types";
import TagFields, { draftToChanges, EMPTY_DRAFT, type TagDraft } from "./TagFields";
import { applySummary, taggingApi } from "./taggingApi";

interface Props {
  photos: readonly AuditedPhoto[];
  options: TaggingOptions;
  onChanged: () => Promise<void> | void;
  onClear: () => void;
}

const MAX_AI_ROUNDS = 100;

function commonSchool(photos: readonly AuditedPhoto[]): string | null {
  const schools = new Set(photos.map((p) => p.school));
  return schools.size === 1 ? [...schools][0] : null;
}

export default function BulkTagBar({ photos, options, onChanged, onClear }: Props) {
  const [draft, setDraft] = useState<TagDraft>(EMPTY_DRAFT);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const keys = photos.map((p) => p.key);
  const anyPortfolio = photos.some((p) => p.source === "portfolio");
  const anyEngine = photos.some((p) => p.source === "engine");
  const grads = draft.category === "grads" || photos.some((p) => p.category === "grads");
  const highCount = photos.filter((p) => p.suggestions.some((s) => s.confidence === "high")).length;
  const needAi = photos.filter((p) => p.status !== "full").length;

  async function run(label: string, action: () => Promise<string>) {
    setBusy(label);
    setMessage(null);
    try {
      setMessage({ text: await action(), ok: true });
      await onChanged();
    } catch (err) {
      console.error("[photo-tagging] bulk action failed", err);
      setMessage({ text: err instanceof Error ? err.message : "update failed", ok: false });
    } finally {
      setBusy(null);
    }
  }

  const apply = () => run("apply", async () => {
    const changes = draftToChanges(draft);
    if (Object.keys(changes).length === 0) return "Pick at least one value to apply";
    const result = await taggingApi.apply(keys, changes, replace);
    setDraft(EMPTY_DRAFT);
    return applySummary(result);
  });

  const applyHigh = () => run("high", async () => applySummary(await taggingApi.applyHigh(keys)));

  const askAi = () => run("ai", async () => {
    let analyzed = 0;
    let found = 0;
    const failures: string[] = [];
    for (let round = 0; round < MAX_AI_ROUNDS; round += 1) {
      const r = await taggingApi.aiSuggest(keys);
      analyzed += r.analyzed.length;
      found += r.suggestions;
      failures.push(...r.failed.map((f) => f.error));
      setMessage({ text: `AI looked at ${analyzed} photo(s) · ${r.remaining} to go…`, ok: true });
      if (r.remaining === 0 || r.analyzed.length + r.failed.length === 0) break;
    }
    const tail = failures.length ? ` · ${failures.length} failed (${failures[0]})` : "";
    return `AI looked at ${analyzed} photo(s) and suggested ${found} tag(s) for your approval${tail}`;
  });

  return (
    <div style={{ ...card, marginBottom: 0, display: "grid", gap: 10, border: `1px solid ${T.amberBorder}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ color: T.ink, fontSize: 14 }}>Tag {photos.length} selected photo(s)</strong>
        <button type="button" style={btn(false)} onClick={onClear}>Clear selection</button>
      </div>
      <TagFields draft={draft} setDraft={setDraft} options={options} allowCategory={anyPortfolio}
        builtInSchoolsOnly={anyPortfolio} currentSchool={commonSchool(photos)} showSchool={grads} />
      {anyEngine && (
        <p style={{ margin: 0, fontSize: 12, color: T.inkSoft }}>
          Content Engine photos take university and location from their session, so those apply to the whole session.
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: T.inkSoft }}>
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Replace existing values
        </label>
        <button type="button" style={btn(true)} disabled={busy !== null} onClick={() => void apply()}>
          {busy === "apply" ? "Applying…" : `Apply to ${photos.length}`}
        </button>
        {highCount > 0 && (
          <button type="button" style={btn(false)} disabled={busy !== null} onClick={() => void applyHigh()}>
            {busy === "high" ? "Applying…" : `Apply high-confidence suggestions (${highCount})`}
          </button>
        )}
        {needAi > 0 && (
          <button type="button" style={btn(false)} disabled={busy !== null} onClick={() => void askAi()}
            title="Only photos still missing a field that no record answers. Each photo is analyzed once.">
            {busy === "ai" ? "AI looking…" : `Ask AI about ${needAi}`}
          </button>
        )}
      </div>
      {message && <p style={{ margin: 0, fontSize: 13, color: message.ok ? T.green : T.red }}>{message.text}</p>}
    </div>
  );
}
