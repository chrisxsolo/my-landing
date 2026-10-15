"use client";
// Learn from Reply — compares the AI draft with what was actually sent.
// Factual changes are reported as corrections; style changes become rule
// candidates that need approval. Analysis lives in the page.

import { T, Icon, Spinner, Panel, PanelHead, MonoLabel } from "../ui";

type Props = {
  originalAiDraft: string;
  lastAiDraft: string;
  manualAiDraft: string;
  onManualAiDraft: (v: string) => void;
  actualSent: string;
  onActualSent: (v: string) => void;
  aiDraftExpanded: boolean;
  onAiDraftExpanded: (v: boolean) => void;
  learnedRules: string[] | null;
  /** Edits classified as corrections to this one email, not preferences. */
  factualEdits: string[];
  learnLoading: boolean;
  onAnalyze: () => void;
  onReset: () => void;
};

export default function LearnPanel(p: Props) {
  const hasAiDraft = Boolean(p.originalAiDraft || p.lastAiDraft);

  return (
    <Panel>
      <div className="p-5 space-y-3">
        <PanelHead icon="pen" tint={T.action} bg={T.amberBg} title="Learn from reply" />

        {/* Shown whether or not any rule came out: it is the answer to "why
            didn't it learn that?", and the old system's worst habit was
            turning exactly these edits into permanent style rules. */}
        {p.factualEdits.length > 0 && (
          <div className="rounded-xl p-3 space-y-1.5"
            style={{ background: T.inset, border: `1px solid ${T.rowBorder}` }}>
            <MonoLabel>Corrections to this email only</MonoLabel>
            {p.factualEdits.map((edit, i) => (
              <p key={i} className="text-[11px] leading-snug" style={{ color: T.inkFaint }}>{edit}</p>
            ))}
            <p className="text-[10px] pt-0.5" style={{ color: T.inkFaint, opacity: 0.8 }}>
              Not saved as rules. A changed date or price belongs to this client, not to your writing style.
            </p>
          </div>
        )}

        {p.learnedRules ? (
          <div className="rounded-xl p-4 space-y-2"
            style={{ background: T.greenBg, border: `1px solid ${T.greenBorder}` }}>
            <p className="flex items-center gap-1.5" style={{ color: T.green }}>
              <Icon name="check" size={11} />
              <MonoLabel color={T.green}>{p.learnedRules.length} rule{p.learnedRules.length === 1 ? "" : "s"} waiting for your approval</MonoLabel>
            </p>
            <ul className="space-y-1.5">
              {p.learnedRules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 text-xs" style={{ color: T.green, opacity: 0.6 }}>–</span>
                  <span className="text-xs leading-snug" style={{ color: T.inkSoft }}>{rule}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] pt-1" style={{ color: T.inkFaint }}>
              Nothing changes until you approve these on the AI tab. A rule that contradicts one you already approved is flagged there instead of being stacked on top of it.
            </p>
            <button onClick={p.onReset}
              className="text-xs font-bold transition-colors hover:opacity-70" style={{ color: T.violet }}>
              ↩ Analyze another
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
              Paste what you actually sent. The differences are classified first: changed dates, prices, times, and names are treated as corrections to this email, and only genuine style changes become rules for you to approve.
            </p>

            {hasAiDraft ? (
              <div className="rounded-xl p-3 space-y-1"
                style={{ background: T.inset, border: `1px solid ${T.rowBorder}` }}>
                <div className="flex items-center justify-between">
                  <MonoLabel>Original AI draft</MonoLabel>
                  <button
                    onClick={() => p.onAiDraftExpanded(!p.aiDraftExpanded)}
                    className="text-[10px] underline underline-offset-2 transition-colors hover:opacity-70"
                    style={{ color: T.inkFaint }}>
                    {p.aiDraftExpanded ? "Collapse" : "Show full"}
                  </button>
                </div>
                <p className={`text-xs leading-relaxed whitespace-pre-wrap${p.aiDraftExpanded ? "" : " line-clamp-3"}`}
                  style={{ color: T.inkFaint }}>{p.originalAiDraft || p.lastAiDraft}</p>
              </div>
            ) : (
              <div>
                <MonoLabel className="block mb-1">
                  AI draft <span className="normal-case font-normal tracking-normal" style={{ opacity: 0.7, fontFamily: "inherit" }}>(paste here if you didn&apos;t use Draft with AI)</span>
                </MonoLabel>
                <textarea
                  value={p.manualAiDraft}
                  onChange={e => p.onManualAiDraft(e.target.value)}
                  rows={4}
                  placeholder="Paste the AI-generated draft here…"
                  className="conv-input w-full leading-relaxed rounded-xl p-3 resize-none sm:resize-y"
                  style={{ border: `1px solid ${T.border}`, background: T.inset, color: T.inkSoft, fontFamily: "inherit", fontSize: "16px" }} />
              </div>
            )}

            <div>
              <MonoLabel className="block mb-1">What you actually sent</MonoLabel>
              <textarea
                value={p.actualSent}
                onChange={e => p.onActualSent(e.target.value)}
                rows={6}
                placeholder="Paste the email you sent here…"
                className="conv-input w-full leading-relaxed rounded-xl p-3 resize-none sm:resize-y"
                style={{ border: `1px solid ${T.amberBorder}`, background: T.inset, color: T.ink, fontFamily: "inherit", fontSize: "16px" }} />
            </div>

            <button
              onClick={p.onAnalyze}
              disabled={(!hasAiDraft && !p.manualAiDraft.trim()) || !p.actualSent.trim() || p.learnLoading}
              className="w-full text-sm font-black py-2.5 rounded-xl transition-all hover:-translate-y-px disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: T.action, color: T.actionText, boxShadow: T.glow }}>
              {p.learnLoading
                ? <><Spinner size={13} /> Analyzing…</>
                : <><Icon name="pen" size={13} /> Learn from edit</>}
            </button>
          </>
        )}
      </div>
    </Panel>
  );
}
