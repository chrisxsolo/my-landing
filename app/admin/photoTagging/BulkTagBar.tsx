"use client";
// Bulk tagging for the selected photos. Fills only EMPTY fields unless
// "Replace existing values" is on; fields left blank are never touched.
// Every bulk write is previewed first (what changes, what is kept, and how
// many OTHER photos a session-wide university reaches) and saved only on
// confirmation; Undo restores the previous values. Also applies
// high-confidence suggestions and runs AI vision over the selection (a few
// photos per request, resumable — already-analyzed photos are skipped).
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card } from "@/app/admin/content-engine/[id]/ui";
import type { AuditedPhoto, TaggingOptions } from "@/lib/photoTagging/types";
import TagApplyPanel from "./TagApplyPanel";
import TagFields, { draftToChanges, EMPTY_DRAFT, type TagDraft } from "./TagFields";
import { taggingApi } from "./taggingApi";
import { useTagApply } from "./useTagApply";

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
  const tagApply = useTagApply(onChanged);
  const { busy, showToast } = tagApply;
  const keys = photos.map((p) => p.key);
  const anyPortfolio = photos.some((p) => p.source === "portfolio");
  const anyEngine = photos.some((p) => p.source === "engine");
  const grads = draft.category === "grads" || photos.some((p) => p.category === "grads");
  const highCount = photos.filter((p) => p.suggestions.some((s) => s.confidence === "high")).length;
  const needAi = photos.filter((p) => p.status !== "full").length;
  const titleOf = (key: string) => photos.find((p) => p.key === key)?.title ?? key;

  const review = () => {
    const changes = draftToChanges(draft);
    if (Object.keys(changes).length === 0) return showToast("Pick at least one value to apply", false);
    void tagApply.submit({ kind: "changes", keys, changes, replace }, "always");
  };
  const reviewHigh = () => void tagApply.submit({ kind: "high", keys }, "always");

  const askAi = () => tagApply.run(async () => {
    let analyzed = 0;
    let found = 0;
    const failures: string[] = [];
    for (let round = 0; round < MAX_AI_ROUNDS; round += 1) {
      const r = await taggingApi.aiSuggest(keys);
      analyzed += r.analyzed.length;
      found += r.suggestions;
      failures.push(...r.failed.map((f) => f.error));
      showToast(`AI looked at ${analyzed} photo(s) · ${r.remaining} to go…`);
      if (r.remaining === 0 || r.analyzed.length + r.failed.length === 0) break;
    }
    if (failures.length) throw new Error(`AI looked at ${analyzed} photo(s) · ${failures.length} failed (${failures[0]})`);
    return `AI looked at ${analyzed} photo(s) and suggested ${found} tag(s) for your approval`;
  });

  return (
    <div style={{ ...card, marginBottom: 0, display: "grid", gap: 10, border: `1px solid ${T.amberBorder}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ color: T.ink, fontSize: 14 }}>Tag {photos.length} selected photo(s)</strong>
        <button type="button" style={btn(false)} onClick={onClear}>Clear selection</button>
      </div>
      <TagFields draft={draft} setDraft={(d) => { setDraft(d); tagApply.cancel(); }} options={options} allowCategory={anyPortfolio}
        currentSchool={commonSchool(photos)} showSchool={grads} />
      {anyEngine && (
        <p style={{ margin: 0, fontSize: 12, color: T.inkSoft }}>
          Content Engine photos take their university from the session, so a university applies to the whole session.
          A location is saved on each selected photo only.
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: T.inkSoft }}>
          <input type="checkbox" checked={replace} onChange={(e) => { setReplace(e.target.checked); tagApply.cancel(); }} />
          Replace existing values
        </label>
        <button type="button" style={btn(true)} disabled={busy} onClick={review}>
          {busy ? "Checking…" : `Review changes for ${photos.length}`}
        </button>
        {highCount > 0 && (
          <button type="button" style={btn(false)} disabled={busy} onClick={reviewHigh}>
            Review high-confidence suggestions ({highCount})
          </button>
        )}
        {needAi > 0 && (
          <button type="button" style={btn(false)} disabled={busy} onClick={() => void askAi()}
            title="Only photos still missing a field that no record answers. Each photo is analyzed once.">
            {`Ask AI about ${needAi}`}
          </button>
        )}
      </div>
      <TagApplyPanel apply={tagApply} options={options} titleOf={titleOf} />
    </div>
  );
}
