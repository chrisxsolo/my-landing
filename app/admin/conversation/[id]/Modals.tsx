"use client";
// Overlay modals: booking-confirmation email preview and the generated
// contract. Both render over a Darkroom scrim; the email preview itself stays
// on white since that's how the client will see it.

import type { AdminInquiry } from "@/lib/adminInquiries";
import { T, Icon, Spinner, PanelHead, MonoLabel } from "../ui";

export function ConfirmationModal({ inquiry, previewHtml, customComment, onCustomComment, confirmLoading, onClose, onSend }: {
  inquiry: AdminInquiry;
  previewHtml: string;
  customComment: string;
  onCustomComment: (v: string) => void;
  confirmLoading: boolean;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
      style={{ background: T.scrim, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col conv-rise"
        style={{ background: T.panelSolid, border: `1px solid ${T.border}`, maxHeight: "calc(100vh - 80px)", boxShadow: T.shadowHover }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${T.rowBorder}` }}>
          <PanelHead icon="mail" tint={T.red} bg={T.redBg}
            title="Booking Confirmation Email" sub={`To: ${inquiry.name} <${inquiry.email}>`} />
          <button onClick={onClose}
            className="p-2 rounded-full transition-colors hover:bg-white/5" style={{ color: T.inkFaint }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Custom note input */}
        <div className="px-5 py-3 flex-shrink-0" style={{ background: T.inset, borderBottom: `1px solid ${T.rowBorder}` }}>
          <MonoLabel className="block mb-1.5">
            Add a personal note <span className="normal-case font-normal tracking-normal" style={{ opacity: 0.7, fontFamily: "inherit" }}>(optional — appears in the email)</span>
          </MonoLabel>
          <textarea
            value={customComment}
            onChange={e => onCustomComment(e.target.value)}
            rows={2}
            placeholder={"e.g. \"Can't wait to shoot with you! Feel free to text me if anything comes up.\""}
            className="conv-input w-full rounded-lg px-3 py-2 resize-none text-sm leading-relaxed"
            style={{ border: `1px solid ${T.greenBorder}`, background: T.panelSolid, color: T.ink, fontFamily: "inherit" }}
          />
          {customComment.trim() && (
            <p className="text-[10px] mt-1 font-medium" style={{ color: T.green }}>↓ Preview will update when you resend</p>
          )}
        </div>

        {/* Email preview — white, as the client sees it */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff" }}
            dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>

        {/* Action bar */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
          <button onClick={onClose}
            className="flex-1 text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-80"
            style={{ background: T.neutralBg, color: T.inkSoft }}>
            Cancel
          </button>
          <button
            onClick={onSend}
            disabled={confirmLoading}
            className="flex-1 text-sm font-black py-2.5 rounded-xl transition-all hover:-translate-y-px disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: T.action, color: T.actionText, boxShadow: T.glow }}>
            {confirmLoading
              ? <><Spinner size={13} /> Sending…</>
              : <><Icon name="send" size={13} /> Send from Gmail</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ContractModal({ contractText, copied, onCopy, onClose }: {
  contractText: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
      style={{ background: T.scrim, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col conv-rise"
        style={{ background: T.panelSolid, border: `1px solid ${T.border}`, maxHeight: "calc(100vh - 80px)", boxShadow: T.shadowHover }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${T.rowBorder}` }}>
          <PanelHead icon="doc" tint={T.violet} bg={T.violetBg}
            title="Photography Contract" sub="Copy and paste into Pixieset to send" />
          <button onClick={onClose}
            className="p-2 rounded-full transition-colors hover:bg-white/5" style={{ color: T.inkFaint }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Copy button */}
        <div className="px-5 py-3 flex-shrink-0" style={{ background: T.inset, borderBottom: `1px solid ${T.rowBorder}` }}>
          <button
            onClick={onCopy}
            className="w-full text-sm font-black py-2.5 rounded-xl transition-all hover:-translate-y-px flex items-center justify-center gap-2"
            style={copied
              ? { background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }
              : { background: T.action, color: T.actionText, boxShadow: T.glow }}>
            <Icon name={copied ? "check" : "copy"} size={13} />
            {copied ? "Copied to clipboard!" : "Copy entire contract"}
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: T.inkFaint }}>
            Placeholders in [brackets] need to be filled in manually
          </p>
        </div>

        {/* Contract text */}
        <div className="flex-1 overflow-y-auto p-4">
          <textarea
            readOnly
            value={contractText}
            rows={30}
            className="w-full text-xs leading-relaxed rounded-xl p-4 resize-none outline-none"
            style={{ background: T.inset, border: `1px solid ${T.rowBorder}`, color: T.inkSoft, fontFamily: T.mono }}
          />
        </div>

        <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
          <button onClick={onClose}
            className="w-full text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-80"
            style={{ background: T.neutralBg, color: T.inkSoft }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
