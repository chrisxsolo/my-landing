"use client";
// Compose + send panel — subject/body, voice dictation, Polish, AI draft,
// cloud draft save, send via Gmail (⌘↵), and the AI refine strip. All state
// and handlers live in the page; this renders them.

import type { RefObject } from "react";
import { T, Icon, Spinner, Panel, PanelHead, MonoLabel } from "../ui";

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
  draftSaving: boolean;
  draftSaved: boolean;
  sendLoading: boolean;
  feedback: string;       onFeedback: (v: string) => void;
  refineSaved: string | null;
  onToggleVoice: () => void;
  onFocusKeyboard: () => void;
  onPolish: () => void;
  onGenerate: (feedback?: string) => void;
  onSaveDraft: () => void;
  onSend: () => void;
};

export default function ComposePanel({
  subject, onSubject, draft, onDraft, composeRef, messagesCount, myEmail,
  voiceActive, voiceError, draftLoading, polishLoading, draftSaving, draftSaved,
  sendLoading, feedback, onFeedback, refineSaved, onToggleVoice, onFocusKeyboard,
  onPolish, onGenerate, onSaveDraft, onSend,
}: Props) {
  const canSend = Boolean(subject.trim() && draft.trim()) && !sendLoading;

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
            <button onClick={() => onGenerate()} disabled={draftLoading}
              className="text-[11px] font-black px-3 py-1.5 rounded-full transition-all hover:-translate-y-px disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: T.action, color: T.actionText, boxShadow: T.glow }}>
              {draftLoading
                ? <><Spinner size={11} /> Writing…</>
                : <><Icon name="sparkle" size={12} /> Draft with AI</>}
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
          <MonoLabel>Refine AI draft</MonoLabel>
          <div className="flex gap-2">
            <input type="text" value={feedback} onChange={e => onFeedback(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && feedback.trim()) onGenerate(feedback); }}
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
          {refineSaved && (
            <div className="flex items-start gap-1.5 text-[11px] rounded-lg px-3 py-2 leading-snug"
              style={{ background: T.greenBg, color: T.green }}>
              <Icon name="check" size={11} className="flex-shrink-0 mt-0.5" /> Rule saved: &ldquo;{refineSaved}&rdquo;
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
