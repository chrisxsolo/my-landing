"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { C } from "@/lib/colors";
import { checkAuth } from "@/lib/adminAuth";
import { Suspense } from "react";
import { buildReminderEmail, type ReminderEmailType } from "@/lib/reminderEmail";

type ReminderDraft = {
  id: string;
  label: string;
  emoji: string;
  subject: string;
  body: string;
  html?: string;
};

const REMINDER_ORDER = ["48hr", "day-before", "morning-of", "thank-you", "gallery-delivery"];

function RemindersContent() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const inquiryId    = params.id as string;
  const focusId      = searchParams.get("focus"); // e.g. ?focus=thank-you to scroll to that card

  const [authed,      setAuthed]      = useState(false);
  const [clientName,  setClientName]  = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [reminders,   setReminders]   = useState<ReminderDraft[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [sending,     setSending]     = useState<string | null>(null);
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const focusRef        = useRef<HTMLDivElement>(null);
  const previewWindowRef = useRef<Window | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    if (!checkAuth()) { router.push("/admin"); return; }
    setAuthed(true);
  }, [router]);

  useEffect(() => {
    if (!authed || !inquiryId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/session-reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiry_id: inquiryId }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); return; }
        // Sort into canonical order
        const sorted = [...(json.reminders ?? [])].sort(
          (a: ReminderDraft, b: ReminderDraft) =>
            REMINDER_ORDER.indexOf(a.id) - REMINDER_ORDER.indexOf(b.id)
        );
        setReminders(sorted);
        setClientName(json.client_name ?? "");
        setClientEmail(json.client_email ?? "");
      })
      .catch(() => setError("Failed to generate reminders. Check your connection."))
      .finally(() => setLoading(false));
  }, [authed, inquiryId]);

  // Scroll to focused card once loaded
  useEffect(() => {
    if (!loading && focusId && focusRef.current) {
      setTimeout(() => focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }
  }, [loading, focusId]);

  function updateReminder(index: number, field: "subject" | "body", value: string) {
    setReminders(prev => prev.map((r, i) => {
      if (i !== index) return r;
      const updated = { ...r, [field]: value };
      // Rebuild HTML whenever body changes so preview stays in sync
      if (field === "body") {
        updated.html = buildReminderEmail(updated.id as ReminderEmailType, clientName.split(" ")[0] || "there", value);
      }
      return updated;
    }));
  }

  function previewEmail(r: ReminderDraft) {
    const html = r.html ?? buildReminderEmail(r.id as ReminderEmailType, clientName.split(" ")[0] || "there", r.body);
    try {
      localStorage.setItem("email_preview_html", html);
      localStorage.setItem("email_preview_subject", r.subject);
      localStorage.setItem("email_preview_body", r.body);
    } catch { /* ignore */ }

    const win = previewWindowRef.current;
    if (win && !win.closed) {
      win.postMessage({ type: "email-preview-update", html, subject: r.subject, body: r.body }, window.location.origin);
      win.focus();
    } else {
      previewWindowRef.current = window.open("/admin/email-preview", "email_preview");
    }
  }

  async function sendReminder(r: ReminderDraft) {
    setSending(r.id);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: clientEmail,
          subject: r.subject,
          body: r.body,
          html: r.html ?? buildReminderEmail(r.id as ReminderEmailType, clientName.split(" ")[0] || "there", r.body),
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Send failed", false); return; }
      showToast(`${r.label} sent ✓`);
    } catch {
      showToast("Send failed", false);
    } finally {
      setSending(null);
    }
  }

  if (!authed) return null;

  const gradBar = (id: string) => {
    if (id === "thank-you")        return `linear-gradient(135deg, ${C.p1}, ${C.p2}, #fbbf24)`;
    if (id === "gallery-delivery") return `linear-gradient(135deg, #fbbf24, ${C.p2}, ${C.p1})`;
    if (id === "morning-of")       return `linear-gradient(135deg, #fbbf24, ${C.p2})`;
    if (id === "day-before")       return `linear-gradient(135deg, ${C.p2}, #fbbf24)`;
    return C.grad12;
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: "#f8f7ff" }}>
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-xl pointer-events-none"
          style={{ background: toast.ok ? C.grad12 : "#be123c" }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ background: C.p1_08, color: C.p1 }}>
              ← Back
            </button>
            <div>
              <p className="text-sm font-black text-slate-900">
                {clientName ? `Reminders for ${clientName}` : "Session Reminders"}
              </p>
              <p className="text-[11px] text-slate-400">
                {loading ? "Generating…" : error ? "Error" : `${reminders.length} emails ready to send`}
              </p>
            </div>
          </div>
          {!loading && !error && (
            <button
              onClick={() => router.push(`/admin/reminder-templates`)}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex-shrink-0"
              style={{ background: C.p1_06, color: C.p1, border: `1px solid ${C.p1_15}` }}>
              ✏️ Edit templates
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">

        {/* ── Loading skeletons ── */}
        {loading && (
          <>
            <div className="rounded-2xl p-5 flex items-center gap-3" style={{ background: C.p1_06, border: `1px solid ${C.p1_12}` }}>
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0" style={{ borderColor: C.p1_25, borderTopColor: "transparent" }} />
              <div>
                <p className="text-sm font-black text-slate-800">Generating your reminders…</p>
                <p className="text-xs text-slate-400 mt-0.5">Reading email history and writing 5 personalised drafts</p>
              </div>
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white border border-slate-100 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="h-[3px]" style={{ background: C.p1_15 }} />
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-40 rounded-lg" style={{ background: C.p1_08 }} />
                    <div className="h-7 w-24 rounded-lg" style={{ background: C.p1_08 }} />
                  </div>
                  <div className="h-9 rounded-xl" style={{ background: "#f1f5f9" }} />
                  <div className="h-24 rounded-xl" style={{ background: "#f1f5f9" }} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Error state ── */}
        {!loading && error && (
          <div className="rounded-2xl p-8 text-center bg-white border border-red-100">
            <p className="text-2xl mb-2">⚠️</p>
            <p className="text-sm font-bold text-slate-700">{error}</p>
            <button
              onClick={() => { setLoading(true); setError(null); }}
              className="mt-4 text-xs font-bold px-4 py-2 rounded-xl text-white"
              style={{ background: C.grad12 }}>
              Try again
            </button>
          </div>
        )}

        {/* ── Reminder cards ── */}
        {!loading && !error && reminders.map((r, i) => {
          const isFocused = r.id === focusId;
          return (
            <div
              key={r.id}
              ref={isFocused ? focusRef : null}
              className="bg-white rounded-2xl overflow-hidden border transition-shadow"
              style={{
                borderColor: isFocused ? C.p1 : "#e2e8f0",
                boxShadow: isFocused ? `0 0 0 2px ${C.p1_20}` : "0 1px 4px rgba(0,0,0,0.04)",
              }}>
              {/* Colour bar */}
              <div className="h-[3px]" style={{ background: gradBar(r.id) }} />

              {/* Card header */}
              <div className="flex items-center justify-between gap-3 px-5 py-3"
                style={{ background: "rgba(248,247,255,0.7)", borderBottom: "1px solid #f1f5f9" }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{r.emoji}</span>
                  <p className="text-xs font-black text-slate-800">{i + 1}. {r.label}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.html && (
                    <button
                      onClick={() => previewEmail(r)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                      style={{ background: C.p1_08, color: C.p1 }}>
                      👁 Preview
                    </button>
                  )}
                  <button
                    onClick={() => sendReminder(r)}
                    disabled={sending === r.id}
                    className="text-[11px] font-black px-3 py-1 rounded-lg text-white transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                    {sending === r.id ? "Sending…" : "Send →"}
                  </button>
                </div>
              </div>

              {/* Editable fields */}
              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Subject</label>
                  <input
                    type="text"
                    value={r.subject}
                    onChange={e => updateReminder(i, "subject", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors"
                    style={{ fontFamily: "inherit" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Message</label>
                  <textarea
                    value={r.body}
                    onChange={e => updateReminder(i, "body", e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl text-sm text-slate-700 leading-relaxed outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors resize-none"
                    style={{ fontFamily: "inherit" }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {!loading && !error && reminders.length > 0 && (
          <p className="text-[11px] text-slate-400 text-center pb-4">
            Edit any draft above before sending. Want to change the style permanently?{" "}
            <button onClick={() => router.push("/admin/reminder-templates")} className="underline" style={{ color: C.p1 }}>
              Update templates →
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default function RemindersPage() {
  return (
    <Suspense>
      <RemindersContent />
    </Suspense>
  );
}
