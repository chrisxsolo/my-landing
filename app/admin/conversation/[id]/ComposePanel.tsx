"use client";
// Compose + send panel — subject/body, voice dictation, Polish, AI draft,
// cloud draft save, send via Gmail (⌘↵), and the AI refine strip. All state
// and handlers live in the page; this renders them.

import type { RefObject } from "react";
import { T, Icon, Spinner, Panel, PanelHead, MonoLabel } from "../ui";

type DraftIssue = {
  type: string;
  /** "factual" | "format" | "style". Absent from older responses. */
  category?: string;
  severity: "high" | "medium" | "low";
  description: string;
  excerpt?: string;
};

export type DraftValidation = {
  valid: boolean;
  needsReview: boolean;
  /** No factual or format breach. Deliberately separate from the prose. */
  factsVerified: boolean;
  /** Writing-quality flags. Advisory, never a verification. */
  styleIssues: DraftIssue[];
  issues: DraftIssue[];
};

export type ContextWarning = {
  code: string;
  severity: "high" | "medium" | "low";
  message: string;
};

export type DraftUsage = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  duration_ms: number;
  estimated_cost_usd: number;
  unpriced_model: boolean;
};

type Props = {
  subject: string;        onSubject: (v: string) => void;
  draft: string;          onDraft: (v: string) => void;
  composeRef: RefObject<HTMLTextAreaElement | null>;
  messagesCount: number;
  myEmail: string;
  voiceActive: boolean;
  voiceError: string | null;
  draftLoading: boolean;
  polishLoading: boolean;
  editLoading: null | "shorten" | "naturalize";
  exampleSaving: boolean;
  draftSaving: boolean;
  draftSaved: boolean;
  sendLoading: boolean;
  feedback: string;       onFeedback: (v: string) => void;
  validation: DraftValidation | null;
  contextWarnings: ContextWarning[];
  lastUsage: DraftUsage | null;
  onToggleVoice: () => void;
  onFocusKeyboard: () => void;
  onPolish: () => void;
  onGenerate: (feedback?: string) => void;
  onEdit: (mode: "shorten" | "naturalize") => void;
  onApproveExample: () => void;
  onSaveDraft: () => void;
  onSend: () => void;
};

