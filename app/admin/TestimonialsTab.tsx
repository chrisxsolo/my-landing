"use client";

import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/colors";
import {
  type AdminTestimonialUpdates,
  buildTestimonialDisplayName,
  TESTIMONIAL_SOURCES,
  TESTIMONIAL_STATUSES,
  type TestimonialDisplayPreference,
  type TestimonialSource,
  type TestimonialStatus,
} from "@/lib/testimonialValidation";

type Props = { showToast: (message: string, ok?: boolean) => void };
type Testimonial = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  message: string;
  consent_to_marketing: boolean;
  consent_version: string;
  display_name_preference: TestimonialDisplayPreference;
  status: TestimonialStatus;
  source: TestimonialSource;
  gallery_id: string | null;
  session_type: string | null;
  featured: boolean;
  display_order: number | null;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  published_at: string | null;
  updated_at: string;
};

const PAGE_SIZE = 20;
const STATUS_LABELS: Record<TestimonialStatus, string> = {
  pending: "Pending", approved: "Approved", rejected: "Rejected", archived: "Archived",
};
const SOURCE_LABELS: Record<TestimonialSource, string> = {
  direct_link: "Direct link", gallery: "Gallery", email: "Email", manual: "Manual",
};
const STATUS_COLORS: Record<TestimonialStatus, { background: string; color: string }> = {
  pending: { background: C.p3_15, color: C.inkSoft },
  approved: { background: C.p1_10, color: C.success },
  rejected: { background: C.p2_10, color: C.danger },
  archived: { background: C.p1_06, color: C.muted },
};

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function messageForUpdate(updates: AdminTestimonialUpdates): string {
  if (updates.status) return `Testimonial marked ${STATUS_LABELS[updates.status].toLowerCase()}`;
  if (updates.published !== undefined) return updates.published ? "Testimonial published" : "Testimonial unpublished";
  if (updates.featured !== undefined) return updates.featured ? "Added to homepage" : "Removed from homepage";
  if (updates.session_type !== undefined || updates.display_order !== undefined) return "Homepage details saved";
  return "Notes saved";
}

