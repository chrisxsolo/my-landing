"use client";
// Per-item scheduling on the review card: Schedule… for an approved item,
// and for a scheduled one the chip ("Scheduled · Nov 12, 9:00 AM PST"),
// Reschedule, Publish now and Cancel. Types without an automatic publisher
// say so instead of offering a button. Editing a scheduled item is locked
// behind an explicit cancel (ItemsSection), since the schedule is bound to
// the reviewed revision.
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { SCHEDULABLE_CONTENT_TYPES, UNSCHEDULABLE_CONTENT_TYPE_REASONS } from "@/lib/contentPublishing/constants";
import { describeScheduledInstantShort } from "@/lib/contentPublishing/localTime";
import type { EngineItem, PublicationScheduleDto } from "@/app/admin/content-engine/engineTypes";
import { publishingApi, PublishingApiError } from "@/app/admin/publishing/publishingApi";
import ScheduleControl, { emptyScheduleDraft, describeScheduleDraft, toScheduleWhen, type ScheduleDraft } from "@/app/admin/publishing/ScheduleControl";
import { btn, chip } from "./ui";

interface Props {
  item: EngineItem;
  schedule: PublicationScheduleDto | null;
  marketingPermission: boolean;
  onChanged: () => void;
}

export const SCHEDULE_STATE_LABEL: Record<PublicationScheduleDto["state"], { label: string; color: string }> = {
  queued: { label: "Scheduled", color: T.blue },
  processing: { label: "Publishing…", color: T.blue },
  published: { label: "Published", color: T.green },
  blocked: { label: "Needs attention", color: T.amber },
  failed: { label: "Publish failed", color: T.red },
  cancelled: { label: "Cancelled", color: T.inkFaint },
};

export function scheduleChipText(s: PublicationScheduleDto): string {
  const when = describeScheduledInstantShort(new Date(s.due_at), s.time_zone);
  return `${SCHEDULE_STATE_LABEL[s.state].label} · ${when}`;
}

export default function ItemScheduleControls({ item, schedule, marketingPermission, onChanged }: Props) {
  const [open, setOpen] = useState<"schedule" | "reschedule" | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft>(() => emptyScheduleDraft());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const reason = UNSCHEDULABLE_CONTENT_TYPE_REASONS[item.content_type];
  if (reason || !SCHEDULABLE_CONTENT_TYPES.includes(item.content_type)) {
    return item.status === "approved"
      ? <p style={{ fontSize: 12, color: T.inkSoft, margin: "4px 0 8px" }}>{reason ?? "This type has no automatic publisher."}</p>
      : null;
  }
  if (!schedule && item.status !== "approved") return null;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    setStatus(null);
    try {
      await fn();
      setOpen(null);
      setStatus(`${label} ✓`);
      onChanged();
    } catch (err) {
      const detail = err instanceof PublishingApiError && err.body.code === "already_published" ? "Already published." : err instanceof Error ? err.message : `${label} failed`;
      setNotice(detail);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const summary = describeScheduleDraft(draft);
  const picker = open && (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <ScheduleControl value={draft} onChange={setDraft} theme="dark" />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button style={btn(true)} disabled={busy || !summary.ok}
          onClick={() => void run(open === "schedule" ? "Scheduled" : "Rescheduled", () => open === "schedule"
            ? publishingApi.schedule({ kind: "content_item", id: item.id }, toScheduleWhen(draft), item.payload_revision)
            : publishingApi.reschedule(schedule!.id, schedule!.schedule_version, toScheduleWhen(draft)))}>
          {busy ? "Saving…" : open === "schedule" ? "Confirm schedule" : "Confirm new time"}
        </button>
        <button style={btn(false)} disabled={busy} onClick={() => setOpen(null)}>Back</button>
      </div>
    </div>
  );

  if (!schedule) {
    return (
      <div style={{ marginBottom: 8 }}>
        {!open && (
          <button style={btn(false)} disabled={!marketingPermission}
            title={marketingPermission ? "Pick a date and time; it publishes on its own" : "Enable marketing permission to schedule"}
            onClick={() => { setDraft(emptyScheduleDraft()); setOpen("schedule"); }}>
            Schedule…
          </button>
        )}
        {picker}
        {status && <p role="status" style={{ color: T.inkSoft, fontSize: 12 }}>{status}</p>}
        {notice && <p role="alert" style={{ color: T.red, fontSize: 12, whiteSpace: "pre-line" }}>{notice}</p>}
      </div>
    );
  }

  const meta = SCHEDULE_STATE_LABEL[schedule.state];
  const actionable = schedule.state === "queued" || schedule.state === "blocked" || schedule.state === "failed";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <span style={chip(meta.color, T.inset)}>{scheduleChipText(schedule)}</span>
        <span style={{ fontSize: 12, color: T.inkSoft }}>{schedule.local_wall_time.replace("T", " ")} {schedule.time_zone}</span>
        {actionable && !open && (
          <>
            <button style={btn(false)} disabled={busy} onClick={() => {
              const [date, time] = schedule.local_wall_time.split("T");
              setDraft({ date, time, timeZone: schedule.time_zone });
              setOpen("reschedule");
            }}>Reschedule</button>
            <button style={btn(true)} disabled={busy || !marketingPermission}
              onClick={() => { if (confirm("Publish this item now instead of waiting for its scheduled time?")) void run("Published", () => publishingApi.publishNow(schedule.id, schedule.schedule_version)); }}>
              {busy ? "Publishing…" : "Publish now"}
            </button>
            {(schedule.state === "blocked" || schedule.state === "failed") && (
              <button style={btn(false)} disabled={busy} onClick={() => void run("Queued again", () => publishingApi.retry(schedule.id, schedule.schedule_version))}>Retry</button>
            )}
            <button style={btn(false, true)} disabled={busy}
              onClick={() => { if (confirm("Cancel this schedule? The item stays approved and can be rescheduled.")) void run("Schedule cancelled", () => publishingApi.cancel(schedule.id, schedule.schedule_version)); }}>
              Cancel schedule
            </button>
          </>
        )}
      </div>
      {schedule.last_error && schedule.state !== "queued" && (
        <p role="alert" style={{ color: schedule.state === "processing" ? T.inkSoft : T.amber, fontSize: 12, whiteSpace: "pre-line" }}>{schedule.last_error}</p>
      )}
      {picker}
      {status && <p role="status" style={{ color: T.inkSoft, fontSize: 12 }}>{status}</p>}
      {notice && <p role="alert" style={{ color: T.red, fontSize: 12, whiteSpace: "pre-line" }}>{notice}</p>}
    </div>
  );
}
