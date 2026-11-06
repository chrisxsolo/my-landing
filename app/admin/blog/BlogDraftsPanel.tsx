"use client";
// Drafts & scheduled posts under the Blog form: every private draft with its
// completeness, its schedule (if any) and the actions — Edit, Schedule…,
// Publish now, Reschedule, Cancel, Delete — plus a link to the full queue.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { C } from "@/lib/colors";
import type { BlogPostDraftDto, PublicationScheduleDto } from "@/lib/contentPublishing/types";
import { describeScheduledInstant } from "@/lib/contentPublishing/localTime";
import { publishingApi, PublishingApiError } from "@/app/admin/publishing/publishingApi";
import ScheduleControl, { describeScheduleDraft, emptyScheduleDraft, toScheduleWhen, type ScheduleDraft } from "@/app/admin/publishing/ScheduleControl";

interface Props {
  showToast: (msg: string, ok?: boolean) => void;
  onEdit: (draft: BlogPostDraftDto) => void;
  editingDraftId: string | null;
  /** Bumped by the parent after it saves a draft, so the list reloads. */
  refreshKey: number;
  /** A draft went live from this panel: the parent refreshes its live-post list (and closes its form if open). */
  onPublished: (draftId: string) => void;
  /** A draft was deleted here: the parent closes its form if it was open. */
  onDeleted: (draftId: string) => void;
}

/**
 * Opening a scheduled draft for editing is an explicit act: the schedule is
 * cancelled FIRST (it was bound to the reviewed revision), then the form
 * opens. Shared by the panel's Edit button and the queue page's deep link.
 * Returns the draft to open, or null when the admin backed out or the cancel failed.
 */
export async function prepareDraftForEditing(
  d: BlogPostDraftDto, showToast: Props["showToast"],
): Promise<BlogPostDraftDto | null> {
  const s = d.schedule;
  if (s && (s.state === "queued" || s.state === "blocked" || s.state === "failed")) {
    if (!confirm("Editing cancels this draft's schedule. Schedule it again when you are done. Continue?")) return null;
    try {
      await publishingApi.cancel(s.id, s.schedule_version);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not cancel the schedule", false);
      return null;
    }
    showToast("Schedule cancelled — the draft is open for editing");
    return { ...d, schedule: null };
  }
  if (s?.state === "processing") { showToast("This draft is being published right now — wait for it to finish.", false); return null; }
  return d;
}

const STATE_LABEL: Record<PublicationScheduleDto["state"], string> = {
  queued: "Scheduled", processing: "Publishing…", published: "Published", blocked: "Needs attention", failed: "Publish failed", cancelled: "Cancelled",
};

const pill = "text-xs font-bold px-3 py-1.5 rounded-lg min-h-[44px]";

function describe(d: BlogPostDraftDto): string {
  const s = d.schedule;
  if (s) return `${STATE_LABEL[s.state]} · ${describeScheduledInstant(new Date(s.due_at), s.time_zone)}`;
  return d.incomplete ? `Draft · ${d.incomplete}` : "Draft · ready to schedule or publish";
}

