"use client";
// Learn from Reply — compares the AI draft with what was actually sent and
// saves the style differences as permanent rules. Analysis lives in the page.

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

        {p.learnedRules ? (
          <div className="rounded-xl p-4 space-y-2"
            style={{ background: T.greenBg, border: `1px solid ${T.greenBorder}` }}>
            <p className="flex items-center gap-1.5" style={{ color: T.green }}>
              <Icon name="check" size={11} />
              <MonoLabel color={T.green}>{p.learnedRules.length} rule{p.learnedRules.length === 1 ? "" : "s"} saved to Obsidian vault</MonoLabel>
            </p>
            <ul className="space-y-1.5">
              {p.learnedRules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 text-xs" style={{ color: T.green, opacity: 0.6 }}>–</span>
                  <span className="text-xs leading-snug" style={{ color: T.inkSoft }}>{rule}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] pt-1" style={{ color: T.inkFaint }}>Applied to all future drafts automatically.</p>
            <button onClick={p.onReset}
              className="text-xs font-bold transition-colors hover:opacity-70" style={{ color: T.violet }}>
              ↩ Analyze another
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
              Paste what you actually sent. Claude compares it to the AI draft and saves the style differences permanently.
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
                : <><Icon name="pen" size={13} /> Analyze & save to Obsidian</>}
            </button>
          </>
        )}
      </div>
    </Panel>
  );
}
