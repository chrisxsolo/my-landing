"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/colors";
import { checkAuth } from "@/lib/adminAuth";
import type { GmailMessage } from "@/app/api/gmail/thread/route";

// ─────────────────────────────────────────────────────────────────────────────

type Inquiry = {
  id: number; name: string; email: string; phone: string | null;
  session_type: string | null; date_in_mind: string | null;
  message: string; status: string; created_at: string;
};

function fmtDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isThisYear) return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Strip Gmail quote blocks (lines starting with >) for cleaner display
function stripQuotes(text: string): string {
  return text
    .split("\n")
    .filter(line => !line.trim().startsWith(">"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ConversationPage() {
  const params   = useParams();
  const router   = useRouter();
  const inquiryId = parseInt(params.id as string);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [inquiry,       setInquiry]       = useState<Inquiry | null>(null);
  const [messages,      setMessages]      = useState<GmailMessage[]>([]);
  const [myEmail,       setMyEmail]       = useState("");
  const [threadLoading, setThreadLoading] = useState(false);
  const [expanded,      setExpanded]      = useState<Record<string, boolean>>({});
  // Bodies loaded on demand when a message is expanded
  const [bodies,        setBodies]        = useState<Record<string, string>>({});
  const [bodyLoading,   setBodyLoading]   = useState<Record<string, boolean>>({});

  const [draft,         setDraft]         = useState("");
  const [draftLoading,  setDraftLoading]  = useState(false);
  const [subject,       setSubject]       = useState("");
  const [feedback,      setFeedback]      = useState("");
  const [sendLoading,   setSendLoading]   = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [status,        setStatus]        = useState("new");

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!checkAuth()) { router.push("/admin"); return; }
    if (!inquiryId) return;

    supabase.from("inquiries").select("*").eq("id", inquiryId).single()
      .then(({ data }) => {
        if (!data) { router.push("/admin?tab=inquiries"); return; }
        setInquiry(data);
        setStatus(data.status);
        setSubject(`Re: Your ${data.session_type ?? "photography"} inquiry`);
        fetchThread(data.email);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  // Auto-scroll to bottom when thread loads
  useEffect(() => {
    if (messages.length) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Fetch Gmail thread (metadata only — fast) ─────────────────────────────
  async function fetchThread(email: string) {
    setThreadLoading(true);
    try {
      const res  = await fetch(`/api/gmail/thread?email=${encodeURIComponent(email)}`);
      const json = await res.json() as { messages: GmailMessage[]; myEmail: string; error?: string };
      if (json.error && !json.messages?.length) showToast(json.error, false);
      setMessages(json.messages ?? []);
      setMyEmail(json.myEmail ?? "");
      // Auto-expand + load body for the last message only
      const last = json.messages?.at(-1);
      if (last) {
        setExpanded({ [last.id]: true });
        loadBody(last.id);
      }
    } catch {
      showToast("Failed to load Gmail thread", false);
    } finally {
      setThreadLoading(false);
    }
  }

  // ── Lazy-load a single message body on expand ──────────────────────────────
  async function loadBody(id: string) {
    if (bodies[id] !== undefined || bodyLoading[id]) return; // already loaded/loading
    setBodyLoading(p => ({ ...p, [id]: true }));
    try {
      const res  = await fetch(`/api/gmail/message?id=${id}`);
      const json = await res.json() as { body?: string };
      setBodies(p => ({ ...p, [id]: json.body ?? "" }));
    } catch {
      setBodies(p => ({ ...p, [id]: "" }));
    } finally {
      setBodyLoading(p => ({ ...p, [id]: false }));
    }
  }

  function toggleExpand(id: string) {
    const opening = !expanded[id];
    setExpanded(p => ({ ...p, [id]: opening }));
    if (opening) loadBody(id);
  }

  // ── AI Draft ────────────────────────────────────────────────────────────────
  async function generateDraft(refeedback?: string) {
    if (!inquiry) return;
    setDraftLoading(true);
    try {
      // Build a readable summary of the thread for Claude using loaded bodies
      const threadContext = messages.length > 0
        ? messages.map(m => {
            const body = bodies[m.id] ? stripQuotes(bodies[m.id]).slice(0, 800) : m.snippet;
            return `[${fmtDate(m.timestamp)}] ${m.isMe ? "You (Chris)" : inquiry.name}:\n${body}`;
          }).join("\n\n---\n\n")
        : undefined;

      const payload: Record<string, string | null> = {
        name:           inquiry.name,
        email:          inquiry.email,
        phone:          inquiry.phone,
        session_type:   inquiry.session_type,
        date_in_mind:   inquiry.date_in_mind,
        message:        inquiry.message,
        thread_context: threadContext ?? null,
      };

      if (refeedback && draft) {
        payload.previous_draft = draft;
        payload.feedback        = refeedback;
      }

      const res  = await fetch("/api/draft-reply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.draft) { setDraft(json.draft); setFeedback(""); }
      else showToast(json.error ?? "Draft failed", false);
    } catch {
      showToast("Draft request failed", false);
    } finally {
      setDraftLoading(false);
    }
  }

  // ── Send email ──────────────────────────────────────────────────────────────
  async function sendEmail() {
    if (!inquiry || !subject.trim() || !draft.trim()) return;
    setSendLoading(true);
    try {
      // Pass latest threadId so reply stays in the same Gmail thread
      const latestThreadId = messages.at(-1)?.threadId;
      const res  = await fetch("/api/gmail/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          to: inquiry.email, subject, body: draft,
          ...(latestThreadId ? { threadId: latestThreadId } : {}),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        showToast(`✓ Sent to ${inquiry.name}`);
        await supabase.from("inquiries").update({ status: "responded" }).eq("id", inquiry.id);
        setStatus("responded");
        setDraft("");
        // Refresh thread to show the sent message
        setTimeout(() => fetchThread(inquiry.email), 1500);
      } else {
        showToast(json.error ?? "Send failed", false);
      }
    } catch {
      showToast("Send failed", false);
    } finally {
      setSendLoading(false);
    }
  }

  async function updateStatus(s: string) {
    if (!inquiry) return;
    await supabase.from("inquiries").update({ status: s }).eq("id", inquiry.id);
    setStatus(s);
    showToast(`Marked as ${s}`);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!inquiry) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  const statusColor = status === "new" ? "#10b981" : status === "responded" ? "#3b82f6" : "#94a3b8";
  const statusBg    = status === "new" ? "rgba(16,185,129,0.1)" : status === "responded" ? "rgba(59,130,246,0.08)" : "rgba(148,163,184,0.08)";

  return (
    <div className="min-h-screen" style={{ background: "#f1f5f9" }}>

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/admin?tab=inquiries")}
          className="text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-slate-600">
          ← Back
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: statusBg, color: statusColor }}>
            {status === "new" ? "● New" : status === "responded" ? "✓ Responded" : "○ Archived"}
          </span>
          <p className="text-sm font-black text-slate-900 truncate">{inquiry.name}</p>
          {inquiry.session_type && (
            <p className="text-xs text-slate-400 hidden sm:block truncate">· {inquiry.session_type}</p>
          )}
        </div>
        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {(["new", "responded", "archived"] as const).map(s => (
            <button key={s} onClick={() => updateStatus(s)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80 capitalize hidden sm:block"
              style={status === s
                ? { background: statusBg, color: statusColor }
                : { background: "rgba(0,0,0,0.04)", color: "#94a3b8" }}>
              {s === "new" ? "New" : s === "responded" ? "Responded" : "Archive"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main two-column layout ── */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

        {/* ── LEFT: Gmail thread ── */}
        <div className="space-y-3">
          {/* Thread header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">Email Conversation</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {threadLoading ? "Loading…" : messages.length === 0
                  ? "No prior emails found in Gmail"
                  : `${messages.length} message${messages.length === 1 ? "" : "s"} with ${inquiry.name}`}
              </p>
            </div>
            <button onClick={() => fetchThread(inquiry.email)} disabled={threadLoading}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center gap-1.5"
              style={{ background: C.p1_08, color: C.p1 }}>
              {threadLoading ? <><span className="animate-spin inline-block">◌</span> Loading…</> : "↻ Refresh"}
            </button>
          </div>

          {/* Original inquiry card */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="h-[3px]" style={{ background: C.grad12 }} />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Contact Form Submission</p>
                  <p className="text-xs text-slate-500">
                    {new Date(inquiry.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-right">
                  <a href={`mailto:${inquiry.email}`} className="font-semibold hover:underline" style={{ color: C.p1 }}>{inquiry.email}</a>
                  {inquiry.phone && <span className="text-slate-500">{inquiry.phone}</span>}
                  {inquiry.session_type && <span className="font-semibold text-slate-600">{inquiry.session_type}</span>}
                  {inquiry.date_in_mind && <span className="text-slate-500">{inquiry.date_in_mind}</span>}
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{inquiry.message}</p>
            </div>
          </div>

          {/* Gmail messages */}
          {threadLoading ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-violet-300 border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">Loading Gmail conversation…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm font-semibold text-slate-500">No emails found yet</p>
              <p className="text-xs text-slate-400 mt-1">Emails to/from {inquiry.email} will appear here</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOpen   = expanded[msg.id] ?? false;
              const body     = bodies[msg.id];
              const loading  = bodyLoading[msg.id];
              return (
                <div key={msg.id}
                  className="bg-white rounded-2xl border overflow-hidden transition-shadow hover:shadow-sm"
                  style={{ borderColor: msg.isMe ? C.p1_20 : "#e2e8f0" }}>
                  {/* Header — click to expand + lazy-load body */}
                  <button
                    onClick={() => toggleExpand(msg.id)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50/60 transition-colors">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 mt-0.5"
                         style={msg.isMe ? { background: C.grad12, color: "#fff" } : { background: "rgba(148,163,184,0.15)", color: "#475569" }}>
                      {msg.fromName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900">
                          {msg.isMe ? "You" : msg.fromName}
                          {msg.isMe && <span className="text-xs font-normal text-slate-400 ml-1">→ {inquiry.name}</span>}
                        </p>
                        <p className="text-xs text-slate-400 flex-shrink-0">{fmtDate(msg.timestamp)}</p>
                      </div>
                      {!isOpen && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{msg.snippet}</p>
                      )}
                    </div>
                    <span className="text-slate-300 text-xs flex-shrink-0 mt-1">{isOpen ? "▲" : "▼"}</span>
                  </button>

                  {/* Full body — loaded on demand */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                      {loading ? (
                        <div className="flex items-center gap-2 py-4 text-slate-400">
                          <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-transparent animate-spin flex-shrink-0"/>
                          <span className="text-xs">Loading message…</span>
                        </div>
                      ) : (
                        <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                          {body ? stripQuotes(body) : msg.snippet}
                        </pre>
                      )}
                      <p className="text-[10px] text-slate-300 mt-3 font-medium">{msg.subject} · {msg.date}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── RIGHT: AI Draft + Send (sticky) ── */}
        <div className="lg:sticky lg:top-[73px] space-y-4">

          {/* Draft panel */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="h-[3px]" style={{ background: C.grad12 }} />
            <div className="p-5 space-y-4">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-black"
                       style={{ background: C.grad12 }}>✦</div>
                  <p className="text-sm font-black text-slate-900">AI Draft Reply</p>
                </div>
                <button onClick={() => generateDraft()} disabled={draftLoading}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
                  style={{ background: C.grad12, color: "#fff" }}>
                  {draftLoading
                    ? <><span className="animate-spin inline-block">◌</span> Writing…</>
                    : draft ? "↻ Regenerate" : "✦ Draft with AI"}
                </button>
              </div>

              {/* Context indicator */}
              {messages.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                     style={{ background: "rgba(16,185,129,0.07)", color: "#059669" }}>
                  <span>✓</span>
                  <span>{messages.length} prior email{messages.length > 1 ? "s" : ""} loaded — AI will use conversation history</span>
                </div>
              )}

              {draft ? (
                <div className="space-y-3">
                  {/* Subject */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Subject</label>
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                      className="w-full text-sm text-slate-700 px-3 py-2 rounded-xl outline-none font-medium"
                      style={{ border: `1px solid ${C.p1_20}`, background: "#fff", fontFamily: "inherit" }} />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Message</label>
                    <textarea
                      value={draft} onChange={e => setDraft(e.target.value)}
                      rows={12}
                      className="w-full text-sm text-slate-700 leading-relaxed rounded-xl p-3 resize-y outline-none"
                      style={{ border: `1px solid ${C.p1_20}`, background: C.p1_04, fontFamily: "inherit" }} />
                  </div>

                  {/* Send */}
                  <button onClick={sendEmail}
                    disabled={!subject.trim() || !draft.trim() || sendLoading}
                    className="w-full text-sm font-black py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff" }}>
                    {sendLoading ? <><span className="animate-spin inline-block">◌</span> Sending…</> : "✉️ Send from Gmail"}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center">
                    Sends from {myEmail || "your Gmail"} · lands in Sent Mail · marks inquiry as Responded
                  </p>

                  {/* Refine */}
                  <div className="pt-1 border-t border-slate-100 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Refine</p>
                    <div className="flex gap-2">
                      <input type="text" value={feedback} onChange={e => setFeedback(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && feedback.trim()) generateDraft(feedback); }}
                        placeholder='e.g. "be more direct" · "add turnaround time"'
                        className="flex-1 text-xs px-3 py-2 rounded-xl outline-none"
                        style={{ border: `1px solid ${C.p1_20}`, background: "#fff", fontFamily: "inherit" }} />
                      <button onClick={() => { if (feedback.trim()) generateDraft(feedback); }}
                        disabled={!feedback.trim() || draftLoading}
                        className="text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-30 flex-shrink-0"
                        style={{ background: C.grad12, color: "#fff" }}>
                        Refine
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-8 text-center" style={{ border: `1px dashed ${C.p1_20}`, background: C.p1_04 }}>
                  <p className="text-2xl mb-2">✦</p>
                  <p className="text-sm font-semibold text-slate-600">Click Draft with AI to start</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {messages.length > 0
                      ? "Claude will read the full conversation before writing"
                      : "Uses your style guide + live availability data"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Client details card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Client Details</p>
            {[
              { label: "Email",    value: <a href={`mailto:${inquiry.email}`} className="hover:underline font-medium" style={{ color: C.p1 }}>{inquiry.email}</a> },
              inquiry.phone       && { label: "Phone",   value: <a href={`tel:${inquiry.phone}`} className="hover:underline text-slate-700">{inquiry.phone}</a> },
              inquiry.session_type && { label: "Session", value: inquiry.session_type },
              inquiry.date_in_mind && { label: "Date",    value: inquiry.date_in_mind },
            ].filter(Boolean).map((row, i) => {
              const r = row as { label: string; value: ReactNode };
              return (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 min-w-[60px] pt-0.5">{r.label}</span>
                  <span className="text-sm text-slate-700">{r.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white transition-all"
             style={{ background: toast.ok ? "#10b981" : "#ef4444" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
