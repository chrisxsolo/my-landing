"use client";
// Train AI chat — per-conversation chat that writes style rules to the
// Obsidian vault. Streaming + state owned by the page.

import type { RefObject } from "react";
import { T, Icon, Spinner, Panel, PanelHead } from "../ui";

type Props = {
  trainMessages: { role: "user" | "assistant"; content: string }[];
  trainInput: string;
  onTrainInput: (v: string) => void;
  trainLoading: boolean;
  trainSaved: string[];
  onSend: () => void;
  chatRef: RefObject<HTMLDivElement | null>;
};

export default function TrainAiPanel({ trainMessages, trainInput, onTrainInput, trainLoading, trainSaved, onSend, chatRef }: Props) {
  return (
    <Panel>
      <div className="p-4" style={{ borderBottom: `1px solid ${T.rowBorder}` }}>
        <PanelHead icon="chat" tint={T.violet} bg={T.violetBg}
          title="Train AI" sub="Rules save directly to Obsidian vault" />
      </div>
      {/* Chat history */}
      <div ref={chatRef} className="p-4 space-y-3 max-h-72 overflow-y-auto">
        {trainMessages.length === 0 && (
          <p className="text-xs text-center py-4 leading-relaxed" style={{ color: T.inkFaint }}>
            Tell me how to handle this client or any rule you want remembered.<br />
            <span style={{ opacity: 0.7 }}>e.g. &ldquo;Don&apos;t push pricing on warm leads&rdquo; · &ldquo;Always mention golden hour&rdquo;</span>
          </p>
        )}
        {trainMessages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[82%] px-3 py-2 text-sm leading-relaxed"
              style={m.role === "user"
                ? { background: T.action, color: T.actionText, borderRadius: "16px 16px 4px 16px" }
                : { background: T.inset, color: T.inkSoft, borderRadius: "16px 16px 16px 4px" }}>
              {m.content}
            </div>
          </div>
        ))}
        {trainLoading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-2xl text-sm flex items-center gap-2"
              style={{ background: T.inset, color: T.inkFaint }}>
              <Spinner size={12} /> Thinking…
            </div>
          </div>
        )}
        {trainSaved.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
            style={{ background: T.greenBg, color: T.green }}>
            <Icon name="check" size={11} /> {trainSaved.length} rule{trainSaved.length > 1 ? "s" : ""} saved to Obsidian vault
          </div>
        )}
      </div>
      {/* Input */}
      <div className="p-3 flex gap-2" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
        <input
          type="text"
          value={trainInput}
          onChange={e => onTrainInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="e.g. Keep replies short for warm leads…"
          disabled={trainLoading}
          className="conv-input flex-1 text-sm px-3 py-2 rounded-xl disabled:opacity-50"
          style={{ border: `1px solid ${T.border}`, background: T.inset, color: T.ink, fontFamily: "inherit" }}
        />
        <button
          onClick={onSend}
          disabled={!trainInput.trim() || trainLoading}
          className="text-xs font-bold px-3.5 py-2 rounded-xl disabled:opacity-30 flex-shrink-0 transition-all hover:opacity-80"
          style={{ background: T.action, color: T.actionText }}>
          Send
        </button>
      </div>
    </Panel>
  );
}