function StatusBadge({ status }: { status: TestimonialStatus }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider" style={STATUS_COLORS[status]}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function TestimonialsTab({ showToast }: Props) {
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const [rows, setRows] = useState<Testimonial[]>([]);
  const [selected, setSelected] = useState<Testimonial | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (statusFilter) params.set("status", statusFilter);
      if (sourceFilter) params.set("source", sourceFilter);
      if (search.trim()) params.set("search", search.trim());
      try {
        const response = await fetch(`/api/admin/testimonials?${params}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setRows(body.testimonials ?? []);
        setTotal(body.total ?? 0);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToastRef.current("Failed to load testimonials", false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [page, search, sourceFilter, statusFilter]);

  function openDetail(row: Testimonial) {
    setSelected(row);
    setNotes(row.admin_notes ?? "");
    setDeleteConfirm(false);
  }

  function replaceRow(updated: Testimonial) {
    setRows((current) => current.map((row) => row.id === updated.id ? updated : row));
    setSelected(updated);
    setNotes(updated.admin_notes ?? "");
  }

  async function updateTestimonial(updates: AdminTestimonialUpdates) {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/testimonials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, updates }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      replaceRow(body.testimonial);
      // Publishing, featuring, ordering, and status changes all affect the
      // public homepage section — refresh its cache so edits appear immediately.
      fetch("/api/admin/revalidate", { method: "POST" }).catch(() => {});
      showToast(messageForUpdate(updates));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Update failed", false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTestimonial() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/testimonials?id=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRows((current) => current.filter((row) => row.id !== selected.id));
      setTotal((current) => Math.max(0, current - 1));
      setSelected(null);
      showToast("Testimonial deleted");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Delete failed", false);
    } finally {
      setSaving(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>Client feedback</p>
          <h2 className="mt-1 text-2xl font-black" style={{ color: C.ink }}>Testimonials</h2>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>{total} submission{total === 1 ? "" : "s"}</p>
        </div>
        <a href="/testimonial" target="_blank" rel="noreferrer" className="inline-flex self-start rounded-full px-4 py-2 text-xs font-black" style={{ background: C.grad12, color: C.white }}>
          Open public form
        </a>
      </header>

      <section className="grid gap-3 rounded-2xl p-4 md:grid-cols-[1fr_180px_180px]" style={{ background: C.white, border: `1px solid ${C.warmEdge}` }}>
        <input
          type="search"
          placeholder="Search name, email, or feedback..."
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ color: C.ink, border: `1px solid ${C.warmEdge}` }}
        />
        <select
          value={statusFilter}
          onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ color: C.ink, border: `1px solid ${C.warmEdge}`, background: C.white }}
        >
          <option value="">All statuses</option>
          {TESTIMONIAL_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
        </select>
        <select
          value={sourceFilter}
          onChange={(event) => { setSourceFilter(event.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ color: C.ink, border: `1px solid ${C.warmEdge}`, background: C.white }}
        >
          <option value="">All sources</option>
          {TESTIMONIAL_SOURCES.map((source) => <option key={source} value={source}>{SOURCE_LABELS[source]}</option>)}
        </select>
      </section>

      {loading ? (
        <div className="rounded-2xl p-12 text-center text-sm" style={{ color: C.muted, background: C.white }}>Loading testimonials...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: C.white, border: `1px solid ${C.warmEdge}` }}>
          <p className="font-black" style={{ color: C.ink }}>No testimonials found</p>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>New direct-link submissions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <button key={row.id} type="button" onClick={() => openDetail(row)} className="w-full rounded-2xl p-4 text-left transition hover:-translate-y-0.5" style={{ background: C.white, border: `1px solid ${C.warmEdge}`, boxShadow: C.shadowWarmSm }}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black" style={{ color: C.ink }}>{row.first_name} {row.last_name}</p>
                    <StatusBadge status={row.status} />
                    <span className="text-[11px] font-bold" style={{ color: C.muted }}>{SOURCE_LABELS[row.source]}</span>
                  </div>
                  {row.email && <p className="mt-1 text-xs" style={{ color: C.mutedSoft }}>{row.email}</p>}
                  <p className="mt-3 line-clamp-2 text-sm leading-6" style={{ color: C.inkSoft }}>{row.message}</p>
                </div>
                <p className="shrink-0 text-xs" style={{ color: C.mutedSoft }}>{formatDate(row.submitted_at)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-full px-4 py-2 text-xs font-black disabled:opacity-40" style={{ color: C.inkSoft, border: `1px solid ${C.warmEdge}` }}>Previous</button>
        <span className="text-xs" style={{ color: C.muted }}>Page {page} of {pageCount}</span>
        <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-full px-4 py-2 text-xs font-black disabled:opacity-40" style={{ color: C.inkSoft, border: `1px solid ${C.warmEdge}` }}>Next</button>
      </div>

      {selected && (
        <TestimonialDetail
          testimonial={selected}
          notes={notes}
          saving={saving}
          deleteConfirm={deleteConfirm}
          onNotesChange={setNotes}
          onClose={() => setSelected(null)}
          onStatus={(status) => updateTestimonial({ status })}
          onSaveNotes={() => updateTestimonial({ admin_notes: notes })}
          onUpdate={updateTestimonial}
          onDeleteConfirm={setDeleteConfirm}
          onDelete={deleteTestimonial}
        />
      )}
    </div>
  );
}

type DetailProps = {
  testimonial: Testimonial;
  notes: string;
  saving: boolean;
  deleteConfirm: boolean;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onStatus: (status: TestimonialStatus) => void;
  onSaveNotes: () => void;
  onUpdate: (updates: AdminTestimonialUpdates) => void;
  onDeleteConfirm: (value: boolean) => void;
  onDelete: () => void;
};

function HomepageControls({ row, saving, onUpdate }: { row: Testimonial; saving: boolean; onUpdate: (updates: AdminTestimonialUpdates) => void }) {
  const [sessionType, setSessionType] = useState(row.session_type ?? "");
  const [displayOrder, setDisplayOrder] = useState(row.display_order === null ? "" : String(row.display_order));
  const isApproved = row.status === "approved";
  const published = row.published_at !== null;

  function saveDetails() {
    const trimmedOrder = displayOrder.trim();
    onUpdate({
      session_type: sessionType.trim() || null,
      display_order: trimmedOrder === "" ? null : Number(trimmedOrder),
    });
  }

  const orderInvalid = displayOrder.trim() !== "" && !/^\d{1,4}$/.test(displayOrder.trim());

  return (
    <div className="mt-6 rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.warmEdge}` }}>
      <p className="text-sm font-black" style={{ color: C.ink }}>Homepage visibility</p>
      <p className="mt-1 text-xs" style={{ color: C.muted }}>
        Approved, published, and featured testimonials appear in the homepage testimonials section.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onUpdate({ published: !published })}
          className="rounded-full px-4 py-2 text-xs font-black disabled:opacity-40"
          style={{ color: published ? C.muted : C.success, background: published ? C.p1_06 : C.p1_10 }}
        >
          {published ? "Unpublish" : "Publish"}
        </button>
        <button
          type="button"
          disabled={saving || !isApproved}
          onClick={() => onUpdate({ featured: !row.featured })}
          className="rounded-full px-4 py-2 text-xs font-black disabled:opacity-40"
          style={{ color: row.featured ? C.muted : C.p1, background: row.featured ? C.p1_06 : C.p1_15 }}
        >
          {row.featured ? "Remove from featured" : "Feature on homepage"}
        </button>
      </div>
      {!isApproved && (
        <p className="mt-2 text-xs" style={{ color: C.mutedSoft }}>Approve this testimonial before featuring it.</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
        <div>
          <label htmlFor="testimonial-session-type" className="text-[11px] font-black uppercase tracking-wider" style={{ color: C.mutedSoft }}>Session badge</label>
          <input
            id="testimonial-session-type"
            type="text"
            maxLength={120}
            value={sessionType}
            placeholder="e.g. SJSU Graduation Session"
            onChange={(event) => setSessionType(event.target.value)}
            className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ color: C.ink, background: C.white, border: `1px solid ${C.warmEdge}` }}
          />
        </div>
        <div>
          <label htmlFor="testimonial-display-order" className="text-[11px] font-black uppercase tracking-wider" style={{ color: C.mutedSoft }}>Order</label>
          <input
            id="testimonial-display-order"
            type="number"
            min={0}
            max={9999}
            value={displayOrder}
            placeholder="1"
            onChange={(event) => setDisplayOrder(event.target.value)}
            className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ color: C.ink, background: C.white, border: `1px solid ${C.warmEdge}` }}
          />
        </div>
      </div>
      <button
        type="button"
        disabled={saving || orderInvalid}
        onClick={saveDetails}
        className="mt-3 rounded-full px-4 py-2 text-xs font-black disabled:opacity-50"
        style={{ background: C.grad12, color: C.white }}
      >
        Save homepage details
      </button>
    </div>
  );
}

