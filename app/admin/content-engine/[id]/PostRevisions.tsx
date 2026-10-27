"use client";
// Saved states of a live blog post (blog_post_revisions), newest first, with
// one-click restore. Restoring is an ordinary update the trigger records, so
// the list grows by one and the restore can be undone from here too.
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { blogPostsApi } from "@/app/admin/blogPostsApi";
import type { RevisionSummary } from "@/lib/blog/postRevisions";
import { btn, label } from "./ui";

const SHOW_AT_FIRST = 5;

export function describeRevision(r: RevisionSummary): string {
  const when = new Date(r.changedAt).toLocaleString();
  const photos = `${r.coverImageUrl ? "cover + " : "no cover, "}${r.galleryCount} gallery`;
  return `${when} · ${r.operation === "delete" ? "before deletion" : "before edit"} · “${r.title || r.slug}” · ${photos}`;
}

export default function PostRevisions({ postId, onRestored }: { postId: number; onRestored: () => void }) {
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRevisions((await blogPostsApi.revisions(postId)).revisions);
    } catch (err) {
      console.error("could not load post revisions", err);
      setNotice(err instanceof Error ? err.message : "could not load revisions");
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = async (r: RevisionSummary) => {
    if (!confirm(`Restore the post as it was on ${new Date(r.changedAt).toLocaleString()}? The current state is kept as a new revision.`)) return;
    setBusy(r.id);
    setNotice(null);
    try {
      await blogPostsApi.restoreRevision(postId, r.id);
      setNotice("Restored — the public page refreshes on its next load.");
      await load();
      onRestored();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "could not restore");
    } finally {
      setBusy(null);
    }
  };

  if (revisions === null) return notice ? <p style={{ fontSize: 12, color: T.red, margin: 0 }}>{notice}</p> : null;
  const shown = showAll ? revisions : revisions.slice(0, SHOW_AT_FIRST);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span style={label}>Revision history ({revisions.length})</span>
      {revisions.length === 0 && (
        <p style={{ fontSize: 12, color: T.inkFaint, margin: 0 }}>No saved revisions yet — every edit from now on is kept.</p>
      )}
      {shown.map((r) => (
        <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: T.inkSoft }}>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={describeRevision(r)}>{describeRevision(r)}</span>
          <button style={{ ...btn(false), padding: "3px 8px", fontSize: 11 }} disabled={busy !== null}
            onClick={() => void restore(r)}>{busy === r.id ? "Restoring…" : "Restore"}</button>
        </div>
      ))}
      {revisions.length > SHOW_AT_FIRST && (
        <button style={{ ...btn(false), padding: "3px 8px", fontSize: 11, justifySelf: "start" }} onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show fewer" : `Show all ${revisions.length}`}
        </button>
      )}
      {notice && <p style={{ fontSize: 12, margin: 0, color: notice.startsWith("Restored") ? T.inkSoft : T.red }}>{notice}</p>}
    </div>
  );
}
