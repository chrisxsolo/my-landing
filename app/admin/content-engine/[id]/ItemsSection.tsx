"use client";
// Section 4 — Item review (spec §7.4): one card per item with status chip,
// type-specific editor, Approve / Reject / Un-reject, autosave state line, and
// the 409 comparison prompt. Published items render display-only.
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { CONTENT_TYPE_LABELS, type EngineItem, type EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import { useAutosave } from "./useAutosave";
import { JournalEditor } from "./editorsJournal";
import {
  PortfolioEditor, SchoolEditor, GuideEditor, TestimonialEditor, LinksEditor,
  type EditorProps,
} from "./editorsSimple";
import { btn, card, chip, sectionTitle } from "./ui";

const EDITORS: Record<string, (props: EditorProps) => React.ReactElement> = {
  journal_post: JournalEditor,
  portfolio_pick: PortfolioEditor,
  school_page_photo: SchoolEditor,
  guide_photo: GuideEditor,
  testimonial_feature: TestimonialEditor,
  internal_link_suggestion: LinksEditor,
};

const STATUS_COLORS: Record<EngineItem["status"], string> = {
  draft: T.amber, approved: T.violet, rejected: T.inkFaint,
  publishing: T.blue, published: T.green, failed: T.red,
};

function ItemCard({ item, photos, onChanged, serviceType }: {
  item: EngineItem; photos: EnginePhoto[]; onChanged: () => void; serviceType?: string;
}) {
  const { state, payload, edit, saveNow, resolveConflict } = useAutosave(
    item.id, item.payload, item.payload_revision, onChanged,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const Editor = EDITORS[item.content_type];
  const locked = item.status === "published" || item.status === "publishing" || item.status === "rejected";

  const act = async (action: "approve" | "reject" | "unreject") => {
    setNotice(null);
    try {
      if (action === "approve" && state.dirty) saveNow(); // flush before approving
      const reason = action === "reject" ? (prompt("Rejection reason (optional)") ?? undefined) : undefined;
      await engineApi.itemStatus(item.id, action, reason);
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "action failed");
    }
  };

  const saveLine =
    state.status === "saving" ? "Saving…"
    : state.status === "editing" ? "Editing…"
    : state.status === "saved" ? `Saved ${state.savedAt}`
    : state.status === "save_failed" ? `Save failed — local backup preserved (${state.error})`
    : "";

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>{CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}</strong>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.inkSoft }}>{saveLine}</span>
          <span style={chip(STATUS_COLORS[item.status], T.inset)} title={item.error ?? item.rejection_reason ?? undefined}>
            {item.status}
          </span>
          {(item.status === "draft" || item.status === "failed") && (
            <button style={btn(true)} onClick={() => void act("approve")}>Approve</button>
          )}
          {(item.status === "draft" || item.status === "approved" || item.status === "failed") && (
            <button style={btn(false, true)} onClick={() => void act("reject")}>Reject</button>
          )}
          {item.status === "rejected" && (
            <button style={btn(false)} onClick={() => void act("unreject")}>Un-reject</button>
          )}
        </span>
      </div>
      {item.status === "failed" && item.error && (
        <p style={{ color: T.red, fontSize: 12 }}>{item.error}</p>
      )}
      {notice && <p style={{ color: T.red, fontSize: 12 }}>{notice}</p>}

      {state.status === "conflict" && state.conflict && (
        <div style={{ border: `1px solid ${T.red}`, borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13 }}>
          <p style={{ marginTop: 0 }}>
            This item changed in another tab/device (server revision {state.conflict.payload_revision}).
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn(false)} onClick={() => resolveConflict("server")}>Use server copy</button>
            <button style={btn(false, true)} onClick={() => resolveConflict("mine")}>Overwrite with mine</button>
          </div>
        </div>
      )}

      {Editor ? (
        <Editor payload={payload} photos={photos} onEdit={edit} disabled={locked} serviceType={serviceType} />
      ) : (
        <pre style={{ fontSize: 12, overflowX: "auto" }}>{JSON.stringify(payload, null, 2)}</pre>
      )}
    </div>
  );
}

export default function ItemsSection({ items, photos, onChanged, serviceType }: {
  items: EngineItem[]; photos: EnginePhoto[]; onChanged: () => void; serviceType?: string;
}) {
  return (
    <section style={card}>
      <h2 style={sectionTitle}>Review drafts ({items.length})</h2>
      {items.length === 0 ? (
        <p style={{ color: T.inkSoft, textAlign: "center", padding: 16 }}>
          No drafts yet — generate a content package above.
        </p>
      ) : (
        items.map((item) => (
          // key is item.id ONLY: a remount on every revision bump would drop editor
          // focus after each autosave and discard in-flight keystrokes. Own saves
          // adopt the new revision via the reducer; external edits surface as the
          // 409 conflict prompt by design.
          <ItemCard key={item.id} item={item} photos={photos} onChanged={onChanged} serviceType={serviceType} />
        ))
      )}
    </section>
  );
}
