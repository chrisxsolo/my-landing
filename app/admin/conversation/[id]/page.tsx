"use client";
// Client conversation workspace — Darkroom edition. This file owns all state
// and API handlers; presentation lives in the sibling panel components.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { checkAuth } from "@/lib/adminAuth";
import { buildAdminPortalSessionHref } from "@/lib/adminPortalSessionNavigation";
import type { GmailMessage } from "@/app/api/gmail/thread/route";
import { buildReminderEmail, type ReminderEmailType } from "@/lib/reminderEmail";
import {
  loadAdminInquiry,
  updateAdminInquiry,
  type AdminInquiry,
} from "@/lib/adminInquiries";
import { T, CONV, STATUS_META, Icon, ConvStyles } from "../ui";
import { fmtDate, readJsonSafe, stripQuotes, tryParseDate, type ReminderDraft } from "./helpers";
import { buildInquiryReplySubject, type SubjectSource } from "@/lib/schoolDetection";
import { buildBookedAvailabilityNote } from "@/lib/clientSessions";
import PipelineRail from "./PipelineRail";
import ThreadColumn from "./ThreadColumn";
import ContactCard from "./ContactCard";
import ProgressPanel from "./ProgressPanel";
import ComposePanel from "./ComposePanel";
import TrainAiPanel from "./TrainAiPanel";
import BookingPanel, { SunsetCard } from "./BookingPanel";
import RemindersPanel from "./RemindersPanel";
import LearnPanel from "./LearnPanel";
import { ConfirmationModal, ContractModal } from "./Modals";

type Inquiry = AdminInquiry;

