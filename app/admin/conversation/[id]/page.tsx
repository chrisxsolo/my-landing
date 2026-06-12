"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/colors";
import { checkAuth } from "@/lib/adminAuth";
import type { GmailMessage } from "@/app/api/gmail/thread/route";
import { buildReminderEmail, type ReminderEmailType } from "@/lib/reminderEmail";
import {
  loadAdminInquiry,
  updateAdminInquiry,
  type AdminInquiry,
} from "@/lib/adminInquiries";
import { CONV, STATUS_META, Icon, Spinner, Panel, PanelHead, ConvStyles } from "../ui";

// ─────────────────────────────────────────────────────────────────────────────

type Inquiry = AdminInquiry;

function fmt12h(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return t;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

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
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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

// Extract a human-readable school name from a .edu email domain
function detectSchoolFromEmail(email: string): string | null {
  const match = email.match(/@([\w.-]+\.edu)/i);
  if (!match) return null;
  const domain = match[1].toLowerCase();
  // Check known domains first
  const known: Record<string, string> = {
    "sjsu.edu": "SJSU", "berkeley.edu": "UC Berkeley", "sfsu.edu": "SF State",
    "csueastbay.edu": "CSUEB", "usfca.edu": "USF", "stanford.edu": "Stanford",
    "scu.edu": "Santa Clara", "csus.edu": "Sac State", "csuchico.edu": "Chico State",
    "csufresno.edu": "Fresno State",
  };
  if (known[domain]) return known[domain];
  // Fall back to a generic prettified name from the subdomain
  const base = domain.replace(/\.edu$/, "").split(".").at(-1) ?? domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// Build a smart default subject for a new outreach
function buildSubject(inquiry: { session_type: string | null; message: string; date_in_mind: string | null; email?: string }): string {
  const isGrad = (inquiry.session_type ?? "").toLowerCase().includes("grad");
  if (!isGrad) return `Re: Your ${inquiry.session_type ?? "photography"} inquiry`;
  const haystack = [inquiry.message, inquiry.session_type, inquiry.date_in_mind].filter(Boolean).join(" ");
  const school   = detectSchool(haystack)
    ?? (inquiry.email ? detectSchoolFromEmail(inquiry.email) : null);
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
  const [lastAiDraft,     setLastAiDraft]     = useState("");   // latest AI draft (updated on every generate/refine)
  const [originalAiDraft, setOriginalAiDraft] = useState("");   // first AI draft this session — never overwritten
  const [draftLoading,  setDraftLoading]  = useState(false);
  const [polishLoading, setPolishLoading] = useState(false);
  const [draftSaving,   setDraftSaving]   = useState(false);
  const [draftSaved,    setDraftSaved]    = useState(false);
  const [voiceActive,   setVoiceActive]   = useState(false);
  const [voiceError,    setVoiceError]    = useState<string | null>(null);
  const [subject,       setSubject]       = useState("");
  const [feedback,      setFeedback]      = useState("");
  const [refineSaved,      setRefineSaved]      = useState<string | null>(null);
  const [aiDraftExpanded,  setAiDraftExpanded]  = useState(false);
  const [sendLoading,   setSendLoading]   = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [status,        setStatus]        = useState("new");

  // ── Payment ────────────────────────────────────────────────────────────────
  const [paymentLoading,    setPaymentLoading]    = useState(false);
  const [sessionDateInput,  setSessionDateInput]  = useState("");
  const [previewHtml,       setPreviewHtml]       = useState<string | null>(null);
  const [confirmLoading,    setConfirmLoading]    = useState(false);
  const [previewLoading,    setPreviewLoading]    = useState(false);
  const [customComment,     setCustomComment]     = useState("");
  // Session date detection
  const [detectedDate,      setDetectedDate]      = useState<{ date: string; readable: string; confidence: string } | null>(null);
  const [detectLoading,     setDetectLoading]     = useState(false);
  const [dateConfirming,    setDateConfirming]    = useState(false);
  // Day-before reminder
  const [reminderLoading,   setReminderLoading]   = useState(false);

  // Email thread — show all messages by default
  const [threadExpanded, setThreadExpanded] = useState(true);

  // Session reminders panel
  type ReminderDraft = { id: string; label: string; emoji: string; subject: string; body: string; html?: string };
  const [remindersOpen,    setRemindersOpen]    = useState(false);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [reminders,        setReminders]        = useState<ReminderDraft[]>([]);
  const [sendingReminder,  setSendingReminder]  = useState<string | null>(null);

  // ── Contract ───────────────────────────────────────────────────────────────
  const [contractText,    setContractText]    = useState<string | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractCopied,  setContractCopied]  = useState(false);
  const [copiedField,     setCopiedField]     = useState<string | null>(null);

  function copyField(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1800);
    });
  }

  // ── Sunset time ────────────────────────────────────────────────────────────
  const [sunsetInfo,    setSunsetInfo]    = useState<{ sunset: string; goldenStart: string } | null>(null);
  const [sunsetLoading, setSunsetLoading] = useState(false);
  const [sunsetDate,    setSunsetDate]    = useState<string>("");

  // ── Train AI chat (per-conversation) ──────────────────────────────────────
  const [trainMessages, setTrainMessages] = useState<{role:"user"|"assistant";content:string}[]>([]);
  const [trainInput,    setTrainInput]    = useState("");
  const [trainLoading,  setTrainLoading]  = useState(false);
  const [trainSaved,    setTrainSaved]    = useState<string[]>([]);
  const trainChatRef = useRef<HTMLDivElement>(null);

  // ── Teach AI state ──────────────────────────────────────────────────────────
  const [actualSent,    setActualSent]    = useState("");
  const [manualAiDraft, setManualAiDraft] = useState(""); // used when no AI draft was generated
  const [learnLoading,  setLearnLoading]  = useState(false);
  const [learnedRules,  setLearnedRules]  = useState<string[] | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // Try to parse a free-form date string (e.g. "June 20", "June 20th") into YYYY-MM-DD.
  // Requires a recognizable month name — rejects vague strings like "Flexible".
  function tryParseDate(str: string): string | null {
    if (!str) return null;
    const year = new Date().getFullYear();

    // Try each comma/semicolon/or/and-separated segment — take the first that parses
    for (const seg of str.split(/[,;]|\bor\b|\band\b/i).map(s => s.trim()).filter(Boolean)) {
      // Numeric M/D/YY or M/D/YYYY (e.g. "6/19/26" or "6/19/2026")
      const num = seg.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (num) {
        const [, m, d, y] = num;
        const fullYear = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
        const date = new Date(fullYear, parseInt(m) - 1, parseInt(d));
        if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
      }

      // Month-name format (e.g. "June 19", "June 19th 2026", "June 13 afternoon/evening")
      const hasMonth = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(seg);
      if (hasMonth) {
        const cleaned = seg
          .replace(/(\d+)(st|nd|rd|th)/gi, "$1")
          .replace(/\b(morning|afternoon|evening|night|am|pm|noon|midnight|early|late)\b/gi, "")
          .replace(/[/\\]/g, " ")
          .replace(/\s+/g, " ").trim();
        // Check if the string already contains a 4-digit year
        const alreadyHasYear = /\b(20\d{2})\b/.test(cleaned);
        const attempts = alreadyHasYear ? [cleaned] : [`${cleaned} ${year}`, `${cleaned} ${year + 1}`];
        for (const attempt of attempts) {
          const d = new Date(attempt);
          if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
        }
      }
    }
    return null;
  }

  // Fetch sunset + golden-hour start for a Bay Area date (San Jose coords)
  async function fetchSunset(dateStr: string) {
    setSunsetDate(dateStr);
    setSunsetLoading(true);
    setSunsetInfo(null);
    try {
      const res = await fetch(
        `https://api.sunrise-sunset.org/json?lat=37.3382&lng=-121.8863&date=${dateStr}&formatted=0`
      );
      const json = await res.json() as { results?: { sunset?: string }; status?: string };
      if (json.status === "OK" && json.results?.sunset) {
        const sunsetUTC   = new Date(json.results.sunset);
        const goldenUTC   = new Date(sunsetUTC.getTime() - 90 * 60 * 1000);
        const fmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
        setSunsetInfo({ sunset: fmt(sunsetUTC), goldenStart: fmt(goldenUTC) });
      }
    } catch { /* silently fail */ }
    finally { setSunsetLoading(false); }
  }

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!checkAuth()) { router.push("/admin"); return; }
    if (!inquiryId) return;

    loadAdminInquiry(inquiryId)
      .then(async (data) => {
        if (!data) { router.push("/admin?tab=inquiries"); return; }
        setInquiry(data);
        setStatus(data.status);
        setSubject(buildSubject(data));
        fetchThread(data.email);
        // Show sunset immediately — confirmed date wins, fall back to client's requested date
        const sunsetDate = data.session_date ?? tryParseDate(data.date_in_mind ?? "");
        if (sunsetDate) fetchSunset(sunsetDate);
      })
      .catch((error) => {
        console.error("[conversation] inquiry load failed:", error);
        router.push("/admin?tab=inquiries");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  // Load saved drafts — localStorage first (fast), fall back to Supabase (cross-device)
  useEffect(() => {
    if (!inquiryId) return;
    const localDraft    = localStorage.getItem(`draft_${inquiryId}`);
    const localAi       = localStorage.getItem(`ai_draft_${inquiryId}`);
    const localOriginal = localStorage.getItem(`original_ai_draft_${inquiryId}`);
    if (localDraft)    setDraft(localDraft);
    if (localAi)       setLastAiDraft(localAi);
    if (localOriginal) setOriginalAiDraft(localOriginal);

    // Only hit the server if localStorage was empty (other device may have saved).
    // Drafts now sync through /api/admin/drafts (service role) — no browser
    // access to site_settings.
    if (!localDraft || !localAi || !localOriginal) {
      fetch(`/api/admin/drafts?inquiryId=${inquiryId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          if (data.draft && !localDraft) {
            setDraft(data.draft);
            localStorage.setItem(`draft_${inquiryId}`, data.draft);
          }
          if (data.ai_draft && !localAi) {
            setLastAiDraft(data.ai_draft);
            localStorage.setItem(`ai_draft_${inquiryId}`, data.ai_draft);
          }
          if (data.original_ai_draft && !localOriginal) {
            setOriginalAiDraft(data.original_ai_draft);
            localStorage.setItem(`original_ai_draft_${inquiryId}`, data.original_ai_draft);
          }
        })
        .catch(() => {});
    }
  }, [inquiryId]);

  // Persist compose draft to localStorage whenever it changes
  useEffect(() => {
    if (!inquiryId) return;
    if (draft) localStorage.setItem(`draft_${inquiryId}`, draft);
    else localStorage.removeItem(`draft_${inquiryId}`);
  }, [draft, inquiryId]);

  // Persist AI draft to localStorage so it survives page refreshes
  useEffect(() => {
    if (!inquiryId) return;
    if (lastAiDraft) localStorage.setItem(`ai_draft_${inquiryId}`, lastAiDraft);
    else localStorage.removeItem(`ai_draft_${inquiryId}`);
  }, [lastAiDraft, inquiryId]);

  // Persist original AI draft — written once, never cleared until session reset
  useEffect(() => {
    if (!inquiryId || !originalAiDraft) return;
    localStorage.setItem(`original_ai_draft_${inquiryId}`, originalAiDraft);
  }, [originalAiDraft, inquiryId]);

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

      // Most recent email body — used so AI replies to what was last said, not the original form
      const lastMsg = messages.at(-1);
      const latestBody = lastMsg
        ? (bodies[lastMsg.id] ? stripQuotes(bodies[lastMsg.id]) : lastMsg.snippet)
        : null;

      // Fetch similar sent emails for tone matching (same as polishDraft does)
      const gmailQuery = buildGmailQuery(inquiry.message, inquiry.session_type);
      const gmailRes = await fetch(
        `/api/gmail/similar-sent?query=${encodeURIComponent(gmailQuery)}`
      ).catch(() => null);
      const gmailJson = gmailRes?.ok ? await gmailRes.json().catch(() => null) : null;
      const gmailExamples: string[] = gmailJson?.examples ?? [];

      const payload: Record<string, string | string[] | null> = {
        name:                inquiry.name,
        email:               inquiry.email,
        phone:               inquiry.phone,
        session_type:        inquiry.session_type,
        date_in_mind:        inquiry.date_in_mind,
        message:             inquiry.message,
        school:              inquiry.school,
        people:              inquiry.people,
        preferred_time:      inquiry.preferred_time,
        location:            inquiry.location,
        instagram:           inquiry.instagram,
        thread_context:      threadContext ?? null,
        latest_message_body: latestBody ?? null,
        latest_message_from: lastMsg ? (lastMsg.isMe ? "me" : "client") : null,
        ...(gmailExamples.length ? { gmail_examples: gmailExamples } : {}),
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
        setLastAiDraft(json.draft);
        setLearnedRules(null);
        setFeedback("");
        if (json.saved_rule) {
          setRefineSaved(json.saved_rule);
          setTimeout(() => setRefineSaved(null), 6000);
        }
        // Lock in the original draft on first generate only (not refinements)
        const isRefine = Boolean(refeedback);
        const draftPayload: { inquiryId: number | string; draft: string; ai_draft: string; original_ai_draft?: string } = {
          inquiryId,
          draft: json.draft,
          ai_draft: json.draft,
        };
        if (!isRefine && !originalAiDraft) {
          setOriginalAiDraft(json.draft);
          draftPayload.original_ai_draft = json.draft;
        }
        // Persist server-side (service role) so draft is accessible on any device
        await fetch("/api/admin/drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload),
        }).catch(() => {});
      }
      else showToast(json.error ?? "Draft failed", false);
    } catch {
      showToast("Draft request failed", false);
    } finally {
      setDraftLoading(false);
    }
  }

  // ── Polish: fix typos / convert bullet points to email ─────────────────────

  // Derive Gmail search keywords from the draft text + inquiry context so we
  // can pull matching sent emails as tone examples.
  function buildGmailQuery(text: string, sessionType: string | null): string {
    const haystack = `${text} ${sessionType ?? ""}`.toLowerCase();
    const terms: string[] = [];

    if (/confirm|confirmed|session date|meeting point|my number|deposit paid|signed|contract/.test(haystack))
      terms.push("confirmed session meeting point");
    if (/first reply|inquiry|interested|reach out|session type|packages|pricing/.test(haystack))
      terms.push("photography inquiry packages");
    if (/reminder|day before|tomorrow|heads up/.test(haystack))
      terms.push("session reminder tomorrow");
    if (/reschedule|change.*date|move.*date/.test(haystack))
      terms.push("reschedule session");
    if (/cancel/.test(haystack))
      terms.push("cancel session");
    if (/location|shoot at|meet at/.test(haystack))
      terms.push("location directions meet");

    // Always include session type keywords so results stay relevant
    if (sessionType) terms.push(sessionType.split(" ")[0]);

    return terms.length ? terms.join(" ") : "photography session";
  }

  async function polishDraft(textOverride?: string) {
    const textToPolish = textOverride ?? draft;
    if (!inquiry || !textToPolish.trim()) return;
    setPolishLoading(true);
    try {
      const threadContext = messages.length > 0
        ? messages.map(m => {
            const body = bodies[m.id] ? stripQuotes(bodies[m.id]).slice(0, 800) : m.snippet;
            return `[${m.isMe ? "Chris" : inquiry.name}]: ${body}`;
          }).join("\n\n")
        : undefined;

      // Fetch similar sent emails in parallel with no blocking
      const gmailQuery = buildGmailQuery(textToPolish, inquiry.session_type);
      const gmailRes = await fetch(
        `/api/gmail/similar-sent?query=${encodeURIComponent(gmailQuery)}`
      ).catch(() => null);
      const gmailJson = gmailRes?.ok ? await gmailRes.json().catch(() => null) : null;
      const gmailExamples: string[] = gmailJson?.examples ?? [];

      const res  = await fetch("/api/draft-reply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:            inquiry.name,
          email:           inquiry.email,
          message:         inquiry.message,
          session_type:    inquiry.session_type,
          thread_context:  threadContext ?? null,
          raw_draft:       textToPolish,
          gmail_examples:  gmailExamples.length ? gmailExamples : undefined,
        }),
      });
      const json = await res.json();
      if (json.draft) {
        setDraft(json.draft);
        setManualAiDraft(json.draft);
        showToast("✓ Polished — pre-filled in Learn from Reply");
      } else {
        showToast(json.error ?? "Polish failed", false);
      }
    } catch {
      showToast("Polish failed", false);
    } finally {
      setPolishLoading(false);
    }
  }

  // ── Voice-to-text (MediaRecorder → Whisper) ───────────────────────────────
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveRecogRef      = useRef<any>(null);
  const voicePreviewRef   = useRef(""); // live interim text shown while recording
  const draftBaseRef      = useRef(""); // text in box before recording started
  const draftRef          = useRef("");
  useEffect(() => { draftRef.current = draft; }, [draft]);

  // Compose textarea — focused by the mobile "Keyboard" button so the native
  // on-screen keyboard (with its built-in dictation mic) slides up.
  const composeRef = useRef<HTMLTextAreaElement | null>(null);
  function focusComposeForDictation() {
    const el = composeRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }

  async function startVoice() {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Snapshot existing text before we start appending live preview
      draftBaseRef.current  = draftRef.current.trimEnd();
      voicePreviewRef.current = "";

      // ── Live preview via SpeechRecognition ──────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR: (new () => any) | undefined = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous     = true;
        rec.interimResults = true;
        rec.lang           = "en-US";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (e: any) => {
          let preview = "";
          for (let i = 0; i < e.results.length; i++) {
            preview += e.results[i][0].transcript;
          }
          voicePreviewRef.current = preview;
          const base = draftBaseRef.current;
          setDraft(base ? base + "\n" + preview : preview);
        };
        rec.onerror = () => { /* ignore — Whisper is the source of truth */ };
        rec.start();
        liveRecogRef.current = rec;
      }

      // ── Audio recording for Whisper ──────────────────────────────────────
      // Prefer mp4 (AAC) — best Whisper compatibility across Safari/mobile and desktop.
      // Fall back to webm/opus for browsers that don't support mp4.
      const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]
        .find(t => MediaRecorder.isTypeSupported(t)) ?? "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        liveRecogRef.current?.stop();
        liveRecogRef.current = null;

        const blob = new Blob(audioChunksRef.current, { type: mime || "audio/mp4" });
        audioChunksRef.current = [];

        if (blob.size < 1000) { setVoiceActive(false); return; }

        setVoiceActive(false);
        setDraftLoading(true);

        // Derive the correct file extension from the actual mime type so Whisper
        // decodes it correctly (Safari records mp4 but the old code sent it as .webm).
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";

        try {
          const fd = new FormData();
          fd.append("audio", blob, `audio.${ext}`);
          if (inquiry) {
            const recentText = messages
              .slice(-6)
              .map(m => stripQuotes(m.snippet ?? "").slice(0, 120))
              .join(" ");
            const ctx = [inquiry.name, inquiry.session_type, recentText].filter(Boolean).join(", ");
            fd.append("context", ctx);
          }
          const res  = await fetch("/api/transcribe", { method: "POST", body: fd });
          const json = await res.json() as { text?: string; error?: string };
          if (json.text) {
            const base = draftBaseRef.current;
            const transcript = base ? base + "\n" + json.text : json.text;
            setDraft(transcript);
            // Auto-polish immediately — pass text directly since state hasn't updated yet
            await polishDraft(transcript);
          } else {
            setVoiceError(json.error ?? "Transcription failed");
            setTimeout(() => setVoiceError(null), 5000);
          }
        } catch {
          setVoiceError("Transcription failed");
          setTimeout(() => setVoiceError(null), 5000);
        } finally {
          setDraftLoading(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setVoiceActive(true);
    } catch {
      setVoiceError("Mic access denied — check browser permissions.");
      setTimeout(() => setVoiceError(null), 5000);
    }
  }

  function stopVoice() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }

  function toggleVoice() {
    if (voiceActive) { stopVoice(); } else { startVoice(); }
  }

  // ── Save draft server-side (cross-device sync via /api/admin/drafts) ──────
  async function saveDraftToCloud() {
    if (!draft.trim()) return;
    setDraftSaving(true);
    try {
      const res = await fetch("/api/admin/drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryId, draft }),
      });
      if (!res.ok) throw new Error("save failed");
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2500);
    } catch {
      showToast("Failed to save draft", false);
    } finally {
      setDraftSaving(false);
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
        const updated = await updateAdminInquiry(inquiry.id, {
          status: "responded",
          reply_sent_at: new Date().toISOString(),
        });
        setInquiry(updated);
        setStatus("responded");

        // Auto-learn from every send — fire and forget (don't block UX)
        if (lastAiDraft) {
          const sentDraft = draft;
          const aiDraft   = lastAiDraft;
          fetch("/api/draft-reply", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name:         inquiry.name,
              email:        inquiry.email,
              message:      inquiry.message,
              ai_draft:     aiDraft,
              actual_sent:  sentDraft,
              perfect_draft: sentDraft.trim() === aiDraft.trim(),
            }),
          }).catch(() => {});
        }

        setDraft("");
        // Clear cloud drafts now that it's sent (server-side, service role)
        await fetch("/api/admin/drafts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inquiryId, kinds: ["draft", "ai_draft"] }),
        }).catch(() => {});
        localStorage.removeItem(`draft_${inquiryId}`);
        localStorage.removeItem(`ai_draft_${inquiryId}`);
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
    try {
      const updated = await updateAdminInquiry(inquiry.id, { status: s });
      setInquiry(updated);
      setStatus(s);
      showToast(`Marked as ${s}`);
    } catch (error) {
      console.error("[conversation] status update failed:", error);
      showToast("Status update failed", false);
    }
  }

  // ── Check payment via Gmail + Claude ──────────────────────────────────────
  async function checkPayment() {
    if (!inquiry) return;
    setPaymentLoading(true);
    try {
      const res = await fetch("/api/check-payment", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiry_id:   inquiry.id,
          email:        inquiry.email,
          name:         inquiry.name,
          session_date: sessionDateInput || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Check failed", false); return; }

      if (json.paid) {
        showToast(`Payment confirmed — ${json.note}`);
        if (json.session_date_booked) showToast(`Calendar marked as booked`);
      } else {
        showToast(json.note || "No payment found yet", false);
      }

      // Refresh inquiry to pick up new payment fields
      const updated = await loadAdminInquiry(inquiry.id);
      if (updated) setInquiry(updated);
    } catch {
      showToast("Payment check failed", false);
    } finally {
      setPaymentLoading(false);
    }
  }

  // ── Payment confirmation email: preview ───────────────────────────────────
  async function previewConfirmation() {
    if (!inquiry) return;
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/payment-confirmation", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ inquiry_id: inquiry.id, mode: "preview", custom_message: customComment || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.html) { showToast(json.error ?? "Preview failed", false); return; }
      setPreviewHtml(json.html);
    } catch {
      showToast("Preview failed", false);
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Payment confirmation email: send ──────────────────────────────────────
  async function sendConfirmation() {
    if (!inquiry) return;
    setConfirmLoading(true);
    try {
      const latestThreadId = messages.at(-1)?.threadId;
      const res = await fetch("/api/payment-confirmation", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          inquiry_id:     inquiry.id,
          mode:           "send",
          thread_id:      latestThreadId,
          custom_message: customComment || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { showToast(json.error ?? "Send failed", false); return; }
      showToast(`Booking confirmation sent to ${inquiry.name} ✓`);
      setPreviewHtml(null);
      setCustomComment("");
      setTimeout(() => fetchThread(inquiry!.email), 1500);
    } catch {
      showToast("Send failed", false);
    } finally {
      setConfirmLoading(false);
    }
  }

  // ── Detect session date from emails + inquiry ─────────────────────────────
  async function detectDate() {
    if (!inquiry) return;
    setDetectLoading(true);
    try {
      const res = await fetch("/api/detect-session-date", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ inquiry_id: inquiry.id }),
      });
      const json = await res.json();
      if (json.date) {
        setDetectedDate(json);
        fetchSunset(json.date);
      } else {
        showToast(json.reason ?? "Could not find a date in emails", false);
      }
    } catch {
      showToast("Date detection failed", false);
    } finally {
      setDetectLoading(false);
    }
  }

  // ── Confirm the detected date → save to DB + mark availability ────────────
  async function confirmDate(dateStr: string) {
    if (!inquiry) return;
    setDateConfirming(true);
    try {
      await updateAdminInquiry(inquiry.id, { session_date: dateStr });
      // Availability is locked down at the DB level — write through the admin
      // server route (service role) rather than the public anon client.
      await fetch("/api/admin/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, status: "booked", note: `Booked — ${inquiry.name}` }),
      });
      // Keep client_sessions in sync so the ICS calendar feed stays accurate
      await supabase.from("client_sessions")
        .update({ session_date: dateStr })
        .eq("client_email", inquiry.email)
        .is("session_date", null);
      const updated = await loadAdminInquiry(inquiry.id);
      if (updated) setInquiry(updated);
      setDetectedDate(null);
      fetchSunset(dateStr);
      showToast("Session date confirmed and calendar updated ✓");
    } catch {
      showToast("Failed to save date", false);
    } finally {
      setDateConfirming(false);
    }
  }

  // ── Draft day-before reminder into the compose box ────────────────────────
  async function draftReminder() {
    if (!inquiry) return;
    setReminderLoading(true);
    try {
      const res = await fetch("/api/draft-reminder", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ inquiry_id: inquiry.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.draft) { showToast(json.error ?? "Draft failed", false); return; }
      setDraft(json.draft);
      setSubject(json.subject);
      showToast("Reminder drafted — review and send when ready ✓");
    } catch {
      showToast("Reminder draft failed", false);
    } finally {
      setReminderLoading(false);
    }
  }

  // ── Generate all session reminder drafts ─────────────────────────────────
  async function scheduleReminders() {
    if (!inquiry) return;
    setRemindersLoading(true);
    setRemindersOpen(true);
    try {
      const res = await fetch("/api/session-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiry_id: inquiry.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.reminders) { showToast(json.error ?? "Failed to generate reminders", false); return; }
      // Restore any previously saved edits for this inquiry
      let savedEdits: Record<string, { subject: string; body: string }> = {};
      try {
        const raw = localStorage.getItem(`reminders_${inquiryId}`);
        if (raw) savedEdits = JSON.parse(raw) as Record<string, { subject: string; body: string }>;
      } catch { /* ignore */ }
      const firstName = inquiry.name.split(" ")[0] || "there";
      const merged = (json.reminders as ReminderDraft[]).map(r => {
        const saved = savedEdits[r.id];
        if (!saved) return r;
        const html = buildReminderEmail(r.id as ReminderEmailType, firstName, saved.body);
        return { ...r, subject: saved.subject, body: saved.body, html };
      });
      setReminders(merged);
    } catch {
      showToast("Reminder generation failed", false);
    } finally {
      setRemindersLoading(false);
    }
  }

  // ── Open styled email preview in a new tab ───────────────────────────────
  function previewReminderEmail(r: ReminderDraft) {
    const firstName = inquiry?.name.split(" ")[0] || "there";
    const html = r.html ?? buildReminderEmail(r.id as ReminderEmailType, firstName, r.body);
    try {
      localStorage.setItem("email_preview_html", html);
      localStorage.setItem("email_preview_subject", r.subject);
      localStorage.setItem("email_preview_body", r.body);
    } catch { /* ignore */ }
    window.open("/admin/email-preview", "_blank", "noopener");
  }

  // ── Send a reminder email directly via Gmail ─────────────────────────────
  async function sendReminderViaGmail(r: ReminderDraft) {
    if (!inquiry) return;
    setSendingReminder(r.id);
    try {
      const firstName = inquiry.name.split(" ")[0] || "there";
      const html = r.html ?? buildReminderEmail(r.id as ReminderEmailType, firstName, r.body);
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: inquiry.email, subject: r.subject, body: r.body, html }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Send failed", false); return; }
      showToast(`${r.label} sent via Gmail ✓`);
    } catch {
      showToast("Send failed", false);
    } finally {
      setSendingReminder(null);
    }
  }

  // ── Save reminder edits to localStorage ──────────────────────────────────
  function saveReminderEdits() {
    try {
      const edits: Record<string, { subject: string; body: string }> = {};
      for (const r of reminders) edits[r.id] = { subject: r.subject, body: r.body };
      localStorage.setItem(`reminders_${inquiryId}`, JSON.stringify(edits));
      showToast("Reminder drafts saved ✓");
    } catch {
      showToast("Could not save reminders", false);
    }
  }

  // ── Generate contract from email details ──────────────────────────────────
  async function generateContract() {
    if (!inquiry) return;
    setContractLoading(true);
    try {
      const res = await fetch("/api/generate-contract", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ inquiry_id: inquiry.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.contract) { showToast(json.error ?? "Contract generation failed", false); return; }
      setContractText(json.contract);
    } catch {
      showToast("Contract generation failed", false);
    } finally {
      setContractLoading(false);
    }
  }

  // ── Train AI chat ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = trainChatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [trainMessages]);

  async function sendTrainMessage() {
    if (!trainInput.trim() || trainLoading) return;
    const userMsg = { role: "user" as const, content: trainInput.trim() };
    const next = [...trainMessages, userMsg];
    setTrainMessages(next);
    setTrainInput("");
    setTrainLoading(true);
    try {
      const res = await fetch("/api/train-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let replyText = "";
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; text?: string; new_rules?: string[]; saved_to_vault?: boolean };
            if (event.type === "text" && event.text) {
              replyText += event.text;
            } else if (event.type === "done") {
              if (event.new_rules?.length) {
                setTrainSaved(event.new_rules);
                setTimeout(() => setTrainSaved([]), 5000);
              }
            }
          } catch { /* malformed event */ }
        }
      }

      setTrainMessages(p => [...p, { role: "assistant", content: replyText || "Got it!" }]);
    } catch {
      setTrainMessages(p => [...p, { role: "assistant", content: "Something went wrong — try again." }]);
    } finally {
      setTrainLoading(false);
    }
  }

  // ── Teach AI: compare AI draft vs actual sent, write new rules to Obsidian vault ──
  async function learnFromReply() {
    const aiDraftToUse = originalAiDraft || lastAiDraft || manualAiDraft.trim();
    if (!inquiry || !aiDraftToUse || !actualSent.trim()) return;
    setLearnLoading(true);
    const isPerfect = aiDraftToUse.trim() === actualSent.trim();
    try {
      const analyzeRes = await fetch("/api/draft-reply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          inquiry.name,
          email:         inquiry.email,
          message:       inquiry.message,
          ai_draft:      aiDraftToUse,
          actual_sent:   actualSent.trim(),
          perfect_draft: isPerfect,
        }),
      });
      const analyzeJson = await analyzeRes.json() as { rules?: string[]; written?: number; error?: string };

      const rawRules = analyzeJson.rules ?? [];
      const identicalSentinel = rawRules.length === 1 && rawRules[0].toLowerCase().includes("identical");
      const rules = identicalSentinel ? [] : rawRules;
      const written = identicalSentinel ? 0 : (analyzeJson.written ?? 0);

      if (analyzeJson.error) {
        showToast(analyzeJson.error, false);
        return;
      }

      if (!rules.length) {
        showToast(
          identicalSentinel
            ? "Drafts are identical — no differences to extract"
            : "No extractable rules found — try with a more edited reply",
          false
        );
        return;
      }
      setLearnedRules(rules);
      setActualSent("");
      setManualAiDraft("");

      const msg = written === 0
        ? "Rules already in vault — nothing new to add"
        : `✓ ${written} new rule${written === 1 ? "" : "s"} saved to Obsidian vault`;
      showToast(msg, written > 0);
    } catch {
      showToast("Analysis failed — try again", false);
    } finally {
      setLearnLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!inquiry) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: CONV.canvas }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: CONV.violet, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const statusMeta = STATUS_META[status] ?? STATUS_META.archived;
  const initials   = inquiry.name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";

  return (
    <div className="min-h-screen relative" style={{ background: CONV.canvas }}>
      <ConvStyles />
      <div className="pointer-events-none fixed inset-0" style={{ background: `${CONV.glowA}, ${CONV.glowB}` }} aria-hidden />

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 px-4 py-2.5 flex items-center gap-3"
           style={{ background: CONV.bar, backdropFilter: CONV.barBlur, WebkitBackdropFilter: CONV.barBlur, borderBottom: `1px solid ${CONV.panelBorder}` }}>
        <button onClick={() => router.push("/admin?tab=inquiries")}
          className="text-[13px] font-semibold pl-2 pr-3 py-1.5 rounded-full hover:bg-black/5 transition-colors flex items-center gap-1.5 flex-shrink-0"
          style={{ color: CONV.textSoft }}>
          <Icon name="back" size={15} /> Inquiries
        </button>
        <div className="h-5 w-px flex-shrink-0" style={{ background: CONV.rowBorder }} />
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
               style={{ background: CONV.gradBrand }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate leading-tight" style={{ color: CONV.text }}>{inquiry.name}</p>
            {inquiry.session_type && (
              <p className="text-[11px] truncate leading-tight hidden sm:block" style={{ color: CONV.textFaint }}>{inquiry.session_type}</p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
                style={{ background: statusMeta.bg, color: statusMeta.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.dot }} />
            {statusMeta.label}
          </span>
        </div>
        {/* Status segmented control */}
        <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-full flex-shrink-0" style={{ background: CONV.inset }}>
          {(["new", "responded", "archived"] as const).map(s => (
            <button key={s} onClick={() => updateStatus(s)}
              className="text-[11px] font-semibold px-3 py-1 rounded-full transition-all"
              style={status === s
                ? { background: CONV.panelSolid, color: STATUS_META[s].color, boxShadow: "0 1px 4px rgba(17,24,39,0.10)" }
                : { color: CONV.textFaint }}>
              {s === "archived" ? "Archive" : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main two-column layout ── */}
      <div className="relative max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

        {/* ── LEFT: Gmail thread ── */}
        <div className="space-y-3 conv-rise">
          {/* Thread header */}
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: CONV.violet }}>Conversation</p>
              <p className="text-xs mt-0.5" style={{ color: CONV.textFaint }}>
                {threadLoading ? "Loading…" : messages.length === 0
                  ? "No prior emails found in Gmail"
                  : `${messages.length} message${messages.length === 1 ? "" : "s"} with ${inquiry.name}`}
              </p>
            </div>
            <button onClick={() => fetchThread(inquiry.email)} disabled={threadLoading}
              className="text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:opacity-80 flex items-center gap-1.5"
              style={{ background: C.p1_08, color: C.p1 }}>
              {threadLoading ? <><Spinner size={12} /> Loading…</> : <><Icon name="refresh" size={12} /> Refresh</>}
            </button>
          </div>

          {/* Original inquiry card */}
          <Panel>
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: CONV.textFaint }}>Contact form submission</p>
                <p className="text-[11px] flex-shrink-0" style={{ color: CONV.textFaint }}>
                  {new Date(inquiry.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: CONV.textSoft }}>{inquiry.message}</p>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3" style={{ borderTop: `1px solid ${CONV.rowBorder}` }}>
                <button onClick={() => copyField(inquiry.email, "Email-header")}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors"
                  style={copiedField === "Email-header"
                    ? { background: CONV.greenBg, color: CONV.green }
                    : { background: CONV.violetBg, color: CONV.violet }}
                  title="Click to copy">
                  <Icon name={copiedField === "Email-header" ? "check" : "mail"} size={11} />
                  {copiedField === "Email-header" ? "Copied" : inquiry.email}
                </button>
                {[
                  inquiry.phone          && { icon: "phone"    as const, text: inquiry.phone },
                  inquiry.instagram      && { icon: "instagram" as const, text: `@${inquiry.instagram.replace(/^@/, "")}` },
                  inquiry.session_type   && { icon: "sparkle"  as const, text: inquiry.session_type },
                  inquiry.school         && { icon: "cap"      as const, text: inquiry.school },
                  inquiry.people         && { icon: "users"    as const, text: inquiry.people },
                  inquiry.date_in_mind   && { icon: "calendar" as const, text: inquiry.date_in_mind },
                  inquiry.preferred_time && { icon: "clock"    as const, text: fmt12h(inquiry.preferred_time) },
                  inquiry.location       && { icon: "pin"      as const, text: inquiry.location },
                ].filter(Boolean).map((chip, i) => {
                  const c = chip as { icon: Parameters<typeof Icon>[0]["name"]; text: string };
                  return (
                    <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md"
                          style={{ background: CONV.inset, color: CONV.textSoft }}>
                      <Icon name={c.icon} size={11} style={{ color: CONV.textFaint }} /> {c.text}
                    </span>
                  );
                })}
              </div>
            </div>
          </Panel>

          {/* Gmail messages */}
          {threadLoading ? (
            <Panel className="p-12 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
                   style={{ borderColor: CONV.violet, borderTopColor: "transparent" }} />
              <p className="text-sm" style={{ color: CONV.textFaint }}>Loading Gmail conversation…</p>
            </Panel>
          ) : messages.length === 0 ? (
            <Panel className="p-10 text-center">
              <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-3"
                   style={{ background: CONV.inset, color: CONV.textFaint }}>
                <Icon name="mail" size={18} />
              </div>
              <p className="text-sm font-semibold" style={{ color: CONV.textSoft }}>No emails found yet</p>
              <p className="text-xs mt-1" style={{ color: CONV.textFaint }}>Emails to/from {inquiry.email} will appear here</p>
            </Panel>
          ) : ((() => {
            const middleMessages = messages.length > 2 ? messages.slice(1, messages.length - 1) : [];
            const hidden = !threadExpanded ? middleMessages : [];

            function renderMsg(msg: typeof messages[0]) {
              const isOpen  = expanded[msg.id] ?? false;
              const body    = bodies[msg.id];
              const loading = bodyLoading[msg.id];
              return (
                <div key={msg.id}
                  className="rounded-2xl overflow-hidden transition-shadow hover:shadow-md"
                  style={{
                    background: msg.isMe ? "rgba(255,255,255,0.92)" : CONV.panel,
                    border: `1px solid ${msg.isMe ? CONV.violetBorder : CONV.panelBorder}`,
                    boxShadow: CONV.shadow,
                  }}>
                  <button
                    onClick={() => toggleExpand(msg.id)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-black/[0.02] transition-colors">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0 mt-0.5"
                         style={msg.isMe ? { background: CONV.gradBrand, color: "#fff" } : { background: CONV.inset, color: CONV.textSoft }}>
                      {msg.fromName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-[13px] font-bold" style={{ color: CONV.text }}>
                          {msg.isMe ? "You" : msg.fromName}
                          {msg.isMe && <span className="text-[11px] font-normal ml-1.5" style={{ color: CONV.textFaint }}>to {inquiry!.name}</span>}
                        </p>
                        <p className="text-[11px] flex-shrink-0" style={{ color: CONV.textFaint }}>{fmtDate(msg.timestamp)}</p>
                      </div>
                      {!isOpen && <p className="text-xs mt-0.5 truncate" style={{ color: CONV.textFaint }}>{msg.snippet}</p>}
                    </div>
                    <Icon name="chevron" size={14} className={`flex-shrink-0 mt-1.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          style={{ color: CONV.textFaint }} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-3" style={{ borderTop: `1px solid ${CONV.rowBorder}` }}>
                      {loading ? (
                        <div className="flex items-center gap-2 py-4" style={{ color: CONV.textFaint }}>
                          <Spinner size={14} />
                          <span className="text-xs">Loading message…</span>
                        </div>
                      ) : (
                        <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans"
                             style={{ overflowWrap: "anywhere", color: CONV.textSoft }}>
                          {body ? stripQuotes(body) : msg.snippet}
                        </pre>
                      )}
                      <p className="text-[10px] mt-3 font-medium" style={{ color: CONV.textFaint, opacity: 0.8 }}>{msg.subject} · {msg.date}</p>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <>
                {/* First message */}
                {renderMsg(messages[0])}

                {/* Collapsed middle messages */}
                {hidden.length > 0 && (
                  <button
                    onClick={() => setThreadExpanded(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-dashed text-xs font-bold transition-all hover:opacity-80"
                    style={{ borderColor: CONV.violetBorder, color: CONV.violet, background: CONV.violetBg }}>
                    <span style={{ background: C.p1_18, borderRadius: "999px", padding: "1px 8px" }}>{hidden.length}</span>
                    more {hidden.length === 1 ? "message" : "messages"} — tap to expand
                  </button>
                )}

                {/* All middle messages when expanded */}
                {threadExpanded && middleMessages.map(msg => renderMsg(msg))}

                {/* Collapse button */}
                {threadExpanded && middleMessages.length > 0 && (
                  <button
                    onClick={() => setThreadExpanded(false)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold transition-all hover:opacity-80"
                    style={{ color: CONV.textFaint }}>
                    <Icon name="chevron" size={13} className="rotate-180" /> Collapse thread
                  </button>
                )}

                {/* Last message (only if more than 1 total) */}
                {messages.length > 1 && renderMsg(messages[messages.length - 1])}
              </>
            );
          })()
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── RIGHT: AI Draft + Send (sticky) ── */}
        <div className="lg:sticky lg:top-[65px] space-y-4 conv-rise" style={{ animationDelay: "80ms" }}>

          {/* Client contact card */}
          <Panel>
            <div className="p-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black text-white flex-shrink-0"
                     style={{ background: CONV.gradBrand, boxShadow: `0 6px 16px ${C.p1_35}` }}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-black leading-tight truncate" style={{ color: CONV.text }}>{inquiry.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {inquiry.session_type && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: CONV.violetBg, color: CONV.violet }}>
                        {inquiry.session_type}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: statusMeta.bg, color: statusMeta.color }}>
                      <span className="w-1 h-1 rounded-full" style={{ background: statusMeta.dot }} />
                      {statusMeta.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tap-to-copy contact chips */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                <button onClick={() => copyField(inquiry.email, "Email")}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors max-w-full"
                  style={copiedField === "Email"
                    ? { background: CONV.greenBg, color: CONV.green }
                    : { background: CONV.violetBg, color: CONV.violet }}
                  title="Click to copy">
                  <Icon name={copiedField === "Email" ? "check" : "mail"} size={12} />
                  <span className="truncate">{copiedField === "Email" ? "Copied" : inquiry.email}</span>
                </button>
                {inquiry.phone && (
                  <button onClick={() => copyField(inquiry.phone!, "Phone")}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                    style={copiedField === "Phone"
                      ? { background: CONV.greenBg, color: CONV.green }
                      : { background: CONV.inset, color: CONV.textSoft }}
                    title="Click to copy">
                    <Icon name={copiedField === "Phone" ? "check" : "phone"} size={12} />
                    {copiedField === "Phone" ? "Copied" : inquiry.phone}
                  </button>
                )}
                {inquiry.instagram && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                        style={{ background: CONV.inset, color: CONV.textSoft }}>
                    <Icon name="instagram" size={12} /> @{inquiry.instagram.replace(/^@/, "")}
                  </span>
                )}
              </div>

              {/* Detail rows */}
              {(() => {
                const rows = [
                  inquiry.school         && { icon: "cap"      as const, label: "School",   value: inquiry.school },
                  inquiry.people         && { icon: "users"    as const, label: "People",   value: inquiry.people },
                  inquiry.date_in_mind   && { icon: "calendar" as const, label: "Date",     value: inquiry.date_in_mind },
                  inquiry.preferred_time && { icon: "clock"    as const, label: "Time",     value: fmt12h(inquiry.preferred_time) },
                  inquiry.location       && { icon: "pin"      as const, label: "Location", value: inquiry.location },
                ].filter(Boolean) as { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: ReactNode }[];
                if (!rows.length && !inquiry.session_date) return null;
                return (
                  <div className="mt-4">
                    {rows.map((r, i) => (
                      <div key={i} className="flex items-center gap-2.5 py-2" style={{ borderTop: `1px solid ${CONV.rowBorder}` }}>
                        <Icon name={r.icon} size={13} style={{ color: CONV.textFaint }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider w-16 flex-shrink-0" style={{ color: CONV.textFaint }}>{r.label}</span>
                        <span className="text-[13px] font-medium min-w-0" style={{ color: CONV.textSoft }}>{r.value}</span>
                      </div>
                    ))}
                    {inquiry.session_date && (
                      <div className="flex items-center gap-2.5 py-2" style={{ borderTop: `1px solid ${CONV.rowBorder}` }}>
                        <Icon name="check" size={13} style={{ color: CONV.green }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider w-16 flex-shrink-0" style={{ color: CONV.green }}>Booked</span>
                        <span className="text-[13px] font-bold" style={{ color: CONV.green }}>
                          {new Date(inquiry.session_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </Panel>

          {/* ── Compose + Send panel ── */}
          <Panel>
            <div className="p-5 space-y-3">

              {/* Header row */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <PanelHead icon="send" tint={CONV.violet} bg={CONV.violetBg} title="Compose Reply" />
                {/* AI action buttons */}
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={focusComposeForDictation}
                    title="Open the keyboard — use its mic button for native voice dictation"
                    className="sm:hidden text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-all hover:opacity-80 flex items-center gap-1.5"
                    style={{ background: CONV.greenBg, color: CONV.green }}>
                    <Icon name="keyboard" size={12} /> Keyboard
                  </button>
                  <button onClick={toggleVoice}
                    title={voiceActive ? "Stop recording — will auto-polish" : "Speak your reply — auto-polishes when done"}
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-all hover:opacity-80 flex items-center gap-1.5"
                    style={voiceActive
                      ? { background: CONV.redBg, color: CONV.red, border: `1px solid ${CONV.redBorder}` }
                      : { background: CONV.blueBg, color: CONV.blue }}>
                    {voiceActive
                      ? <><span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: CONV.red }} /> Stop</>
                      : <><Icon name="mic" size={12} /> Speak</>}
                  </button>
                  <button onClick={() => polishDraft()} disabled={polishLoading || !draft.trim()}
                    title="Fix typos, convert bullet points to paragraphs"
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-all hover:opacity-80 disabled:opacity-30 flex items-center gap-1.5"
                    style={{ background: CONV.amberBg, color: CONV.amber }}>
                    {polishLoading
                      ? <><Spinner size={11} /> Polishing…</>
                      : <><Icon name="sparkle" size={12} /> Polish</>}
                  </button>
                  <button onClick={() => generateDraft()} disabled={draftLoading}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
                    style={{ background: CONV.gradBrand, color: "#fff", boxShadow: `0 4px 12px ${C.p1_30}` }}>
                    {draftLoading
                      ? <><Spinner size={11} /> Writing…</>
                      : <><Icon name="sparkle" size={12} /> Draft with AI</>}
                  </button>
                </div>
              </div>

              {/* Context indicator */}
              {messages.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                     style={{ background: CONV.greenBg, color: CONV.green }}>
                  <Icon name="check" size={12} className="flex-shrink-0" />
                  <span>{messages.length} prior email{messages.length > 1 ? "s" : ""} loaded — AI uses full conversation</span>
                </div>
              )}

              {/* Voice recording indicator */}
              {voiceActive && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                     style={{ background: CONV.redBg, color: CONV.red, border: `1px solid ${CONV.redBorder}` }}>
                  <span className="inline-block w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: CONV.red }} />
                  <span>Recording… speak naturally. Hit Stop when done — auto-transcribes and polishes.</span>
                </div>
              )}
              {draftLoading && !voiceActive && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                     style={{ background: CONV.blueBg, color: CONV.blue }}>
                  <Spinner size={12} />
                  <span>Transcribing with Whisper…</span>
                </div>
              )}
              {voiceError && (
                <div className="px-3 py-2 rounded-xl text-xs font-medium"
                     style={{ background: CONV.redBg, color: CONV.red }}>
                  {voiceError}
                </div>
              )}

              {/* Subject — always visible */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: CONV.textFaint }}>Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  className="conv-input w-full px-3 py-2 rounded-xl font-medium"
                  style={{ border: `1px solid ${CONV.rowBorder}`, background: CONV.panelSolid, color: CONV.text, fontFamily: "inherit", fontSize: "16px" }} />
              </div>

              {/* Body — always visible */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CONV.textFaint }}>
                    Message
                    <span className="normal-case font-normal ml-1" style={{ color: CONV.textFaint, opacity: 0.7 }}>· type your own, paste, or use AI above</span>
                  </label>
                  <button onClick={saveDraftToCloud} disabled={draftSaving || !draft.trim()}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all disabled:opacity-30 flex items-center gap-1"
                    style={draftSaved
                      ? { background: CONV.greenBg, color: CONV.green }
                      : { background: CONV.inset, color: CONV.textFaint }}>
                    {draftSaving ? "Saving…" : draftSaved ? <><Icon name="check" size={10} /> Saved</> : "Save draft"}
                  </button>
                </div>
                <textarea
                  ref={composeRef}
                  value={draft} onChange={e => setDraft(e.target.value)}
                  rows={11}
                  placeholder={"Write your reply here…\n\nTip: type in bullet points and hit Polish to auto-format into a proper email."}
                  className="conv-input w-full leading-relaxed rounded-xl p-3 resize-none sm:resize-y"
                  style={{ border: `1px solid ${CONV.rowBorder}`, background: C.p1_04, color: CONV.text, fontFamily: "inherit", fontSize: "16px" }} />
              </div>

              {/* Send */}
              <button onClick={sendEmail}
                disabled={!subject.trim() || !draft.trim() || sendLoading}
                className="w-full text-sm font-bold py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: CONV.green, color: "#fff", boxShadow: "0 6px 18px rgba(10,138,100,0.25)" }}>
                {sendLoading ? <><Spinner size={14} /> Sending…</> : <><Icon name="send" size={14} /> Send from Gmail</>}
              </button>
              <p className="text-[10px] text-center" style={{ color: CONV.textFaint }}>
                Sends from {myEmail || "your Gmail"} · lands in Sent Mail · marks inquiry as Responded
              </p>

              {/* AI Refine — always visible so it never disappears after a refine */}
              <div className="pt-2 space-y-2" style={{ borderTop: `1px solid ${CONV.rowBorder}` }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CONV.textFaint }}>Refine AI draft</p>
                <div className="flex gap-2">
                  <input type="text" value={feedback} onChange={e => setFeedback(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && feedback.trim()) generateDraft(feedback); }}
                    placeholder='e.g. "be more direct" · "add turnaround time"'
                    className="conv-input flex-1 px-3 py-2 rounded-xl"
                    style={{ border: `1px solid ${CONV.rowBorder}`, background: CONV.panelSolid, color: CONV.text, fontFamily: "inherit", fontSize: "16px" }} />
                  <button onClick={() => { if (feedback.trim()) generateDraft(feedback); }}
                    disabled={!feedback.trim() || draftLoading}
                    className="text-xs font-bold px-3.5 py-2 rounded-xl disabled:opacity-30 flex-shrink-0 transition-all hover:opacity-90"
                    style={{ background: CONV.gradBrand, color: "#fff" }}>
                    Refine
                  </button>
                </div>
                {refineSaved && (
                  <div className="flex items-start gap-1.5 text-[11px] rounded-lg px-3 py-2 leading-snug"
                       style={{ background: CONV.greenBg, color: CONV.green }}>
                    <Icon name="check" size={11} className="flex-shrink-0 mt-0.5" /> Rule saved: &ldquo;{refineSaved}&rdquo;
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {/* ── Train AI ── */}
          <Panel>
            <div className="p-4" style={{ borderBottom: `1px solid ${CONV.rowBorder}` }}>
              <PanelHead icon="chat" tint={CONV.violet} bg={CONV.violetBg}
                title="Train AI" sub="Rules save directly to Obsidian vault" />
            </div>
            {/* Chat history */}
            <div ref={trainChatRef} className="p-4 space-y-3 max-h-72 overflow-y-auto">
              {trainMessages.length === 0 && (
                <p className="text-xs text-center py-4 leading-relaxed" style={{ color: CONV.textFaint }}>
                  Tell me how to handle this client or any rule you want remembered.<br/>
                  <span style={{ opacity: 0.7 }}>e.g. &ldquo;Don&apos;t push pricing on warm leads&rdquo; · &ldquo;Always mention golden hour&rdquo;</span>
                </p>
              )}
              {trainMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[82%] px-3 py-2 text-sm leading-relaxed"
                    style={m.role === "user"
                      ? { background: CONV.gradBrand, color: "#fff", borderRadius: "16px 16px 4px 16px" }
                      : { background: CONV.inset, color: CONV.textSoft, borderRadius: "16px 16px 16px 4px" }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {trainLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-2xl text-sm flex items-center gap-2"
                       style={{ background: CONV.inset, color: CONV.textFaint }}>
                    <Spinner size={12} /> Thinking…
                  </div>
                </div>
              )}
              {trainSaved.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
                     style={{ background: CONV.greenBg, color: CONV.green }}>
                  <Icon name="check" size={11} /> {trainSaved.length} rule{trainSaved.length > 1 ? "s" : ""} saved to Obsidian vault
                </div>
              )}
            </div>
            {/* Input */}
            <div className="p-3 flex gap-2" style={{ borderTop: `1px solid ${CONV.rowBorder}` }}>
              <input
                type="text"
                value={trainInput}
                onChange={e => setTrainInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTrainMessage(); } }}
                placeholder="e.g. Keep replies short for warm leads…"
                disabled={trainLoading}
                className="conv-input flex-1 text-sm px-3 py-2 rounded-xl disabled:opacity-50"
                style={{ border: `1px solid ${CONV.rowBorder}`, background: CONV.panelSolid, color: CONV.text, fontFamily: "inherit" }}
              />
              <button
                onClick={sendTrainMessage}
                disabled={!trainInput.trim() || trainLoading}
                className="text-xs font-bold px-3.5 py-2 rounded-xl disabled:opacity-30 flex-shrink-0 transition-all hover:opacity-80"
                style={{ background: CONV.gradBrand, color: "#fff" }}>
                Send
              </button>
            </div>
          </Panel>

          {/* ── Sunset / golden hour card — always visible ── */}
          {inquiry && (
            <Panel>
              <div className="px-4 py-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: CONV.amberBg, color: CONV.amber }}>
                  <Icon name="sun" size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  {sunsetLoading ? (
                    <div className="flex items-center gap-2 text-xs mb-2" style={{ color: CONV.amber }}>
                      <Spinner size={12} /> Fetching sunset…
                    </div>
                  ) : sunsetInfo ? (
                    <div className="mb-2">
                      <p className="text-sm font-bold" style={{ color: CONV.text }}>
                        Sunset {sunsetInfo.sunset}
                        {sunsetDate && <span className="text-xs font-normal ml-2" style={{ color: CONV.textFaint }}>{new Date(sunsetDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: CONV.textSoft }}>
                        Start around <span className="font-bold" style={{ color: CONV.amber }}>{sunsetInfo.goldenStart}</span> for golden hour
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs font-bold mb-2" style={{ color: CONV.text }}>Golden hour lookup</p>
                  )}
                  <input
                    type="date"
                    value={sunsetDate}
                    onChange={e => { if (e.target.value) fetchSunset(e.target.value); }}
                    className="conv-input w-full text-xs rounded-lg px-2 py-1.5"
                    style={{ border: `1px solid ${CONV.amberBorder}`, background: CONV.panelSolid, color: CONV.text, fontFamily: "inherit" }}
                  />
                  {inquiry.date_in_mind && !sunsetDate && (
                    <p className="text-[10px] mt-1" style={{ color: CONV.textFaint }}>Client said: {inquiry.date_in_mind}</p>
                  )}
                </div>
              </div>
            </Panel>
          )}

          {/* ── Payment & Booking ── */}
          <Panel>
            <div className="p-5 space-y-3">
              <PanelHead icon="card" tint={CONV.green} bg={CONV.greenBg} title="Payment & Booking"
                right={inquiry.payment_status === "paid" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: CONV.greenBg, color: CONV.green }}>
                    <Icon name="check" size={11} /> Paid
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: CONV.neutralBg, color: CONV.neutral }}>
                    Unpaid
                  </span>
                )} />

              {/* Payment note — compact single line */}
              {inquiry.payment_note && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                     style={{ background: CONV.greenBg, color: CONV.green, border: `1px solid ${CONV.greenBorder}` }}>
                  <span className="flex-1 truncate">{inquiry.payment_note}</span>
                  {inquiry.payment_detected_at && (
                    <span className="text-[10px] flex-shrink-0" style={{ opacity: 0.7 }}>
                      {new Date(inquiry.payment_detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              )}

              {/* Session date — compact */}
              {inquiry.session_date && !sessionDateInput ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                     style={{ background: CONV.greenBg, border: `1px solid ${CONV.greenBorder}` }}>
                  <Icon name="check" size={12} style={{ color: CONV.green }} />
                  <span className="text-xs font-bold flex-1" style={{ color: CONV.green }}>
                    {new Date(inquiry.session_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <button onClick={() => setSessionDateInput(inquiry.session_date!)}
                    className="text-[10px] font-semibold flex-shrink-0 hover:opacity-70"
                    style={{ color: CONV.textFaint }}>edit</button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input type="date" value={sessionDateInput}
                    onChange={e => { setSessionDateInput(e.target.value); if (e.target.value) fetchSunset(e.target.value); }}
                    className="conv-input flex-1 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{ border: `1px solid ${CONV.greenBorder}`, background: CONV.panelSolid, color: CONV.text, fontFamily: "inherit" }} />
                  {sessionDateInput && (
                    <button onClick={() => confirmDate(sessionDateInput)} disabled={dateConfirming}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 transition-all hover:opacity-90"
                      style={{ background: CONV.green, color: "#fff" }}>
                      {dateConfirming ? "…" : "Set"}
                    </button>
                  )}
                </div>
              )}

              {/* Detected date — compact confirm strip */}
              {detectedDate && !inquiry.session_date && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                     style={{ background: CONV.blueBg, border: `1px solid ${CONV.panelBorder}` }}>
                  <span className="text-xs flex-1 font-medium truncate inline-flex items-center gap-1.5" style={{ color: CONV.blue }}>
                    <Icon name="sparkle" size={11} className="flex-shrink-0" /> {detectedDate.readable}
                  </span>
                  <button onClick={() => confirmDate(detectedDate.date)} disabled={dateConfirming}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-md flex-shrink-0 transition-all hover:opacity-90"
                    style={{ background: CONV.green, color: "#fff" }}>
                    {dateConfirming ? "…" : "Confirm"}
                  </button>
                  <button onClick={() => setDetectedDate(null)}
                    className="flex-shrink-0 p-1 rounded-md transition-all hover:opacity-70"
                    style={{ background: CONV.neutralBg, color: CONV.neutral }}>
                    <Icon name="x" size={11} />
                  </button>
                </div>
              )}

              {/* ── Action buttons grid ── */}
              <div className="grid grid-cols-2 gap-2">

                {/* Scan payment */}
                <button onClick={checkPayment} disabled={paymentLoading}
                  title="Scan Gmail for Venmo/Zelle/PayPal payment"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: CONV.greenBg, color: CONV.green, border: `1px solid ${CONV.greenBorder}` }}>
                  {paymentLoading ? <Spinner size={13} /> : <Icon name="card" size={14} />}
                  {paymentLoading ? "Scanning…" : inquiry.payment_status === "paid" ? "Re-check" : "Check Pay"}
                </button>

                {/* Find Date (if no session date yet) */}
                {!inquiry.session_date && (
                  <button onClick={detectDate} disabled={detectLoading}
                    title="Scan email history to detect the session date"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                    style={{ background: CONV.blueBg, color: CONV.blue, border: `1px solid ${CONV.panelBorder}` }}>
                    {detectLoading ? <Spinner size={13} /> : <Icon name="calendar" size={14} />}
                    {detectLoading ? "Scanning…" : "Find Date"}
                  </button>
                )}

                {/* Schedule Reminders */}
                <button onClick={scheduleReminders} disabled={remindersLoading}
                  title="Generate all 5 client touchpoint drafts"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                  style={remindersOpen
                    ? { background: CONV.amber, color: "#fff", border: `1px solid ${CONV.amber}` }
                    : { background: CONV.amberBg, color: CONV.amber, border: `1px solid ${CONV.amberBorder}` }}>
                  {remindersLoading ? <Spinner size={13} /> : <Icon name="bell" size={14} />}
                  {remindersLoading ? "Building…" : "Reminders"}
                </button>

                {/* Contract */}
                <button onClick={generateContract} disabled={contractLoading}
                  title="Fill contract template with client details + agreed price"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: CONV.violetBg, color: CONV.violet, border: `1px solid ${CONV.violetBorder}` }}>
                  {contractLoading ? <Spinner size={13} /> : <Icon name="doc" size={14} />}
                  {contractLoading ? "Building…" : "Contract"}
                </button>

                {/* Confirmation email — only if paid, else placeholder */}
                {inquiry.payment_status === "paid" ? (
                  <button onClick={previewConfirmation} disabled={previewLoading || confirmLoading}
                    title="Preview + send payment confirmation email"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                    style={{ background: CONV.pinkBg, color: CONV.pink, border: `1px solid ${CONV.panelBorder}` }}>
                    {previewLoading ? <Spinner size={13} /> : <Icon name="mail" size={14} />}
                    {previewLoading ? "Building…" : "Payment Email"}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold"
                       style={{ background: CONV.inset, color: CONV.textFaint, border: `1px dashed ${CONV.panelBorderStrong}`, opacity: 0.7 }}>
                    <Icon name="mail" size={14} className="opacity-50" />
                    <span>Unpaid</span>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {/* ── Session Reminders Panel ── */}
          {remindersOpen && (
            <Panel>
              <div className="p-5">
                <div className="mb-4">
                  <PanelHead icon="bell" tint={CONV.amber} bg={CONV.amberBg} title="Session Reminders"
                    right={
                      <button onClick={() => setRemindersOpen(false)}
                        className="flex items-center gap-1 text-xs font-bold transition-colors hover:opacity-70"
                        style={{ color: CONV.textFaint }}>
                        <Icon name="x" size={12} /> Close
                      </button>
                    } />
                </div>

                {remindersLoading ? (
                  <div className="flex flex-col items-center gap-3 py-10" style={{ color: CONV.textFaint }}>
                    <Spinner size={24} />
                    <p className="text-sm font-semibold">Generating all 5 drafts…</p>
                  </div>
                ) : reminders.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: CONV.textFaint }}>No drafts yet — click Reminders to generate.</p>
                ) : (
                  <div className="space-y-4">
                    {reminders.map((r, i) => (
                      <div key={r.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CONV.rowBorder}` }}>
                        <div className="flex items-center justify-between px-4 py-2.5 gap-2 flex-wrap"
                             style={{ background: CONV.amberBg, borderBottom: `1px solid ${CONV.rowBorder}` }}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{r.emoji}</span>
                            <p className="text-xs font-bold" style={{ color: CONV.text }}>{i + 1}. {r.label}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {r.html && (
                              <button
                                onClick={() => previewReminderEmail(r)}
                                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                                style={{ background: CONV.violetBg, color: CONV.violet }}>
                                <Icon name="eye" size={11} /> Preview
                              </button>
                            )}
                            <button
                              onClick={() => sendReminderViaGmail(r)}
                              disabled={sendingReminder === r.id}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white transition-all hover:opacity-80 disabled:opacity-60"
                              style={{ background: CONV.amber }}>
                              {sendingReminder === r.id ? "Sending…" : "Send via Gmail →"}
                            </button>
                          </div>
                        </div>
                        <div className="px-4 py-3" style={{ background: CONV.panelSolid }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: CONV.textFaint }}>Subject</p>
                          <input
                            type="text"
                            value={r.subject}
                            onChange={e => {
                              const updated = e.target.value;
                              setReminders(prev => prev.map((x, j) => j === i ? { ...x, subject: updated } : x));
                            }}
                            className="conv-input w-full text-xs font-semibold rounded-lg px-2 py-1.5 mb-2"
                            style={{ border: `1px solid ${CONV.rowBorder}`, background: CONV.panelSolid, color: CONV.text, fontFamily: "inherit" }}
                          />
                          <textarea
                            value={r.body}
                            onChange={e => {
                              const updated = e.target.value;
                              const firstName = inquiry?.name.split(" ")[0] || "there";
                              const newHtml = buildReminderEmail(r.id as ReminderEmailType, firstName, updated);
                              setReminders(prev => prev.map((x, j) => j === i ? { ...x, body: updated, html: newHtml } : x));
                            }}
                            rows={4}
                            className="conv-input w-full text-xs leading-relaxed rounded-lg p-2 resize-none"
                            style={{ border: `1px solid ${CONV.rowBorder}`, background: CONV.panelSolid, color: CONV.text, fontFamily: "inherit" }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px]" style={{ color: CONV.textFaint }}>
                        Edits here are used for Preview and Send.
                      </p>
                      <button
                        onClick={saveReminderEdits}
                        className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full text-white transition-all hover:opacity-80"
                        style={{ background: CONV.amber }}>
                        Save drafts <Icon name="check" size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* ── Learn from Reply — always visible ── */}
          <Panel>
            <div className="p-5 space-y-3">
              <PanelHead icon="pen" tint={CONV.amber} bg={CONV.amberBg} title="Learn from reply" />

              {learnedRules ? (
                /* ── Success: show extracted rules ── */
                <div className="rounded-xl p-4 space-y-2"
                     style={{ background: CONV.greenBg, border: `1px solid ${CONV.greenBorder}` }}>
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest" style={{ color: CONV.green }}>
                    <Icon name="check" size={11} /> {learnedRules.length} rule{learnedRules.length === 1 ? "" : "s"} saved to Obsidian vault
                  </p>
                  <ul className="space-y-1.5">
                    {learnedRules.map((rule, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 flex-shrink-0 text-xs" style={{ color: CONV.green, opacity: 0.6 }}>–</span>
                        <span className="text-xs leading-snug" style={{ color: CONV.textSoft }}>{rule}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] pt-1" style={{ color: CONV.textFaint }}>Applied to all future drafts automatically.</p>
                  <button onClick={() => { setLearnedRules(null); setActualSent(""); setManualAiDraft(""); }}
                    className="text-xs font-bold transition-colors hover:opacity-70" style={{ color: CONV.violet }}>
                    ↩ Analyze another
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs leading-relaxed" style={{ color: CONV.textSoft }}>
                    Paste what you actually sent. Claude compares it to the AI draft and saves the style differences permanently.
                  </p>

                  {/* If an AI draft was generated this session, show it dimmed — otherwise let them paste it */}
                  {(originalAiDraft || lastAiDraft) ? (
                    <div className="rounded-xl p-3 space-y-1"
                         style={{ background: CONV.inset, border: `1px solid ${CONV.rowBorder}` }}>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CONV.textFaint }}>Original AI draft</p>
                        <button
                          onClick={() => setAiDraftExpanded(e => !e)}
                          className="text-[10px] underline underline-offset-2 transition-colors hover:opacity-70"
                          style={{ color: CONV.textFaint }}>
                          {aiDraftExpanded ? "Collapse" : "Show full"}
                        </button>
                      </div>
                      <p className={`text-xs leading-relaxed whitespace-pre-wrap${aiDraftExpanded ? "" : " line-clamp-3"}`}
                         style={{ color: CONV.textFaint }}>{originalAiDraft || lastAiDraft}</p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: CONV.textFaint }}>
                        AI draft <span className="normal-case font-normal" style={{ opacity: 0.7 }}>(paste here if you didn&apos;t use Draft with AI)</span>
                      </label>
                      <textarea
                        value={manualAiDraft}
                        onChange={e => setManualAiDraft(e.target.value)}
                        rows={4}
                        placeholder="Paste the AI-generated draft here…"
                        className="conv-input w-full leading-relaxed rounded-xl p-3 resize-none sm:resize-y"
                        style={{ border: `1px solid ${CONV.rowBorder}`, background: CONV.panelSolid, color: CONV.textSoft, fontFamily: "inherit", fontSize: "16px" }} />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: CONV.textFaint }}>
                      What you actually sent
                    </label>
                    <textarea
                      value={actualSent}
                      onChange={e => setActualSent(e.target.value)}
                      rows={6}
                      placeholder="Paste the email you sent here…"
                      className="conv-input w-full leading-relaxed rounded-xl p-3 resize-none sm:resize-y"
                      style={{ border: `1px solid ${CONV.amberBorder}`, background: CONV.panelSolid, color: CONV.text, fontFamily: "inherit", fontSize: "16px" }} />
                  </div>

                  <button
                    onClick={learnFromReply}
                    disabled={(!originalAiDraft && !lastAiDraft && !manualAiDraft.trim()) || !actualSent.trim() || learnLoading}
                    className="w-full text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: CONV.amber, color: "#fff", boxShadow: "0 6px 18px rgba(185,115,9,0.25)" }}>
                    {learnLoading
                      ? <><Spinner size={13} /> Analyzing…</>
                      : <><Icon name="pen" size={13} /> Analyze & save to Obsidian</>}
                  </button>
                </>
              )}
            </div>
          </Panel>

        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-[13px] font-semibold text-white flex items-center gap-2 transition-all"
             style={{ background: "rgba(28,28,30,0.92)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", boxShadow: CONV.shadowLg }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: toast.ok ? "#34d399" : "#f87171" }} />
          {toast.msg}
        </div>
      )}

      {/* ── Email preview modal ── */}
      {previewHtml && inquiry && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
             style={{ background: CONV.scrim, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col conv-rise"
               style={{ background: CONV.overlay, maxHeight: "calc(100vh - 80px)", boxShadow: CONV.shadowLg }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                 style={{ background: CONV.panelSolid, borderBottom: `1px solid ${CONV.rowBorder}` }}>
              <PanelHead icon="mail" tint={CONV.pink} bg={CONV.pinkBg}
                title="Booking Confirmation Email" sub={`To: ${inquiry.name} <${inquiry.email}>`} />
              <button onClick={() => setPreviewHtml(null)}
                className="p-2 rounded-full transition-colors hover:bg-black/5" style={{ color: CONV.textFaint }}>
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* Custom note input */}
            <div className="px-5 py-3 flex-shrink-0" style={{ background: CONV.inset, borderBottom: `1px solid ${CONV.rowBorder}` }}>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: CONV.textFaint }}>
                Add a personal note <span className="normal-case font-normal" style={{ opacity: 0.7 }}>(optional — appears in the email)</span>
              </label>
              <textarea
                value={customComment}
                onChange={e => setCustomComment(e.target.value)}
                rows={2}
                placeholder={"e.g. \"Can't wait to shoot with you! Feel free to text me if anything comes up.\""}
                className="conv-input w-full rounded-lg px-3 py-2 resize-none text-sm leading-relaxed"
                style={{ border: `1px solid ${CONV.greenBorder}`, background: CONV.panelSolid, color: CONV.text, fontFamily: "inherit" }}
              />
              {customComment.trim() && (
                <p className="text-[10px] mt-1 font-medium" style={{ color: CONV.green }}>↓ Preview will update when you resend</p>
              )}
            </div>

            {/* Email preview */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="rounded-xl overflow-hidden shadow-sm"
                   dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>

            {/* Action bar */}
            <div className="flex gap-3 px-5 py-4 flex-shrink-0"
                 style={{ background: CONV.panelSolid, borderTop: `1px solid ${CONV.rowBorder}` }}>
              <button onClick={() => setPreviewHtml(null)}
                className="flex-1 text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-80"
                style={{ background: CONV.neutralBg, color: CONV.neutral }}>
                Cancel
              </button>
              <button
                onClick={sendConfirmation}
                disabled={confirmLoading}
                className="flex-1 text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: CONV.gradBrand, color: "#fff", boxShadow: `0 4px 14px ${C.p1_30}` }}>
                {confirmLoading
                  ? <><Spinner size={13} /> Sending…</>
                  : <><Icon name="send" size={13} /> Send from Gmail</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Contract modal ── */}
      {contractText && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
             style={{ background: CONV.scrim, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col conv-rise"
               style={{ background: CONV.overlay, maxHeight: "calc(100vh - 80px)", boxShadow: CONV.shadowLg }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                 style={{ background: CONV.panelSolid, borderBottom: `1px solid ${CONV.rowBorder}` }}>
              <PanelHead icon="doc" tint={CONV.violet} bg={CONV.violetBg}
                title="Photography Contract" sub="Copy and paste into Pixieset to send" />
              <button onClick={() => setContractText(null)}
                className="p-2 rounded-full transition-colors hover:bg-black/5" style={{ color: CONV.textFaint }}>
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* Copy button */}
            <div className="px-5 py-3 flex-shrink-0" style={{ background: CONV.inset, borderBottom: `1px solid ${CONV.rowBorder}` }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(contractText);
                  setContractCopied(true);
                  setTimeout(() => setContractCopied(false), 2500);
                }}
                className="w-full text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={contractCopied
                  ? { background: CONV.green, color: "#fff" }
                  : { background: CONV.gradBrand, color: "#fff", boxShadow: `0 4px 14px ${C.p1_30}` }}>
                <Icon name={contractCopied ? "check" : "copy"} size={13} />
                {contractCopied ? "Copied to clipboard!" : "Copy entire contract"}
              </button>
              <p className="text-[10px] text-center mt-2" style={{ color: CONV.textFaint }}>
                Placeholders in [brackets] need to be filled in manually
              </p>
            </div>

            {/* Contract text */}
            <div className="flex-1 overflow-y-auto p-4">
              <textarea
                readOnly
                value={contractText}
                rows={30}
                className="w-full text-xs leading-relaxed rounded-xl p-4 resize-none outline-none font-mono"
                style={{ background: CONV.panelSolid, border: `1px solid ${CONV.rowBorder}`, color: CONV.textSoft }}
              />
            </div>

            <div className="px-5 py-4 flex-shrink-0" style={{ background: CONV.panelSolid, borderTop: `1px solid ${CONV.rowBorder}` }}>
              <button onClick={() => setContractText(null)}
                className="w-full text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-80"
                style={{ background: CONV.neutralBg, color: CONV.neutral }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