function PublicPreview({ row }: { row: Testimonial }) {
  const displayName = buildTestimonialDisplayName(row.first_name, row.last_name, row.display_name_preference);
  return (
    <div className="mt-6">
      <p className="text-sm font-black" style={{ color: C.ink }}>Public preview</p>
      <figure className="mt-2 flex flex-col gap-4 rounded-2xl p-5" style={{ background: C.page, border: `1px solid ${C.warmEdge}` }}>
        {row.session_type && (
          <span className="self-start rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider" style={{ background: C.proAccentSoft, color: C.proAccentDark }}>
            {row.session_type}
          </span>
        )}
        <blockquote className="m-0 text-[15px] leading-7" style={{ color: C.ink }}>{`“${row.message}”`}</blockquote>
        <figcaption className="flex flex-col">
          <span className="text-sm font-black" style={{ color: C.ink }}>{displayName}</span>
          <span className="text-xs font-semibold" style={{ color: C.muted }}>SoloXSnaps Client</span>
        </figcaption>
      </figure>
    </div>
  );
}

function TestimonialDetail(props: DetailProps) {
  const row = props.testimonial;
  const displayName = buildTestimonialDisplayName(row.first_name, row.last_name, row.display_name_preference);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-5" style={{ background: C.modalOverlay }} onMouseDown={props.onClose}>
      <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] p-5 sm:rounded-[2rem] sm:p-7" style={{ background: C.page }} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-black" style={{ color: C.ink }}>{row.first_name} {row.last_name}</h3>
              <StatusBadge status={row.status} />
            </div>
            <p className="mt-1 text-sm" style={{ color: C.muted }}>Public display: {displayName}</p>
          </div>
          <button type="button" onClick={props.onClose} className="h-9 w-9 rounded-full text-lg font-black" style={{ color: C.muted, background: C.p1_06 }}>×</button>
        </div>

        <blockquote className="mt-6 whitespace-pre-wrap rounded-2xl p-5 text-[15px] leading-7" style={{ color: C.inkSoft, background: C.white, border: `1px solid ${C.warmEdge}` }}>{row.message}</blockquote>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Email" value={row.email ?? "Not provided"} />
          <Detail label="Consent" value={`${row.consent_to_marketing ? "Granted" : "Not granted"} (${row.consent_version})`} />
          <Detail label="Display preference" value={row.display_name_preference.replaceAll("_", " ")} />
          <Detail label="Source" value={SOURCE_LABELS[row.source]} />
          <Detail label="Gallery ID" value={row.gallery_id ?? "Not provided"} />
          <Detail label="Session type" value={row.session_type ?? "Not provided"} />
          <Detail label="Submitted" value={formatDate(row.submitted_at)} />
          <Detail label="Reviewed" value={formatDate(row.reviewed_at)} />
          <Detail label="Published" value={formatDate(row.published_at)} />
        </dl>

        <div className="mt-6">
          <label htmlFor="testimonial-admin-notes" className="text-sm font-black" style={{ color: C.ink }}>Private admin notes</label>
          <textarea id="testimonial-admin-notes" rows={4} maxLength={2000} value={props.notes} onChange={(event) => props.onNotesChange(event.target.value)} className="mt-2 w-full resize-y rounded-2xl p-4 text-sm outline-none" style={{ color: C.ink, background: C.white, border: `1px solid ${C.warmEdge}` }} />
          <button type="button" disabled={props.saving} onClick={props.onSaveNotes} className="mt-2 rounded-full px-4 py-2 text-xs font-black disabled:opacity-50" style={{ background: C.grad12, color: C.white }}>Save notes</button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {TESTIMONIAL_STATUSES.map((status) => (
            <button key={status} type="button" disabled={props.saving || row.status === status} onClick={() => props.onStatus(status)} className="rounded-full px-4 py-2 text-xs font-black disabled:opacity-40" style={{ color: STATUS_COLORS[status].color, background: STATUS_COLORS[status].background }}>
              {status === "pending" ? "Return to Pending" : STATUS_LABELS[status]}
            </button>
          ))}
        </div>

        <HomepageControls row={row} saving={props.saving} onUpdate={props.onUpdate} />
        <PublicPreview row={row} />

        <div className="mt-7 border-t pt-5" style={{ borderColor: C.warmEdge }}>
          {props.deleteConfirm ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-bold" style={{ color: C.danger }}>Permanently delete this testimonial?</p>
              <button type="button" disabled={props.saving} onClick={props.onDelete} className="rounded-full px-4 py-2 text-xs font-black disabled:opacity-50" style={{ background: C.danger, color: C.white }}>Yes, delete</button>
              <button type="button" onClick={() => props.onDeleteConfirm(false)} className="text-xs font-black" style={{ color: C.muted }}>Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => props.onDeleteConfirm(true)} className="text-xs font-black" style={{ color: C.danger }}>Delete testimonial</button>
          )}
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: C.white }}>
      <dt className="text-[10px] font-black uppercase tracking-wider" style={{ color: C.mutedSoft }}>{label}</dt>
      <dd className="mt-1 break-words font-bold capitalize" style={{ color: C.inkSoft }}>{value}</dd>
    </div>
  );
}