const FONTS_HREF = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

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
  const [subjectSource, setSubjectSource] = useState<SubjectSource>("generated");
  const [feedback,      setFeedback]      = useState("");
  const [refineSaved,      setRefineSaved]      = useState<string | null>(null);
  const [aiDraftExpanded,  setAiDraftExpanded]  = useState(false);
  const [sendLoading,   setSendLoading]   = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [status,        setStatus]        = useState("new");

  // ── Payment ────────────────────────────────────────────────────────────────
  const [paymentLoading,    setPaymentLoading]    = useState(false);
  const [markPaidLoading,   setMarkPaidLoading]   = useState(false);
  const [sessionDateInput,  setSessionDateInput]  = useState("");
  const [previewHtml,       setPreviewHtml]       = useState<string | null>(null);
  const [confirmLoading,    setConfirmLoading]    = useState(false);
  const [previewLoading,    setPreviewLoading]    = useState(false);
  const [customComment,     setCustomComment]     = useState("");
  // Session date detection
  const [detectedDate,      setDetectedDate]      = useState<{ date: string; readable: string; confidence: string } | null>(null);
  const [detectLoading,     setDetectLoading]     = useState(false);
  const [dateConfirming,    setDateConfirming]    = useState(false);

  // Email thread — show all messages by default
  const [threadExpanded, setThreadExpanded] = useState(true);

  // Session reminders panel
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

  // Deterministic reply subject — recomputed whenever inquiry data changes
  // (load, edits, timeline sync) until the user edits the subject themselves.
  useEffect(() => {
    if (!inquiry || subjectSource === "manual") return;
    setSubject(buildInquiryReplySubject(inquiry));
  }, [inquiry, subjectSource]);

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
          // Functional updates: the user may have started typing/dictating
          // before this resolves — never clobber in-progress text with the
          // older cloud copy. The persist effects below handle localStorage.
          if (data.draft && !localDraft) {
            setDraft((prev) => prev || data.draft);
          }
          if (data.ai_draft && !localAi) {
            setLastAiDraft((prev) => prev || data.ai_draft);
          }
          if (data.original_ai_draft && !localOriginal) {
            setOriginalAiDraft((prev) => prev || data.original_ai_draft);
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
        // Sending from here IS the reply — clear needs_reply and stamp the
        // outbound state immediately instead of waiting for the next Gmail
        // reconciliation. reply_sent_at records the FIRST reply, never overwrite.
        const now = new Date().toISOString();
        try {
          const updated = await updateAdminInquiry(inquiry.id, {
            status: "responded",
            status_source: "automatic",
            needs_reply: false,
            reply_sent_at: inquiry.reply_sent_at ?? now,
            last_outbound_at: now,
            last_message_at: now,
            last_message_direction: "outbound",
          });
          setInquiry(updated);
          setStatus("responded");
        } catch (err) {
          // The email went out — never surface this as a send failure, or a
          // natural retry would email the client twice.
          console.error("post-send inquiry update failed", err);
          showToast("Sent — but the inquiry status didn't update. Refresh to sync.", false);
        }

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
      // Manual override — timeline sync must never undo it. Anything but
      // "new" also dismisses the needs-reply flag until the client writes again.
      const updated = await updateAdminInquiry(inquiry.id, {
        status: s,
        status_source: "manual",
        ...(s !== "new"
          ? { needs_reply: false, needs_reply_dismissed_at: new Date().toISOString() }
          : {}),
      });
      setInquiry(updated);
      setStatus(s);
      showToast(`Marked as ${STATUS_META[s]?.label.toLowerCase() ?? s}`);
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
      const json = await readJsonSafe(res) as {
        paid?: boolean; note?: string; session_date_booked?: boolean;
        warning?: string; error?: string;
      };

      // A non-ok response means the analysis broke (Gmail, Claude, parsing,
      // or DB) — never present that as "the client hasn't paid".
      if (!res.ok) {
        console.error("[check-payment] analysis failed:", json.error);
        showToast("Payment analysis failed. No payment status was changed.", false);
        return;
      }

      if (json.paid) {
        showToast(`Payment confirmed — ${json.note}`);
        if (json.session_date_booked) showToast(`Calendar marked as booked`);
        if (json.warning) showToast(json.warning, false);
      } else {
        showToast(json.note || "No payment evidence found", false);
      }

      // Refresh inquiry to pick up new payment fields
      const updated = await loadAdminInquiry(inquiry.id);
      if (updated) setInquiry(updated);
    } catch (error) {
      console.error("[check-payment] request error:", error);
      showToast("Payment analysis failed. No payment status was changed.", false);
    } finally {
      setPaymentLoading(false);
    }
  }

  // ── Manual payment override — reuses /api/admin/manual-payments ───────────
  async function markPaidManually(form: { method: string; amount: string; paid_at: string; note: string }): Promise<boolean> {
    if (!inquiry) return false;
    setMarkPaidLoading(true);
    try {
      const res = await fetch("/api/admin/manual-payments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:       "confirm-inquiry-paid",
          inquiry_id:   inquiry.id,
          client_email: inquiry.email,
          method:       form.method,
          amount:       form.amount || undefined,
          paid_at:      form.paid_at,
          note:         form.note || undefined,
        }),
      });
      const json = await readJsonSafe(res) as { ok?: boolean; already_paid?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        showToast(json.error ?? "Manual payment failed", false);
        return false;
      }
      showToast(json.already_paid ? "Payment details updated" : "Marked as paid ✓");
      const updated = await loadAdminInquiry(inquiry.id);
      if (updated) setInquiry(updated);
      return true;
    } catch (error) {
      console.error("[mark-paid-manually] request error:", error);
      showToast("Manual payment failed", false);
      return false;
    } finally {
      setMarkPaidLoading(false);
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
  async function sendConfirmation(editedHtml: string | null) {
    if (!inquiry) return;
    setConfirmLoading(true);
    try {
      const res = await fetch("/api/payment-confirmation", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          inquiry_id:     inquiry.id,
          mode:           "send",
          custom_message: customComment || undefined,
          edited_html:    editedHtml || undefined,
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
      const availRes = await fetch("/api/admin/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, status: "booked", note: buildBookedAvailabilityNote(inquiry.name, inquiry.preferred_time) }),
      });
      // Keep client_sessions in sync so the ICS calendar feed stays accurate
      const { error: sessionError } = await supabase.from("client_sessions")
        .update({ session_date: dateStr })
        .eq("client_email", inquiry.email)
        .is("session_date", null);
      const updated = await loadAdminInquiry(inquiry.id);
      if (updated) setInquiry(updated);
      setDetectedDate(null);
      setSessionDateInput("");
      fetchSunset(dateStr);
      if (!availRes.ok || sessionError) {
        console.error("confirmDate partial failure", { availabilityStatus: availRes.status, sessionError });
        showToast("Date saved, but the calendar didn't update — mark the date booked manually.", false);
      } else {
        showToast("Session date confirmed and calendar updated ✓");
      }
    } catch {
      showToast("Failed to save date", false);
    } finally {
      setDateConfirming(false);
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

  // ── Edit a reminder draft in place (re-render html when body changes) ─────
  function editReminder(index: number, patch: Partial<ReminderDraft>) {
    const firstName = inquiry?.name.split(" ")[0] || "there";
    setReminders(prev => prev.map((r, i) => {
      if (i !== index) return r;
      const next = { ...r, ...patch };
      if (patch.body !== undefined) {
        next.html = buildReminderEmail(r.id as ReminderEmailType, firstName, patch.body);
      }
      return next;
    }));
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
      let errorText = "";
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
            const event = JSON.parse(line.slice(6)) as { type: string; text?: string; message?: string; new_rules?: string[]; saved_to_vault?: boolean };
            if (event.type === "text" && event.text) {
              replyText += event.text;
            } else if (event.type === "error") {
              // The route streams failures as SSE over HTTP 200 — don't let
              // them fall through to the "Got it!" success reply.
              errorText = event.message || "Something went wrong — try again.";
            } else if (event.type === "done") {
              if (event.new_rules?.length) {
                setTrainSaved(event.new_rules);
                setTimeout(() => setTrainSaved([]), 5000);
              }
            }
          } catch { /* malformed event */ }
        }
      }

      setTrainMessages(p => [...p, { role: "assistant", content: replyText || errorText || "Got it!" }]);
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.page }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: T.action, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const statusMeta = STATUS_META[status] ?? STATUS_META.archived;
  const initials   = inquiry.name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";

  return (
    <div className="min-h-screen relative conv-shell" style={{ background: T.page, backgroundImage: T.canvasGlow }}>
      <link rel="stylesheet" href={FONTS_HREF} />
      <ConvStyles />

      {/* Safelight strip */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-50 pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${T.action}, transparent)`, animation: "conv-safelight 5s ease-in-out infinite" }}
        aria-hidden />

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 px-4 py-2.5 flex items-center gap-3"
        style={{ background: CONV.bar, backdropFilter: CONV.barBlur, WebkitBackdropFilter: CONV.barBlur, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => router.push("/admin?tab=inquiries")}
          className="text-[13px] font-semibold pl-2 pr-3 py-1.5 rounded-full hover:bg-white/5 transition-colors flex items-center gap-1.5 flex-shrink-0"
          style={{ color: T.inkSoft }}>
          <Icon name="back" size={15} /> Inquiries
        </button>
        <div className="h-5 w-px flex-shrink-0" style={{ background: T.borderStrong }} />
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0"
            style={{ background: CONV.gradClient, color: "#fff" }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight" style={{ color: T.ink, fontFamily: T.display }}>{inquiry.name}</p>
            {inquiry.session_type && (
              <p className="text-[10px] truncate leading-tight hidden sm:block uppercase tracking-[0.14em]" style={{ color: T.inkFaint, fontFamily: T.mono }}>{inquiry.session_type}</p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
            style={{ background: statusMeta.bg, color: statusMeta.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.dot }} />
            {statusMeta.label}
          </span>
        </div>
        <Link
          href={buildAdminPortalSessionHref({
            clientEmail: inquiry.email,
            sessionType: inquiry.session_type,
            sessionDate: inquiry.session_date ?? inquiry.date_in_mind,
          })}
          aria-label="Open portal session"
          title="Open portal session"
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-colors hover:bg-white/10 flex-shrink-0"
          style={{ color: T.action, border: `1px solid ${T.amberBorder}` }}
        >
          <Icon name="film" size={14} />
          <span className="hidden md:inline">Portal session</span>
        </Link>
        {/* Status segmented control */}
        <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-full flex-shrink-0" style={{ background: T.inset, border: `1px solid ${T.rowBorder}` }}>
          {(["new", "responded", "not_interested", "archived"] as const).map(s => (
            <button key={s} onClick={() => updateStatus(s)}
              className="text-[11px] font-semibold px-3 py-1 rounded-full transition-all"
              style={status === s
                ? { background: T.panelSolid, color: STATUS_META[s].color, border: `1px solid ${T.borderStrong}` }
                : { color: T.inkFaint }}>
              {s === "archived" ? "Archive" : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Pipeline rail ── */}
      <div className="relative max-w-7xl mx-auto px-4 pt-4 conv-rise">
        <PipelineRail inquiry={inquiry} messages={messages} />
      </div>

      {/* ── Main two-column layout ── */}
      <div className="relative max-w-7xl mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

        {/* LEFT: Gmail thread */}
        <ThreadColumn
          inquiry={inquiry}
          messages={messages}
          threadLoading={threadLoading}
          expanded={expanded}
          bodies={bodies}
          bodyLoading={bodyLoading}
          threadExpanded={threadExpanded}
          onThreadExpanded={setThreadExpanded}
          onToggleMessage={toggleExpand}
          onRefresh={() => fetchThread(inquiry.email)}
          copiedField={copiedField}
          onCopyField={copyField}
          bottomRef={bottomRef}
        />

        {/* RIGHT: workspace panels (sticky) */}
        <div className="lg:sticky lg:top-[65px] space-y-4 conv-rise" style={{ animationDelay: "80ms" }}>

          <ContactCard
            inquiry={inquiry}
            status={status}
            copiedField={copiedField}
            onCopyField={copyField}
          />

          <ProgressPanel
            inquiry={inquiry}
            onInquiryUpdate={(patch) => setInquiry(prev => (prev ? { ...prev, ...patch } : prev))}
            showToast={showToast}
          />

          <ComposePanel
            subject={subject}           onSubject={(v) => { setSubjectSource("manual"); setSubject(v); }}
            draft={draft}               onDraft={setDraft}
            composeRef={composeRef}
            messagesCount={messages.length}
            myEmail={myEmail}
            voiceActive={voiceActive}
            voiceError={voiceError}
            draftLoading={draftLoading}
            polishLoading={polishLoading}
            draftSaving={draftSaving}
            draftSaved={draftSaved}
            sendLoading={sendLoading}
            feedback={feedback}         onFeedback={setFeedback}
            refineSaved={refineSaved}
            onToggleVoice={toggleVoice}
            onFocusKeyboard={focusComposeForDictation}
            onPolish={() => polishDraft()}
            onGenerate={generateDraft}
            onSaveDraft={saveDraftToCloud}
            onSend={sendEmail}
          />

          <TrainAiPanel
            trainMessages={trainMessages}
            trainInput={trainInput}
            onTrainInput={setTrainInput}
            trainLoading={trainLoading}
            trainSaved={trainSaved}
            onSend={sendTrainMessage}
            chatRef={trainChatRef}
          />

          <SunsetCard
            sunsetLoading={sunsetLoading}
            sunsetInfo={sunsetInfo}
            sunsetDate={sunsetDate}
            dateInMind={inquiry.date_in_mind}
            onFetchSunset={fetchSunset}
          />

          <BookingPanel
            inquiry={inquiry}
            paymentLoading={paymentLoading}
            sessionDateInput={sessionDateInput}
            onSessionDateInput={setSessionDateInput}
            detectedDate={detectedDate}
            onDismissDetected={() => setDetectedDate(null)}
            detectLoading={detectLoading}
            dateConfirming={dateConfirming}
            remindersLoading={remindersLoading}
            remindersOpen={remindersOpen}
            contractLoading={contractLoading}
            previewLoading={previewLoading}
            confirmLoading={confirmLoading}
            markPaidLoading={markPaidLoading}
            onCheckPayment={checkPayment}
            onMarkPaid={markPaidManually}
            onDetectDate={detectDate}
            onConfirmDate={confirmDate}
            onScheduleReminders={scheduleReminders}
            onGenerateContract={generateContract}
            onPreviewConfirmation={previewConfirmation}
            onFetchSunset={fetchSunset}
          />

          {remindersOpen && (
            <RemindersPanel
              loading={remindersLoading}
              reminders={reminders}
              sendingReminder={sendingReminder}
              onClose={() => setRemindersOpen(false)}
              onEdit={editReminder}
              onPreview={previewReminderEmail}
              onSend={sendReminderViaGmail}
              onSaveEdits={saveReminderEdits}
            />
          )}

          <LearnPanel
            originalAiDraft={originalAiDraft}
            lastAiDraft={lastAiDraft}
            manualAiDraft={manualAiDraft}
            onManualAiDraft={setManualAiDraft}
            actualSent={actualSent}
            onActualSent={setActualSent}
            aiDraftExpanded={aiDraftExpanded}
            onAiDraftExpanded={setAiDraftExpanded}
            learnedRules={learnedRules}
            learnLoading={learnLoading}
            onAnalyze={learnFromReply}
            onReset={() => { setLearnedRules(null); setActualSent(""); setManualAiDraft(""); }}
          />

        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-[13px] font-semibold flex items-center gap-2 transition-all"
          style={{ background: T.panelSolid, color: T.ink, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadowHover }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: toast.ok ? T.green : T.red }} />
          {toast.msg}
        </div>
      )}

      {/* ── Email preview modal ── */}
      {previewHtml && (
        <ConfirmationModal
          inquiry={inquiry}
          previewHtml={previewHtml}
          customComment={customComment}
          onCustomComment={setCustomComment}
          confirmLoading={confirmLoading}
          onClose={() => setPreviewHtml(null)}
          onSend={sendConfirmation}
        />
      )}

      {/* ── Contract modal ── */}
      {contractText && (
        <ContractModal
          contractText={contractText}
          copied={contractCopied}
          onCopy={() => {
            navigator.clipboard.writeText(contractText);
            setContractCopied(true);
            setTimeout(() => setContractCopied(false), 2500);
          }}
          onClose={() => setContractText(null)}
        />
      )}
    </div>
  );
}