export default function ComposePanel({
  subject, onSubject, draft, onDraft, composeRef, messagesCount, myEmail,
  voiceActive, voiceError, draftLoading, polishLoading, editLoading, exampleSaving,
  draftSaving, draftSaved, sendLoading, feedback, onFeedback,
  validation, contextWarnings, lastUsage, onToggleVoice, onFocusKeyboard,
  onPolish, onGenerate, onEdit, onApproveExample, onSaveDraft, onSend,
}: Props) {
  const canSend = Boolean(subject.trim() && draft.trim()) && !sendLoading;
  const anyAiBusy = draftLoading || polishLoading || editLoading !== null;

  // A high-severity issue means the draft states something unverified. It stays
  // editable and sendable — Chris is the one deciding — but it is never silent.
  const blockingIssues = (validation?.issues ?? []).filter(i => i.severity === "high");
  const softIssues     = (validation?.issues ?? []).filter(i => i.severity !== "high");
  const highWarnings   = contextWarnings.filter(w => w.severity === "high");
  const otherWarnings  = contextWarnings.filter(w => w.severity === "medium");

  return (
    <Panel>
      <div className="p-5 space-y-3">

        {/* Header row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <PanelHead icon="send" tint={T.action} bg={T.amberBg} title="Compose Reply" />
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={onFocusKeyboard}
              title="Open the keyboard — use its mic button for native voice dictation"
              className="sm:hidden text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-all hover:opacity-80 flex items-center gap-1.5"
              style={{ background: T.greenBg, color: T.green }}>
              <Icon name="keyboard" size={12} /> Keyboard
            </button>
            <button onClick={onToggleVoice}
              title={voiceActive ? "Stop recording — will auto-polish" : "Speak your reply — auto-polishes when done"}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-all hover:opacity-80 flex items-center gap-1.5"
              style={voiceActive
                ? { background: T.redBg, color: T.red, border: `1px solid ${T.redBorder}` }
                : { background: T.blueBg, color: T.blue }}>
              {voiceActive
                ? <><span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: T.red }} /> Stop</>
                : <><Icon name="mic" size={12} /> Speak</>}
            </button>
            <button onClick={onPolish} disabled={polishLoading || !draft.trim()}
              title="Fix typos, convert bullet points to paragraphs"
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-all hover:opacity-80 disabled:opacity-30 flex items-center gap-1.5"
              style={{ background: T.violetBg, color: T.violet }}>
              {polishLoading
                ? <><Spinner size={11} /> Polishing…</>
                : <><Icon name="sparkle" size={12} /> Polish</>}
            </button>
            <button onClick={() => onEdit("shorten")} disabled={anyAiBusy || !draft.trim()}
              title="Cut the length, keep every fact"
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-all hover:opacity-80 disabled:opacity-30 flex items-center gap-1.5"
              style={{ background: T.blueBg, color: T.blue }}>
              {editLoading === "shorten"
                ? <><Spinner size={11} /> Trimming…</>
                : "Shorter"}
            </button>
            <button onClick={() => onEdit("naturalize")} disabled={anyAiBusy || !draft.trim()}
              title="Rewrite in your voice, facts untouched"
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-all hover:opacity-80 disabled:opacity-30 flex items-center gap-1.5"
              style={{ background: T.blueBg, color: T.blue }}>
              {editLoading === "naturalize"
                ? <><Spinner size={11} /> Rewriting…</>
                : "More natural"}
            </button>
            <button onClick={() => onGenerate()} disabled={anyAiBusy}
              className="text-[11px] font-black px-3 py-1.5 rounded-full transition-all hover:-translate-y-px disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: T.action, color: T.actionText, boxShadow: T.glow }}>
              {draftLoading
                ? <><Spinner size={11} /> Writing…</>
                : <><Icon name="sparkle" size={12} /> {draft.trim() ? "Regenerate" : "Draft with AI"}</>}
            </button>
          </div>
        </div>

        {/* Context indicator */}
        {messagesCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: T.greenBg, color: T.green }}>
            <Icon name="check" size={12} className="flex-shrink-0" />
            <span>{messagesCount} prior email{messagesCount > 1 ? "s" : ""} loaded — AI uses full conversation</span>
          </div>
        )}

        {/* Context gaps: what could not be verified before the draft was written */}
        {highWarnings.length > 0 && (
          <div className="px-3 py-2 rounded-xl text-xs space-y-1"
            style={{ background: T.redBg, color: T.red, border: `1px solid ${T.redBorder}` }}>
            <MonoLabel color={T.red}>Unverified context</MonoLabel>
            {highWarnings.map(w => (
              <p key={w.code} className="leading-snug">{w.message}</p>
            ))}
          </div>
        )}
        {otherWarnings.length > 0 && (
          <div className="px-3 py-2 rounded-xl text-xs space-y-1"
            style={{ background: T.amberBg, color: T.action }}>
            {otherWarnings.map(w => (
              <p key={w.code} className="leading-snug">{w.message}</p>
            ))}
          </div>
        )}

        {/* Deterministic validation of the draft itself */}
        {blockingIssues.length > 0 && (
          <div className="px-3 py-2 rounded-xl text-xs space-y-1"
            style={{ background: T.redBg, color: T.red, border: `1px solid ${T.redBorder}` }}>
            <MonoLabel color={T.red}>Check before sending</MonoLabel>
            {blockingIssues.map((issue, i) => (
              <p key={`${issue.type}-${i}`} className="leading-snug">
                {issue.description}{issue.excerpt ? ` (${issue.excerpt})` : ""}
              </p>
            ))}
          </div>
        )}
        {blockingIssues.length === 0 && softIssues.length > 0 && (
          <div className="px-3 py-2 rounded-xl text-xs space-y-1"
            style={{ background: T.inset, color: T.inkFaint }}>
            {softIssues.map((issue, i) => (
              <p key={`${issue.type}-${i}`} className="leading-snug">
                {issue.description}{issue.excerpt ? ` (${issue.excerpt})` : ""}
              </p>
            ))}
          </div>
        )}
        {/* Facts and prose are reported separately on purpose. The old copy
            said "format and facts check out", which read as "send it" — but
            nothing here assesses whether the email sounds like Chris. */}
        {validation && validation.factsVerified && validation.issues.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: T.greenBg, color: T.green }}>
            <Icon name="check" size={12} className="flex-shrink-0" />
            <span>Dates, prices and booking status check out. Read it for voice before sending.</span>
          </div>
        )}
        {validation && validation.factsVerified && validation.styleIssues.length > 0 && (
          <div className="px-3 py-2 rounded-xl text-xs font-medium space-y-1"
            style={{ background: T.blueBg, color: T.blue }}>
            <p className="font-semibold">Facts are fine. These read as not-quite-Chris:</p>
            {validation.styleIssues.map((issue, i) => (
              <p key={`style-${issue.type}-${i}`} className="leading-snug">
                {issue.description}{issue.excerpt ? ` (${issue.excerpt})` : ""}
              </p>
            ))}
          </div>
        )}

        {/* Voice indicators */}
        {voiceActive && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: T.redBg, color: T.red, border: `1px solid ${T.redBorder}` }}>
            <span className="inline-block w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: T.red }} />
            <span>Recording… speak naturally. Hit Stop when done — auto-transcribes and polishes.</span>
          </div>
        )}
        {draftLoading && !voiceActive && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: T.blueBg, color: T.blue }}>
            <Spinner size={12} />
            <span>Transcribing with Whisper…</span>
          </div>
        )}
        {voiceError && (
          <div className="px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: T.redBg, color: T.red }}>
            {voiceError}
          </div>
        )}

        {/* Subject */}
        <div>
          <MonoLabel className="block mb-1">Subject</MonoLabel>
          <input type="text" value={subject} onChange={e => onSubject(e.target.value)}
            className="conv-input w-full px-3 py-2 rounded-xl font-medium"
            style={{ border: `1px solid ${T.border}`, background: T.inset, color: T.ink, fontFamily: "inherit", fontSize: "16px" }} />
        </div>

        {/* Body */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <MonoLabel>
              Message
              <span className="normal-case font-normal tracking-normal ml-1" style={{ color: T.inkFaint, opacity: 0.7, fontFamily: "inherit" }}>· type, paste, or use AI above</span>
            </MonoLabel>
            <button onClick={onSaveDraft} disabled={draftSaving || !draft.trim()}
              className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all disabled:opacity-30 flex items-center gap-1"
              style={draftSaved
                ? { background: T.greenBg, color: T.green }
                : { background: T.inset, color: T.inkFaint }}>
              {draftSaving ? "Saving…" : draftSaved ? <><Icon name="check" size={10} /> Saved</> : "Save draft"}
            </button>
          </div>
          <textarea
            ref={composeRef}
            value={draft} onChange={e => onDraft(e.target.value)}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSend) onSend(); }}
            rows={11}
            placeholder={"Write your reply here…\n\nTip: type in bullet points and hit Polish to auto-format into a proper email."}
            className="conv-input w-full leading-relaxed rounded-xl p-3 resize-none sm:resize-y"
            style={{ border: `1px solid ${T.border}`, background: T.inset, color: T.ink, fontFamily: "inherit", fontSize: "16px" }} />
        </div>

        {/* Send */}
        <button onClick={onSend} disabled={!canSend}
          className="w-full text-sm font-black py-3 rounded-xl transition-all hover:-translate-y-px disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: T.action, color: T.actionText, boxShadow: T.glow }}>
          {sendLoading ? <><Spinner size={14} /> Sending…</> : <><Icon name="send" size={14} /> Send from Gmail</>}
        </button>
        <p className="text-[10px] text-center" style={{ color: T.inkFaint }}>
          ⌘↵ to send · from {myEmail || "your Gmail"} · lands in Sent Mail · marks inquiry as Responded
        </p>

        {/* AI Refine */}
        <div className="pt-2 space-y-2" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
          <MonoLabel>
            Refine AI draft
            <span className="normal-case font-normal tracking-normal ml-1" style={{ color: T.inkFaint, opacity: 0.7, fontFamily: "inherit" }}>· applies your change only, saves no rule</span>
          </MonoLabel>
          <div className="flex gap-2">
            <input type="text" value={feedback} onChange={e => onFeedback(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && feedback.trim() && !draftLoading) onGenerate(feedback); }}
              placeholder='e.g. "be more direct" · "add turnaround time"'
              className="conv-input flex-1 px-3 py-2 rounded-xl"
              style={{ border: `1px solid ${T.border}`, background: T.inset, color: T.ink, fontFamily: "inherit", fontSize: "16px" }} />
            <button onClick={() => { if (feedback.trim()) onGenerate(feedback); }}
              disabled={!feedback.trim() || draftLoading}
              className="text-xs font-bold px-3.5 py-2 rounded-xl disabled:opacity-30 flex-shrink-0 transition-all hover:opacity-90"
              style={{ background: T.violetBg, color: T.violet, border: `1px solid ${T.violetBorder}` }}>
              Refine
            </button>
          </div>
          {/* Approving a draft is the only way an email becomes a writing
              reference. Being in Sent Mail is not approval. */}
          <button onClick={onApproveExample} disabled={exampleSaving || !draft.trim()}
            title="Save this wording as a reference for future drafts"
            className="w-full text-[11px] font-bold py-2 rounded-xl transition-all hover:opacity-80 disabled:opacity-30 flex items-center justify-center gap-1.5"
            style={{ background: T.inset, color: T.inkFaint, border: `1px solid ${T.rowBorder}` }}>
            {exampleSaving
              ? <><Spinner size={11} /> Saving…</>
              : "Approve as writing example"}
          </button>
        </div>

        {/* Cost of the last call. Shown because an assistant you can see the
            price of is one you can trust to be cheap. */}
        {lastUsage && (
          <p className="text-[10px] text-center" style={{ color: T.inkFaint, opacity: 0.75 }}>
            {lastUsage.model} · {lastUsage.input_tokens + lastUsage.cache_read_input_tokens} in
            {lastUsage.cache_read_input_tokens > 0 ? ` (${lastUsage.cache_read_input_tokens} cached)` : ""}
            {" · "}{lastUsage.output_tokens} out · {(lastUsage.duration_ms / 1000).toFixed(1)}s ·{" "}
            {lastUsage.unpriced_model
              ? "cost unknown for this model"
              : `~$${lastUsage.estimated_cost_usd.toFixed(4)} est.`}
          </p>
        )}
      </div>
    </Panel>
  );
}