function DraftRow({ draft, editing, onEdit, onChanged, onPublished, onDeleted, showToast }: {
  draft: BlogPostDraftDto; editing: boolean; onEdit: () => void; onChanged: () => void;
  onPublished: () => void; onDeleted: () => void; showToast: Props["showToast"];
}) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState<ScheduleDraft>(() => emptyScheduleDraft());
  const [busy, setBusy] = useState(false);
  const s = draft.schedule;
  const actionable = s && (s.state === "queued" || s.state === "blocked" || s.state === "failed");

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setOpen(false);
      showToast(`${label} ✓`);
      if (label === "Published") onPublished();
      if (label === "Deleted") onDeleted();
    }
    catch (err) { showToast(err instanceof PublishingApiError && err.body.code === "already_published" ? "Already published." : err instanceof Error ? err.message : `${label} failed`, false); }
    finally { setBusy(false); onChanged(); }
  };
  const openPicker = () => {
    if (s) { const [date, time] = s.local_wall_time.split("T"); setWhen({ date, time, timeZone: s.time_zone }); }
    else setWhen(emptyScheduleDraft());
    setOpen(true);
  };
  const summary = describeScheduleDraft(when);

  return (
    <li className="bg-white rounded-2xl border border-slate-100 p-4" style={editing ? { outline: `2px solid ${C.p1}` } : {}}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex gap-3 items-center">
          {draft.previewUrls[0] ? <img src={draft.previewUrls[0]} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" /> : <div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ background: C.p1_06 }} />}
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 truncate">{draft.title || "Untitled draft"}</p>
            <p className="text-xs text-slate-500">{describe(draft)}{draft.images.length ? ` · ${draft.images.length} photo${draft.images.length === 1 ? "" : "s"}` : ""}</p>
            {s?.last_error && s.state !== "published" && s.state !== "cancelled" && <p role="alert" className="text-xs mt-1" style={{ color: "#b45309" }}>{s.last_error}</p>}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button className={pill} style={{ background: C.p2_08, color: C.p2 }} onClick={onEdit} disabled={busy}>
            {s ? "Edit (cancels schedule)" : "Edit"}
          </button>
          {!s && (
            <>
              <button className={pill} style={{ background: C.p1_08, color: C.p1, opacity: draft.incomplete ? 0.5 : 1 }} disabled={busy || !!draft.incomplete}
                title={draft.incomplete ?? "Pick a date and time"} onClick={openPicker}>Schedule…</button>
              <button className={pill} style={{ background: C.p1, color: C.white, opacity: draft.incomplete ? 0.5 : 1 }} disabled={busy || !!draft.incomplete}
                title={draft.incomplete ?? "Publish this draft right now"}
                onClick={() => { if (confirm(`Publish "${draft.title}" now?`)) void run("Published", () => publishingApi.publishDraftNow(draft.id, draft.revision)); }}>Publish now</button>
              <button className={pill} style={{ color: "#be123c", background: "rgba(190,18,60,0.08)" }} disabled={busy}
                onClick={() => { if (confirm(`Delete the draft "${draft.title || "Untitled"}"? This cannot be undone.`)) void run("Deleted", () => publishingApi.deleteDraft(draft.id)); }}>Delete</button>
            </>
          )}
          {actionable && (
            <>
              <button className={pill} style={{ background: C.p1_08, color: C.p1 }} disabled={busy} onClick={openPicker}>Reschedule</button>
              <button className={pill} style={{ background: C.p1, color: C.white }} disabled={busy}
                onClick={() => { if (confirm(`Publish "${draft.title}" now instead of waiting?`)) void run("Published", () => publishingApi.publishNow(s.id, s.schedule_version)); }}>Publish now</button>
              {(s.state === "blocked" || s.state === "failed") && (
                <button className={pill} style={{ background: C.p1_08, color: C.p1 }} disabled={busy} onClick={() => void run("Queued again", () => publishingApi.retry(s.id, s.schedule_version))}>Retry</button>
              )}
              <button className={pill} style={{ color: "#be123c", background: "rgba(190,18,60,0.08)" }} disabled={busy}
                onClick={() => { if (confirm("Cancel this schedule? The post stays a draft.")) void run("Schedule cancelled", () => publishingApi.cancel(s.id, s.schedule_version)); }}>Cancel schedule</button>
            </>
          )}
          {s?.state === "processing" && <span className="text-xs text-slate-500 self-center">Publishing right now…</span>}
        </div>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <ScheduleControl value={when} onChange={setWhen} theme="dark" />
          <div className="flex gap-2 mt-3">
            <button className={pill} style={{ background: C.p1, color: C.white, opacity: summary.ok ? 1 : 0.5 }} disabled={busy || !summary.ok}
              onClick={() => void run(s ? "Rescheduled" : "Scheduled", () => s
                ? publishingApi.reschedule(s.id, s.schedule_version, toScheduleWhen(when))
                : publishingApi.schedule({ kind: "blog_draft", id: draft.id }, toScheduleWhen(when), draft.revision))}>
              {s ? "Confirm new time" : "Confirm schedule"}
            </button>
            <button className={pill} style={{ background: "#f1f5f9", color: "#475569" }} disabled={busy} onClick={() => setOpen(false)}>Back</button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function BlogDraftsPanel({ showToast, onEdit, editingDraftId, refreshKey, onPublished, onDeleted }: Props) {
  const [drafts, setDrafts] = useState<BlogPostDraftDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  // The shell recreates showToast on every render; a ref keeps `load` stable
  // so the list is fetched on mount and on refreshKey only.
  const toastRef = useRef(showToast);
  useEffect(() => { toastRef.current = showToast; }, [showToast]);
  const load = useCallback(async () => {
    try {
      const { drafts: list } = await publishingApi.listDrafts();
      setDrafts(list.filter((d) => d.status === "draft"));
    } catch (err) {
      toastRef.current(err instanceof Error ? err.message : "Could not load drafts", false);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const editDraft = async (d: BlogPostDraftDto) => {
    const ready = await prepareDraftForEditing(d, showToast);
    void load();
    if (ready) onEdit(ready);
  };

  const scheduled = drafts.filter((d) => d.schedule).length;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: C.p1 }}>Drafts &amp; scheduled</p>
          <span className="text-xs font-bold text-slate-400">({drafts.length}{scheduled ? ` · ${scheduled} scheduled` : ""})</span>
        </div>
        <Link href="/admin/content-engine/schedule" className="text-xs font-bold" style={{ color: C.p1 }}>Open publishing queue →</Link>
      </div>
      {!loaded ? <div className="rounded-2xl animate-pulse h-16" style={{ background: C.p1_06 }} /> : drafts.length === 0 ? (
        <p className="text-sm text-slate-400 font-medium">No drafts. Use “Save draft” or “Schedule” on a new post above to keep it private until it is time.</p>
      ) : (
        <ul className="space-y-3 p-0 m-0">
          {drafts.map((d) => (
            <DraftRow key={d.id} draft={d} editing={editingDraftId === d.id} showToast={showToast} onChanged={() => void load()}
              onPublished={() => onPublished(d.id)} onDeleted={() => onDeleted(d.id)}
              onEdit={() => { void editDraft(d); }} />
          ))}
        </ul>
      )}
    </div>
  );
}
