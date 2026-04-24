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

// Detect school name from free-form text (message, session_type, etc.)
function detectSchool(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bsjsu\b|san jose state/.test(t))               return "SJSU";
  if (/\buc berkeley\b|\bberkeley\b|cal bears/.test(t)) return "UC Berkeley";
  if (/\bsfsu\b|sf state|san francisco state/.test(t))  return "SF State";
  if (/\bcsueb\b|cal state east bay|eastbay/.test(t))   return "CSUEB";
  if (/\busf\b|university of san francisco/.test(t))    return "USF";
  if (/\bstanford\b/.test(t))                           return "Stanford";
  if (/\bsanta clara\b|\bscu\b/.test(t))                return "Santa Clara";
  if (/\bsacramento state\b|\bsac state\b|\bcsus\b/.test(t)) return "Sac State";
  if (/\bchico state\b|\bcsuchico\b/.test(t))           return "Chico State";
  if (/\bfresno state\b/.test(t))                       return "Fresno State";
  return null;
}

// Build a smart default subject for a new outreach
function buildSubject(inquiry: { session_type: string | null; message: string; date_in_mind: string | null }): string {
  const isGrad = (inquiry.session_type ?? "").toLowerCase().includes("grad");
  if (!isGrad) return `Re: Your ${inquiry.session_type ?? "photography"} inquiry`;
  const haystack = [inquiry.message, inquiry.session_type, inquiry.date_in_mind].filter(Boolean).join(" ");
  const school   = detectSchool(haystack);
  return school ? `${school} Graduation Inquiry` : "Graduation Inquiry";
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
  const [lastAiDraft,   setLastAiDraft]   = useState("");   // snapshot of the AI-generated text for teaching
  const [draftLoading,  setDraftLoading]  = useState(false);
  const [polishLoading, setPolishLoading] = useState(false);
  const [subject,       setSubject]       = useState("");
  const [feedback,      setFeedback]      = useState("");
  const [sendLoading,   setSendLoading]   = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [status,        setStatus]        = useState("new");

  // ── Things to Remember ─────────────────────────────────────────────────────
  const [notes,         setNotes]         = useState("");
  const [notesSaving,   setNotesSaving]   = useState(false);
  const [notesSaved,    setNotesSaved]    = useState(false);

  // ── Teach AI state ──────────────────────────────────────────────────────────
  const [actualSent,    setActualSent]    = useState("");
  const [manualAiDraft, setManualAiDraft] = useState(""); // used when no AI draft was generated
  const [learnLoading,  setLearnLoading]  = useState(false);
  const [learnedRules,  setLearnedRules]  = useState<string[] | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!checkAuth()) { router.push("/admin"); return; }
    if (!inquiryId) return;

    supabase.from("inquiries").select("*").eq("id", inquiryId).single()
      .then(async ({ data }) => {
        if (!data) { router.push("/admin?tab=inquiries"); return; }
        setInquiry(data);
        setStatus(data.status);
        setSubject(buildSubject(data));   // smart subject — updated again after thread loads
        fetchThread(data.email);
        // Load saved notes for this inquiry
        const { data: nd } = await supabase
          .from("site_settings").select("value")
          .eq("key", `inquiry_notes_${data.id}`).single();
        if (nd?.value) setNotes(nd.value);
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
      if (json.draft) {
        setDraft(json.draft);
        setLastAiDraft(json.draft);   // remember the original AI text for "teach" comparison
        setLearnedRules(null);        // reset any previous learning result
        setActualSent("");
        setFeedback("");
      }
      else showToast(json.error ?? "Draft failed", false);
    } catch {
      showToast("Draft request failed", false);
    } finally {
      setDraftLoading(false);
    }
  }

  // ── Polish: fix typos / convert bullet points to email ─────────────────────
  async function polishDraft() {
    if (!inquiry || !draft.trim()) return;
    setPolishLoading(true);
    try {
      const res  = await fetch("/api/draft-reply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         inquiry.name,
          email:        inquiry.email,
          message:      inquiry.message,
          session_type: inquiry.session_type,
          raw_draft:    draft,
        }),
      });
      const json = await res.json();
      if (json.draft) {
        setDraft(json.draft);
        showToast("✓ Polished");
      } else {
        showToast(json.error ?? "Polish failed", false);
      }
    } catch {
      showToast("Polish failed", false);
    } finally {
      setPolishLoading(false);
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

  // ── Save notes for this inquiry ────────────────────────────────────────────
  async function saveNotes(val: string) {
    if (!inquiryId) return;
    setNotesSaving(true);
    await supabase.from("site_settings").upsert(
      { key: `inquiry_notes_${inquiryId}`, value: val, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setNotesSaving(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  // ── Teach AI: compare AI draft vs actual sent, append rules to style guide ──
  async function learnFromReply() {
    const aiDraftToUse = lastAiDraft || manualAiDraft.trim();
    if (!inquiry || !aiDraftToUse || !actualSent.trim()) return;
    setLearnLoading(true);
    try {
      // Step 1: analyze the diff and extract rules
      const analyzeRes = await fetch("/api/draft-reply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        inquiry.name,
          email:       inquiry.email,
          message:     inquiry.message,
          ai_draft:    aiDraftToUse,
          actual_sent: actualSent.trim(),
        }),
      });
      const analyzeJson = await analyzeRes.json() as { rules?: string[]; error?: string };

      if (!analyzeJson.rules?.length) {
        showToast(analyzeJson.error ?? "Replies look similar — nothing new to learn", false);
        return;
      }

      const newRules = analyzeJson.rules;

      // Step 2: fetch existing reply_style and append new rules
      const { data: existing } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "reply_style")
        .single();

      const current  = existing?.value?.trim() ?? "";
      const newLines = newRules.map(r => `- ${r}`).join("\n");
      const merged   = current ? `${current}\n${newLines}` : newLines;

      // Step 3: save back
      await supabase.from("site_settings").upsert(
        { key: "reply_style", value: merged, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

      setLearnedRules(newRules);
      setActualSent("");
      setManualAiDraft("");
      showToast(`✓ ${newRules.length} rule${newRules.length === 1 ? "" : "s"} added to style guide`);
    } catch {
      showToast("Analysis failed — try again", false);
    } finally {
      setLearnLoading(false);
    }
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

          {/* ── Compose + Send panel ── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="h-[3px]" style={{ background: C.grad12 }} />
            <div className="p-5 space-y-3">

              {/* Header row */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-black"
                       style={{ background: C.grad12 }}>✉</div>
                  <p className="text-sm font-black text-slate-900">Compose Reply</p>
                </div>
                {/* AI action buttons */}
                <div className="flex gap-2">
                  <button onClick={() => polishDraft()} disabled={polishLoading || !draft.trim()}
                    title="Fix typos, convert bullet points to paragraphs"
                    className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-30 flex items-center gap-1"
                    style={{ background: "rgba(245,158,11,0.1)", color: "#d97706", border: "1px solid rgba(245,158,11,0.25)" }}>
                    {polishLoading
                      ? <><span className="animate-spin inline-block text-[10px]">◌</span> Polishing…</>
                      : "✨ Polish"}
                  </button>
                  <button onClick={() => generateDraft()} disabled={draftLoading}
                    className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
                    style={{ background: C.grad12, color: "#fff" }}>
                    {draftLoading
                      ? <><span className="animate-spin inline-block text-[10px]">◌</span> Writing…</>
                      : "✦ Draft with AI"}
                  </button>
                </div>
              </div>

              {/* Context indicator */}
              {messages.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                     style={{ background: "rgba(16,185,129,0.07)", color: "#059669" }}>
                  <span>✓</span>
                  <span>{messages.length} prior email{messages.length > 1 ? "s" : ""} loaded — AI uses full conversation</span>
                </div>
              )}

              {/* Subject — always visible */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full text-slate-700 px-3 py-2 rounded-xl outline-none font-medium"
                  style={{ border: `1px solid ${C.p1_20}`, background: "#fff", fontFamily: "inherit", fontSize: "16px" }} />
              </div>

              {/* Body — always visible */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                  Message
                  <span className="normal-case font-normal text-slate-300 ml-1">· type your own, paste, or use AI above</span>
                </label>
                <textarea
                  value={draft} onChange={e => setDraft(e.target.value)}
                  rows={11}
                  placeholder={"Write your reply here…\n\nTip: type in bullet points and hit ✨ Polish to auto-format into a proper email."}
                  className="w-full text-slate-700 leading-relaxed rounded-xl p-3 resize-none sm:resize-y outline-none"
                  style={{ border: `1px solid ${C.p1_20}`, background: C.p1_04, fontFamily: "inherit", fontSize: "16px" }} />
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

              {/* AI Refine — only useful after AI drafted something */}
              {lastAiDraft && (
                <div className="pt-1 border-t border-slate-100 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Refine AI draft</p>
                  <div className="flex gap-2">
                    <input type="text" value={feedback} onChange={e => setFeedback(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && feedback.trim()) generateDraft(feedback); }}
                      placeholder='e.g. "be more direct" · "add turnaround time"'
                      className="flex-1 px-3 py-2 rounded-xl outline-none"
                      style={{ border: `1px solid ${C.p1_20}`, background: "#fff", fontFamily: "inherit", fontSize: "16px" }} />
                    <button onClick={() => { if (feedback.trim()) generateDraft(feedback); }}
                      disabled={!feedback.trim() || draftLoading}
                      className="text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-30 flex-shrink-0"
                      style={{ background: C.grad12, color: "#fff" }}>
                      Refine
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Things to Remember ── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#8b5cf6,#a78bfa)" }} />
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
                       style={{ background: "rgba(139,92,246,0.12)", color: "#7c3aed" }}>📌</div>
                  <p className="text-sm font-black text-slate-900">Things to Remember</p>
                </div>
                {notesSaving
                  ? <span className="text-[10px] text-slate-400">Saving…</span>
                  : notesSaved
                    ? <span className="text-[10px] font-bold text-emerald-500">Saved ✓</span>
                    : null}
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={e => { if (e.target.value !== "") saveNotes(e.target.value); }}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveNotes(notes); }}
                rows={5}
                placeholder={"Jot down anything important about this client…\n\ne.g. wants campus + city shots, bringing her mom, prefers afternoon light"}
                className="w-full text-slate-700 leading-relaxed rounded-xl p-3 resize-none sm:resize-y outline-none"
                style={{ border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.03)", fontFamily: "inherit", fontSize: "16px" }} />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400">Auto-saves on blur · ⌘↵ to save now</p>
                <button
                  onClick={() => saveNotes(notes)}
                  disabled={notesSaving || !notes.trim()}
                  className="text-[11px] font-bold px-3 py-1 rounded-lg disabled:opacity-30 transition-all hover:opacity-80"
                  style={{ background: "rgba(139,92,246,0.1)", color: "#7c3aed" }}>
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* ── Learn from Reply — always visible ── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#f59e0b,#fbbf24)" }} />
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black"
                     style={{ background: "rgba(245,158,11,0.12)", color: "#d97706" }}>✎</div>
                <p className="text-sm font-black text-slate-900">Learn from reply</p>
              </div>

              {learnedRules ? (
                /* ── Success: show extracted rules ── */
                <div className="rounded-xl p-4 space-y-2"
                     style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                    ✓ {learnedRules.length} rule{learnedRules.length === 1 ? "" : "s"} saved to style guide
                  </p>
                  <ul className="space-y-1.5">
                    {learnedRules.map((rule, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5 flex-shrink-0 text-xs">–</span>
                        <span className="text-xs text-slate-700 leading-snug">{rule}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-slate-400 pt-1">Applied to all future drafts automatically.</p>
                  <button onClick={() => { setLearnedRules(null); setActualSent(""); setManualAiDraft(""); }}
                    className="text-xs font-bold" style={{ color: C.p1 }}>
                    ↩ Analyze another
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Paste what you actually sent. Claude compares it to the AI draft and saves the style differences permanently.
                  </p>

                  {/* If an AI draft was generated this session, show it dimmed — otherwise let them paste it */}
                  {lastAiDraft ? (
                    <div className="rounded-xl p-3 space-y-1"
                         style={{ background: "rgba(148,163,184,0.07)", border: "1px solid rgba(148,163,184,0.15)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">AI draft (this session)</p>
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 whitespace-pre-wrap">{lastAiDraft}</p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                        AI draft <span className="normal-case font-normal text-slate-300">(paste here if you didn&apos;t use Draft with AI)</span>
                      </label>
                      <textarea
                        value={manualAiDraft}
                        onChange={e => setManualAiDraft(e.target.value)}
                        rows={4}
                        placeholder="Paste the AI-generated draft here…"
                        className="w-full text-slate-500 leading-relaxed rounded-xl p-3 resize-none sm:resize-y outline-none"
                        style={{ border: "1px solid rgba(148,163,184,0.25)", background: "rgba(148,163,184,0.04)", fontFamily: "inherit", fontSize: "16px" }} />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                      What you actually sent
                    </label>
                    <textarea
                      value={actualSent}
                      onChange={e => setActualSent(e.target.value)}
                      rows={6}
                      placeholder="Paste the email you sent here…"
                      className="w-full text-slate-700 leading-relaxed rounded-xl p-3 resize-none sm:resize-y outline-none"
                      style={{ border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.03)", fontFamily: "inherit", fontSize: "16px" }} />
                  </div>

                  <button
                    onClick={learnFromReply}
                    disabled={(!lastAiDraft && !manualAiDraft.trim()) || !actualSent.trim() || learnLoading}
                    className="w-full text-sm font-black py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff" }}>
                    {learnLoading
                      ? <><span className="animate-spin inline-block">◌</span> Analyzing…</>
                      : "✎ Analyze & save to style guide"}
                  </button>
                </>
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
