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
  payment_status: string | null; payment_note: string | null;
  payment_detected_at: string | null; booking_confirmed: boolean | null;
  session_date: string | null;
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
  const [draftSaving,   setDraftSaving]   = useState(false);
  const [draftSaved,    setDraftSaved]    = useState(false);
  const [voiceActive,   setVoiceActive]   = useState(false);
  const [voiceError,    setVoiceError]    = useState<string | null>(null);
  const [subject,       setSubject]       = useState("");
  const [feedback,      setFeedback]      = useState("");
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

  // Session reminders panel
  type ReminderDraft = { id: string; label: string; emoji: string; subject: string; body: string };
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

      // Month-name format (e.g. "June 19", "June 19th 2026")
      const hasMonth = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(seg);
      if (hasMonth) {
        const cleaned = seg.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
        for (const attempt of [cleaned, `${cleaned} ${year}`, `${cleaned} ${year + 1}`]) {
          const d = new Date(attempt);
          if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
        }
      }
    }
    return null;
  }

  // Fetch sunset + golden-hour start for a Bay Area date (San Jose coords)
  async function fetchSunset(dateStr: string) {
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

    supabase.from("inquiries").select("*").eq("id", inquiryId).single()
      .then(async ({ data }) => {
        if (!data) { router.push("/admin?tab=inquiries"); return; }
        setInquiry(data);
        setStatus(data.status);
        setSubject(buildSubject(data));
        fetchThread(data.email);
        // Show sunset immediately — confirmed date wins, fall back to client's requested date
        const sunsetDate = data.session_date ?? tryParseDate(data.date_in_mind ?? "");
        if (sunsetDate) fetchSunset(sunsetDate);
        // Load saved notes for this inquiry
        const { data: nd } = await supabase
          .from("site_settings").select("value")
          .eq("key", `inquiry_notes_${data.id}`).single();
        if (nd?.value) setNotes(nd.value);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  // Load saved drafts — localStorage first (fast), fall back to Supabase (cross-device)
  useEffect(() => {
    if (!inquiryId) return;
    const localDraft = localStorage.getItem(`draft_${inquiryId}`);
    const localAi    = localStorage.getItem(`ai_draft_${inquiryId}`);
    if (localDraft) setDraft(localDraft);
    if (localAi)    setLastAiDraft(localAi);

    // Only hit Supabase if localStorage was empty (other device may have saved)
    if (!localDraft || !localAi) {
      supabase.from("site_settings").select("key,value")
        .in("key", [`draft_${inquiryId}`, `ai_draft_${inquiryId}`])
        .then(({ data }) => {
          if (!data) return;
          for (const row of data) {
            if (row.key === `draft_${inquiryId}` && !localDraft && row.value) {
              setDraft(row.value);
              localStorage.setItem(`draft_${inquiryId}`, row.value);
            }
            if (row.key === `ai_draft_${inquiryId}` && !localAi && row.value) {
              setLastAiDraft(row.value);
              localStorage.setItem(`ai_draft_${inquiryId}`, row.value);
            }
          }
        });
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

      const payload: Record<string, string | null> = {
        name:                inquiry.name,
        email:               inquiry.email,
        phone:               inquiry.phone,
        session_type:        inquiry.session_type,
        date_in_mind:        inquiry.date_in_mind,
        message:             inquiry.message,
        thread_context:      threadContext ?? null,
        latest_message_body: latestBody ?? null,
        latest_message_from: lastMsg ? (lastMsg.isMe ? "me" : "client") : null,
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
        // Persist to Supabase so draft is accessible on any device
        await supabase.from("site_settings").upsert([
          { key: `draft_${inquiryId}`,    value: json.draft },
          { key: `ai_draft_${inquiryId}`, value: json.draft },
        ], { onConflict: "key" });
      }
      else showToast(json.error ?? "Draft failed", false);
    } catch {
      showToast("Draft request failed", false);
    } finally {
      setDraftLoading(false);
    }
  }

  // ── Polish: fix typos / convert bullet points to email ─────────────────────
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

      const res  = await fetch("/api/draft-reply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:           inquiry.name,
          email:          inquiry.email,
          message:        inquiry.message,
          session_type:   inquiry.session_type,
          thread_context: threadContext ?? null,
          raw_draft:      textToPolish,
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

  // ── Voice-to-text (MediaRecorder → Whisper) ───────────────────────────────
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveRecogRef      = useRef<any>(null);
  const voicePreviewRef   = useRef(""); // live interim text shown while recording
  const draftBaseRef      = useRef(""); // text in box before recording started
  const draftRef          = useRef("");
  useEffect(() => { draftRef.current = draft; }, [draft]);

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
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"]
        .find(t => MediaRecorder.isTypeSupported(t)) ?? "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        liveRecogRef.current?.stop();
        liveRecogRef.current = null;

        const blob = new Blob(audioChunksRef.current, { type: mime || "audio/webm" });
        audioChunksRef.current = [];

        if (blob.size < 1000) { setVoiceActive(false); return; }

        setVoiceActive(false);
        setDraftLoading(true);

        try {
          const fd = new FormData();
          fd.append("audio", blob, "audio.webm");
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

  // ── Save draft to Supabase (cross-device sync) ────────────────────────────
  async function saveDraftToCloud() {
    if (!draft.trim()) return;
    setDraftSaving(true);
    try {
      await supabase.from("site_settings").upsert(
        [{ key: `draft_${inquiryId}`, value: draft }],
        { onConflict: "key" }
      );
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
        await supabase.from("inquiries").update({ status: "responded" }).eq("id", inquiry.id);
        setStatus("responded");
        setDraft("");
        // Clear cloud drafts now that it's sent
        await supabase.from("site_settings").delete()
          .in("key", [`draft_${inquiryId}`, `ai_draft_${inquiryId}`]);
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
    await supabase.from("inquiries").update({ status: s }).eq("id", inquiry.id);
    setStatus(s);
    showToast(`Marked as ${s}`);
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
      const { data } = await supabase.from("inquiries").select("*").eq("id", inquiry.id).single();
      if (data) setInquiry(data);
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
      await supabase.from("inquiries").update({ session_date: dateStr }).eq("id", inquiry.id);
      await supabase.from("availability").upsert(
        { date: dateStr, status: "booked", note: `Booked — ${inquiry.name}` },
        { onConflict: "date" }
      );
      const { data } = await supabase.from("inquiries").select("*").eq("id", inquiry.id).single();
      if (data) setInquiry(data);
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
      setReminders(json.reminders);
    } catch {
      showToast("Reminder generation failed", false);
    } finally {
      setRemindersLoading(false);
    }
  }

  // ── Send a reminder email directly via Gmail ─────────────────────────────
  async function sendReminderViaGmail(r: ReminderDraft) {
    if (!inquiry) return;
    setSendingReminder(r.id);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: inquiry.email, subject: r.subject, body: r.body }),
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

  // ── Teach AI: compare AI draft vs actual sent, write new rules to Obsidian vault ──
  async function learnFromReply() {
    const aiDraftToUse = lastAiDraft || manualAiDraft.trim();
    if (!inquiry || !aiDraftToUse || !actualSent.trim()) return;
    setLearnLoading(true);
    try {
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
      const analyzeJson = await analyzeRes.json() as { rules?: string[]; written?: number; error?: string };

      if (!analyzeJson.rules?.length) {
        showToast(analyzeJson.error ?? "Replies look similar — nothing new to learn", false);
        return;
      }

      const { rules, written = 0 } = analyzeJson;
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
                  <button onClick={() => copyField(inquiry.email, "Email-header")}
                    className="font-semibold transition-colors"
                    style={{ color: copiedField === "Email-header" ? "#10b981" : C.p1 }}
                    title="Click to copy">
                    {copiedField === "Email-header" ? "Copied ✓" : inquiry.email}
                  </button>
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

          {/* ── Sunset / golden hour card — always visible ── */}
          {inquiry && (
            <div className="rounded-2xl px-4 py-3"
                 style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.08))", border: "1px solid rgba(245,158,11,0.25)" }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none flex-shrink-0">🌅</span>
                {sunsetLoading ? (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <span className="animate-spin inline-block">◌</span> Fetching sunset…
                  </div>
                ) : sunsetInfo ? (
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-amber-700">
                      Sunset {sunsetInfo.sunset}
                      {(() => {
                        const d = inquiry.session_date ?? tryParseDate(inquiry.date_in_mind ?? "");
                        if (!d) return null;
                        return <span className="text-xs font-normal text-amber-500 ml-2">{new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>;
                      })()}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Start around <span className="font-bold">{sunsetInfo.goldenStart}</span> for golden hour
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-700 mb-1.5">Golden hour lookup</p>
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        defaultValue={inquiry.session_date ?? tryParseDate(inquiry.date_in_mind ?? "") ?? ""}
                        onChange={e => { if (e.target.value) fetchSunset(e.target.value); }}
                        className="flex-1 text-xs rounded-lg px-2 py-1 border border-amber-200 bg-white/60 text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-300"
                      />
                    </div>
                    {inquiry.date_in_mind && (
                      <p className="text-[10px] text-amber-500 mt-1">Client said: {inquiry.date_in_mind}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

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
                  <button onClick={toggleVoice}
                    title={voiceActive ? "Stop recording — will auto-polish" : "Speak your reply — auto-polishes when done"}
                    className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center gap-1"
                    style={voiceActive
                      ? { background: "rgba(239,68,68,0.12)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.3)" }
                      : { background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)" }}>
                    {voiceActive
                      ? <><span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Stop</>
                      : "🎤 Speak"}
                  </button>
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

              {/* Voice recording indicator */}
              {voiceActive && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                     style={{ background: "rgba(239,68,68,0.07)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <span>Recording… speak naturally. Hit Stop when done — auto-transcribes and polishes.</span>
                </div>
              )}
              {draftLoading && !voiceActive && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                     style={{ background: "rgba(99,102,241,0.07)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <span className="animate-spin inline-block">◌</span>
                  <span>Transcribing with Whisper…</span>
                </div>
              )}
              {voiceError && (
                <div className="px-3 py-2 rounded-xl text-xs font-medium"
                     style={{ background: "rgba(239,68,68,0.07)", color: "#dc2626" }}>
                  {voiceError}
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Message
                    <span className="normal-case font-normal text-slate-300 ml-1">· type your own, paste, or use AI above</span>
                  </label>
                  <button onClick={saveDraftToCloud} disabled={draftSaving || !draft.trim()}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all disabled:opacity-30"
                    style={{ background: draftSaved ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.1)", color: draftSaved ? "#059669" : "#94a3b8", border: `1px solid ${draftSaved ? "rgba(16,185,129,0.25)" : "rgba(148,163,184,0.2)"}` }}>
                    {draftSaving ? "Saving…" : draftSaved ? "✓ Saved" : "Save draft"}
                  </button>
                </div>
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

              {/* AI Refine — always visible so it never disappears after a refine */}
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
            </div>
          </div>

          {/* ── Payment & Booking ── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#10b981,#34d399)" }} />
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
                       style={{ background: "rgba(16,185,129,0.12)", color: "#059669" }}>💳</div>
                  <p className="text-sm font-black text-slate-900">Payment & Booking</p>
                </div>
                {/* Status badge */}
                {inquiry.payment_status === "paid" ? (
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-lg"
                        style={{ background: "rgba(16,185,129,0.12)", color: "#059669" }}>
                    Paid ✓
                  </span>
                ) : (
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-lg"
                        style={{ background: "rgba(148,163,184,0.12)", color: "#94a3b8" }}>
                    Unpaid
                  </span>
                )}
              </div>

              {/* Payment note — compact single line */}
              {inquiry.payment_note && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-emerald-700"
                     style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.15)" }}>
                  <span className="flex-1 truncate">{inquiry.payment_note}</span>
                  {inquiry.payment_detected_at && (
                    <span className="text-[10px] text-emerald-400 flex-shrink-0">
                      {new Date(inquiry.payment_detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              )}

              {/* Session date — compact */}
              {inquiry.session_date && !sessionDateInput ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                     style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.15)" }}>
                  <span className="text-emerald-600 text-xs font-black">✓</span>
                  <span className="text-xs font-bold text-emerald-700 flex-1">
                    {new Date(inquiry.session_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <button onClick={() => setSessionDateInput(inquiry.session_date!)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 flex-shrink-0">edit</button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input type="date" value={sessionDateInput}
                    onChange={e => { setSessionDateInput(e.target.value); if (e.target.value) fetchSunset(e.target.value); }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg outline-none text-slate-700 text-xs"
                    style={{ border: "1px solid rgba(16,185,129,0.25)", background: "#fff", fontFamily: "inherit" }} />
                  {sessionDateInput && (
                    <button onClick={() => confirmDate(sessionDateInput)} disabled={dateConfirming}
                      className="text-xs font-black px-3 py-1.5 rounded-lg disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff" }}>
                      {dateConfirming ? "…" : "Set"}
                    </button>
                  )}
                </div>
              )}

              {/* Detected date — compact confirm strip */}
              {detectedDate && !inquiry.session_date && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                     style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <span className="text-xs text-indigo-500 flex-1 font-medium truncate">✦ {detectedDate.readable}</span>
                  <button onClick={() => confirmDate(detectedDate.date)} disabled={dateConfirming}
                    className="text-[11px] font-black px-2.5 py-1 rounded-md flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff" }}>
                    {dateConfirming ? "…" : "Confirm"}
                  </button>
                  <button onClick={() => setDetectedDate(null)}
                    className="text-[11px] font-bold px-2 py-1 rounded-md flex-shrink-0"
                    style={{ background: "rgba(148,163,184,0.15)", color: "#64748b" }}>✕</button>
                </div>
              )}

              {/* ── Action buttons grid ── */}
              <div className="grid grid-cols-2 gap-2">

                {/* Scan payment */}
                <button onClick={checkPayment} disabled={paymentLoading}
                  title="Scan Gmail for Venmo/Zelle/PayPal payment"
                  className="flex flex-col items-center gap-1 py-3 rounded-xl text-white text-xs font-black transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                  {paymentLoading ? <span className="animate-spin text-base">◌</span> : <span className="text-base">💳</span>}
                  {paymentLoading ? "Scanning…" : inquiry.payment_status === "paid" ? "Re-check" : "Check Pay"}
                </button>

                {/* Find Date (if no session date yet) */}
                {!inquiry.session_date && (
                  <button onClick={detectDate} disabled={detectLoading}
                    title="Scan email history to detect the session date"
                    className="flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-black transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)" }}>
                    {detectLoading ? <span className="animate-spin text-base">◌</span> : <span className="text-base">📅</span>}
                    {detectLoading ? "Scanning…" : "Find Date"}
                  </button>
                )}

                {/* Schedule Reminders */}
                <button onClick={scheduleReminders} disabled={remindersLoading}
                  title="Generate all 5 client touchpoint drafts"
                  className="flex flex-col items-center gap-1 py-3 rounded-xl text-white text-xs font-black transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: remindersOpen ? "linear-gradient(135deg,#d97706,#b45309)" : "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                  {remindersLoading ? <span className="animate-spin text-base">◌</span> : <span className="text-base">🗓️</span>}
                  {remindersLoading ? "Building…" : "Reminders"}
                </button>

                {/* Contract */}
                <button onClick={generateContract} disabled={contractLoading}
                  title="Fill contract template with client details + agreed price"
                  className="flex flex-col items-center gap-1 py-3 rounded-xl text-white text-xs font-black transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}>
                  {contractLoading ? <span className="animate-spin text-base">◌</span> : <span className="text-base">📄</span>}
                  {contractLoading ? "Building…" : "Contract"}
                </button>

                {/* Confirmation email — only if paid, else placeholder */}
                {inquiry.payment_status === "paid" ? (
                  <button onClick={previewConfirmation} disabled={previewLoading || confirmLoading}
                    title="Preview + send payment confirmation email"
                    className="flex flex-col items-center gap-1 py-3 rounded-xl text-white text-xs font-black transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
                    {previewLoading ? <span className="animate-spin text-base">◌</span> : <span className="text-base">📧</span>}
                    {previewLoading ? "Building…" : "Payment Email"}
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-bold"
                       style={{ background: "rgba(148,163,184,0.08)", color: "#cbd5e1", border: "1px dashed #e2e8f0" }}>
                    <span className="text-base opacity-40">📧</span>
                    <span>Unpaid</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Session Reminders Panel ── */}
          {remindersOpen && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#f59e0b,#d97706)" }} />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
                         style={{ background: "rgba(245,158,11,0.12)", color: "#d97706" }}>🗓️</div>
                    <p className="text-sm font-black text-slate-900">Session Reminders</p>
                  </div>
                  <button onClick={() => setRemindersOpen(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600">✕ Close</button>
                </div>

                {remindersLoading ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                    <span className="animate-spin text-2xl">◌</span>
                    <p className="text-sm font-semibold">Generating all 5 drafts…</p>
                  </div>
                ) : reminders.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No drafts yet — click Reminders to generate.</p>
                ) : (
                  <div className="space-y-4">
                    {reminders.map((r, i) => (
                      <div key={r.id} className="rounded-xl overflow-hidden border border-slate-100">
                        <div className="flex items-center justify-between px-4 py-2.5"
                             style={{ background: "rgba(245,158,11,0.06)", borderBottom: "1px solid rgba(245,158,11,0.12)" }}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{r.emoji}</span>
                            <p className="text-xs font-black text-slate-800">{i + 1}. {r.label}</p>
                          </div>
                          <button
                            onClick={() => sendReminderViaGmail(r)}
                            disabled={sendingReminder === r.id}
                            className="text-[11px] font-black px-2.5 py-1 rounded-lg text-white transition-all hover:opacity-80 disabled:opacity-60"
                            style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                            {sendingReminder === r.id ? "Sending…" : "Send via Gmail →"}
                          </button>
                        </div>
                        <div className="px-4 py-3 bg-white">
                          <p className="text-[11px] font-bold text-slate-400 mb-1">Subject: {r.subject}</p>
                          <textarea
                            value={r.body}
                            onChange={e => {
                              const updated = e.target.value;
                              setReminders(prev => prev.map((x, j) => j === i ? { ...x, body: updated } : x));
                            }}
                            rows={4}
                            className="w-full text-xs text-slate-700 leading-relaxed rounded-lg p-2 resize-none outline-none"
                            style={{ border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.03)", fontFamily: "inherit" }}
                          />
                        </div>
                      </div>
                    ))}
                    <p className="text-[11px] text-slate-400 text-center pt-1">
                      Edit any draft above — "Open in Mail" always uses the current text.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Things to Remember ── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#8b5cf6,#a78bfa)" }} />
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
                       style={{ background: "rgba(139,92,246,0.12)", color: "#7c3aed" }}>📌</div>
                  <p className="text-sm font-black text-slate-900">AI Training Notes</p>
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
                placeholder={"Jot down anything for the AI to learn — how to respond to clients like this, what worked, what to avoid.\n\ne.g. clients who say 'flexible' usually want late May · always mention golden hour timing · don't push packages upfront"}
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
              { label: "Name",    value: <span className="font-semibold text-slate-800">{inquiry.name}</span> },
              { label: "Email",   value: (
                <button onClick={() => copyField(inquiry.email, "Email")}
                  className="text-left transition-colors"
                  style={{ color: copiedField === "Email" ? "#10b981" : C.p1 }}
                  title="Click to copy">
                  {copiedField === "Email" ? "Copied ✓" : inquiry.email}
                </button>
              )},
              inquiry.phone && { label: "Phone", value: (
                <button onClick={() => copyField(inquiry.phone!, "Phone")}
                  className="text-left transition-colors"
                  style={{ color: copiedField === "Phone" ? "#10b981" : "inherit" }}
                  title="Click to copy">
                  {copiedField === "Phone" ? "Copied ✓" : inquiry.phone}
                </button>
              )},
              inquiry.session_type && { label: "Session", value: inquiry.session_type },
              inquiry.date_in_mind && { label: "Date",    value: inquiry.date_in_mind },
              inquiry.session_date && { label: "Booked",  value: new Date(inquiry.session_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
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

      {/* ── Email preview modal ── */}
      {previewHtml && inquiry && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
             style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
               style={{ background: "#f4f4f0", maxHeight: "calc(100vh - 80px)" }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-slate-100 flex-shrink-0">
              <div>
                <p className="text-sm font-black text-slate-900">Booking Confirmation Email</p>
                <p className="text-xs text-slate-400 mt-0.5">To: {inquiry.name} &lt;{inquiry.email}&gt;</p>
              </div>
              <button onClick={() => setPreviewHtml(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none px-2">×</button>
            </div>

            {/* Custom note input */}
            <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0 bg-slate-50">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">
                Add a personal note <span className="normal-case font-normal text-slate-300">(optional — appears in the email)</span>
              </label>
              <textarea
                value={customComment}
                onChange={e => setCustomComment(e.target.value)}
                rows={2}
                placeholder={"e.g. \"Can't wait to shoot with you! Feel free to text me if anything comes up.\""}

                className="w-full text-slate-700 rounded-lg px-3 py-2 outline-none resize-none text-sm leading-relaxed"
                style={{ border: "1px solid rgba(16,185,129,0.25)", background: "#fff", fontFamily: "inherit" }}
              />
              {customComment.trim() && (
                <p className="text-[10px] text-emerald-600 mt-1 font-medium">↓ Preview will update when you resend</p>
              )}
            </div>

            {/* Email preview */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="rounded-xl overflow-hidden shadow-sm"
                   dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>

            {/* Action bar */}
            <div className="flex gap-3 px-5 py-4 bg-white border-t border-slate-100 flex-shrink-0">
              <button onClick={() => setPreviewHtml(null)}
                className="flex-1 text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-80"
                style={{ background: "rgba(148,163,184,0.12)", color: "#64748b" }}>
                Cancel
              </button>
              <button
                onClick={sendConfirmation}
                disabled={confirmLoading}
                className="flex-1 text-sm font-black py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
                {confirmLoading
                  ? <><span className="animate-spin inline-block">◌</span> Sending…</>
                  : "Send from Gmail"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Contract modal ── */}
      {contractText && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
             style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
               style={{ background: "#f8fafc", maxHeight: "calc(100vh - 80px)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-slate-100 flex-shrink-0">
              <div>
                <p className="text-sm font-black text-slate-900">Photography Contract</p>
                <p className="text-xs text-slate-400 mt-0.5">Copy and paste into Pixieset to send</p>
              </div>
              <button onClick={() => setContractText(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none px-2">×</button>
            </div>

            {/* Copy button */}
            <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0 bg-slate-50">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(contractText);
                  setContractCopied(true);
                  setTimeout(() => setContractCopied(false), 2500);
                }}
                className="w-full text-sm font-black py-2.5 rounded-xl transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: contractCopied ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#0ea5e9,#6366f1)", color: "#fff" }}>
                {contractCopied ? "✓ Copied to clipboard!" : "📋 Copy entire contract"}
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-2">
                Placeholders in [brackets] need to be filled in manually
              </p>
            </div>

            {/* Contract text */}
            <div className="flex-1 overflow-y-auto p-4">
              <textarea
                readOnly
                value={contractText}
                rows={30}
                className="w-full text-xs text-slate-700 leading-relaxed rounded-xl p-4 resize-none outline-none font-mono"
                style={{ background: "#fff", border: "1px solid #e2e8f0" }}
              />
            </div>

            <div className="px-5 py-4 bg-white border-t border-slate-100 flex-shrink-0">
              <button onClick={() => setContractText(null)}
                className="w-full text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-80"
                style={{ background: "rgba(148,163,184,0.12)", color: "#64748b" }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
