"use client";
// Session reminders panel — all 5 touchpoint drafts, editable inline, with
// styled preview and direct Gmail send. Generation/persistence in the page.

import { T, Icon, Spinner, Panel, PanelHead, MonoLabel } from "../ui";
import type { ReminderDraft } from "./helpers";

type Props = {
  loading: boolean;
  reminders: ReminderDraft[];
  sendingReminder: string | null;
  onClose: () => void;
  onEdit: (index: number, patch: Partial<ReminderDraft>) => void;
  onPreview: (r: ReminderDraft) => void;
  onSend: (r: ReminderDraft) => void;
  onSaveEdits: () => void;
};

export default function RemindersPanel(p: Props) {
  return (
    <Panel>
      <div className="p-5">
        <div className="mb-4">
          <PanelHead icon="bell" tint={T.action} bg={T.amberBg} title="Session Reminders"
            right={
              <button onClick={p.onClose}
                className="flex items-center gap-1 text-xs font-bold transition-colors hover:opacity-70"
                style={{ color: T.inkFaint }}>
                <Icon name="x" size={12} /> Close
              </button>
            } />
        </div>

        {p.loading ? (
          <div className="flex flex-col items-center gap-3 py-10" style={{ color: T.inkFaint }}>
            <Spinner size={24} />
            <p className="text-sm font-semibold">Generating all 5 drafts…</p>
          </div>
        ) : p.reminders.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: T.inkFaint }}>No drafts yet — click Reminders to generate.</p>
        ) : (
          <div className="space-y-4">
            {p.reminders.map((r, i) => (
              <div key={r.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.rowBorder}` }}>
                <div className="flex items-center justify-between px-4 py-2.5 gap-2 flex-wrap"
                  style={{ background: T.amberBg, borderBottom: `1px solid ${T.rowBorder}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{r.emoji}</span>
                    <p className="text-xs font-bold" style={{ color: T.ink }}>{i + 1}. {r.label}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.html && (
                      <button
                        onClick={() => p.onPreview(r)}
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                        style={{ background: T.violetBg, color: T.violet }}>
                        <Icon name="eye" size={11} /> Preview
                      </button>
                    )}
                    <button
                      onClick={() => p.onSend(r)}
                      disabled={p.sendingReminder === r.id}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-all hover:opacity-80 disabled:opacity-60"
                      style={{ background: T.action, color: T.actionText }}>
                      {p.sendingReminder === r.id ? "Sending…" : "Send via Gmail →"}
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3" style={{ background: T.panelSolid }}>
                  <MonoLabel className="block mb-1">Subject</MonoLabel>
                  <input
                    type="text"
                    value={r.subject}
                    onChange={e => p.onEdit(i, { subject: e.target.value })}
                    className="conv-input w-full text-xs font-semibold rounded-lg px-2 py-1.5 mb-2"
                    style={{ border: `1px solid ${T.border}`, background: T.inset, color: T.ink, fontFamily: "inherit" }}
                  />
                  <textarea
                    value={r.body}
                    onChange={e => p.onEdit(i, { body: e.target.value })}
                    rows={4}
                    className="conv-input w-full text-xs leading-relaxed rounded-lg p-2 resize-none"
                    style={{ border: `1px solid ${T.border}`, background: T.inset, color: T.ink, fontFamily: "inherit" }}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px]" style={{ color: T.inkFaint }}>
                Edits here are used for Preview and Send.
              </p>
              <button
                onClick={p.onSaveEdits}
                className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                style={{ background: T.action, color: T.actionText }}>
                Save drafts <Icon name="check" size={11} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
