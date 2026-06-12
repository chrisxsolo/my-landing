"use client";
// Left column: the original contact-form submission + the Gmail thread,
// rendered chat-style — client messages anchored left, mine right with a
// safelight wash. Expand/collapse + lazy body loading are owned by the page.

import type { RefObject } from "react";
import type { GmailMessage } from "@/app/api/gmail/thread/route";
import type { AdminInquiry } from "@/lib/adminInquiries";
import { T, CONV, Icon, type IconName, Spinner, Panel, MonoLabel } from "../ui";
import { fmt12h, fmtDate, stripQuotes } from "./helpers";

type Props = {
  inquiry: AdminInquiry;
  messages: GmailMessage[];
  threadLoading: boolean;
  expanded: Record<string, boolean>;
  bodies: Record<string, string>;
  bodyLoading: Record<string, boolean>;
  threadExpanded: boolean;
  onThreadExpanded: (open: boolean) => void;
  onToggleMessage: (id: string) => void;
  onRefresh: () => void;
  copiedField: string | null;
  onCopyField: (text: string, label: string) => void;
  bottomRef: RefObject<HTMLDivElement | null>;
};

export default function ThreadColumn({
  inquiry, messages, threadLoading, expanded, bodies, bodyLoading, threadExpanded,
  onThreadExpanded, onToggleMessage, onRefresh, copiedField, onCopyField, bottomRef,
}: Props) {
  const lastMsg  = messages.at(-1);
  const yourTurn = lastMsg ? !lastMsg.isMe : inquiry.status === "new";

  function renderMsg(msg: GmailMessage) {
    const isOpen  = expanded[msg.id] ?? false;
    const body    = bodies[msg.id];
    const loading = bodyLoading[msg.id];
    return (
      <div key={msg.id} className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}>
        <div className="rounded-2xl overflow-hidden w-full sm:w-[88%] transition-shadow"
          style={{
            background: msg.isMe ? CONV.meBubble : T.panel,
            border: `1px solid ${msg.isMe ? CONV.meBubbleBorder : T.border}`,
            boxShadow: T.shadow,
          }}>
          <button
            onClick={() => onToggleMessage(msg.id)}
            className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0 mt-0.5"
              style={msg.isMe ? { background: CONV.gradMe, color: T.actionText } : { background: CONV.gradClient, color: "#fff" }}>
              {msg.fromName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <p className="text-[13px] font-bold" style={{ color: T.ink }}>
                  {msg.isMe ? "You" : msg.fromName}
                  {msg.isMe && <span className="text-[11px] font-normal ml-1.5" style={{ color: T.inkFaint }}>to {inquiry.name}</span>}
                </p>
                <p className="text-[11px] flex-shrink-0" style={{ color: T.inkFaint, fontFamily: T.mono }}>{fmtDate(msg.timestamp)}</p>
              </div>
              {!isOpen && <p className="text-xs mt-0.5 truncate" style={{ color: T.inkFaint }}>{msg.snippet}</p>}
            </div>
            <Icon name="chevron" size={14} className={`flex-shrink-0 mt-1.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
              style={{ color: T.inkFaint }} />
          </button>
          {isOpen && (
            <div className="px-4 pb-4 pt-3" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
              {loading ? (
                <div className="flex items-center gap-2 py-4" style={{ color: T.inkFaint }}>
                  <Spinner size={14} />
                  <span className="text-xs">Loading message…</span>
                </div>
              ) : (
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans"
                  style={{ overflowWrap: "anywhere", color: T.inkSoft }}>
                  {body ? stripQuotes(body) : msg.snippet}
                </pre>
              )}
              <p className="text-[10px] mt-3" style={{ color: T.inkFaint, opacity: 0.8, fontFamily: T.mono }}>{msg.subject} · {msg.date}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const middleMessages = messages.length > 2 ? messages.slice(1, messages.length - 1) : [];
  const hidden = !threadExpanded ? middleMessages : [];

  return (
    <div className="space-y-3 conv-rise">
      {/* Thread header */}
      <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
        <div>
          <MonoLabel color={T.action}>Conversation</MonoLabel>
          <p className="text-xs mt-0.5" style={{ color: T.inkFaint }}>
            {threadLoading ? "Loading…" : messages.length === 0
              ? "No prior emails found in Gmail"
              : `${messages.length} message${messages.length === 1 ? "" : "s"} with ${inquiry.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!threadLoading && messages.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={yourTurn
                ? { background: T.amberBg, color: T.action, border: `1px solid ${T.amberBorder}` }
                : { background: T.blueBg, color: T.blue, border: `1px solid ${T.blueBorder}` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
              {yourTurn ? "Your turn" : "Waiting on client"}
            </span>
          )}
          <button onClick={onRefresh} disabled={threadLoading}
            className="text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:-translate-y-px flex items-center gap-1.5"
            style={{ background: T.inset, color: T.inkSoft, border: `1px solid ${T.border}` }}>
            {threadLoading ? <><Spinner size={12} /> Loading…</> : <><Icon name="refresh" size={12} /> Refresh</>}
          </button>
        </div>
      </div>

      {/* Original inquiry card */}
      <Panel>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <span className="inline-flex items-center gap-1.5" style={{ color: T.inkFaint }}>
              <Icon name="film" size={12} />
              <MonoLabel>Contact form submission</MonoLabel>
            </span>
            <p className="text-[11px] flex-shrink-0" style={{ color: T.inkFaint, fontFamily: T.mono }}>
              {new Date(inquiry.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.inkSoft }}>{inquiry.message}</p>
          <div className="flex flex-wrap gap-1.5 mt-4 pt-3" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
            <button onClick={() => onCopyField(inquiry.email, "Email-header")}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors"
              style={copiedField === "Email-header"
                ? { background: T.greenBg, color: T.green }
                : { background: T.violetBg, color: T.violet }}
              title="Click to copy">
              <Icon name={copiedField === "Email-header" ? "check" : "mail"} size={11} />
              {copiedField === "Email-header" ? "Copied" : inquiry.email}
            </button>
            {[
              inquiry.phone          && { icon: "phone"     as IconName, text: inquiry.phone },
              inquiry.instagram      && { icon: "instagram" as IconName, text: `@${inquiry.instagram.replace(/^@/, "")}` },
              inquiry.session_type   && { icon: "sparkle"   as IconName, text: inquiry.session_type },
              inquiry.school         && { icon: "cap"       as IconName, text: inquiry.school },
              inquiry.people         && { icon: "users"     as IconName, text: inquiry.people },
              inquiry.date_in_mind   && { icon: "calendar"  as IconName, text: inquiry.date_in_mind },
              inquiry.preferred_time && { icon: "clock"     as IconName, text: fmt12h(inquiry.preferred_time) },
              inquiry.location       && { icon: "pin"       as IconName, text: inquiry.location },
            ].filter(Boolean).map((chip, i) => {
              const c = chip as { icon: IconName; text: string };
              return (
                <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md"
                  style={{ background: T.inset, color: T.inkSoft }}>
                  <Icon name={c.icon} size={11} style={{ color: T.inkFaint }} /> {c.text}
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
            style={{ borderColor: T.action, borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: T.inkFaint }}>Loading Gmail conversation…</p>
        </Panel>
      ) : messages.length === 0 ? (
        <Panel className="p-10 text-center">
          <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: T.inset, color: T.inkFaint }}>
            <Icon name="mail" size={18} />
          </div>
          <p className="text-sm font-semibold" style={{ color: T.inkSoft }}>No emails found yet</p>
          <p className="text-xs mt-1" style={{ color: T.inkFaint }}>Emails to/from {inquiry.email} will appear here</p>
        </Panel>
      ) : (
        <>
          {renderMsg(messages[0])}

          {hidden.length > 0 && (
            <button
              onClick={() => onThreadExpanded(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-dashed text-xs font-bold transition-all hover:opacity-80"
              style={{ borderColor: T.amberBorder, color: T.action, background: T.amberBg }}>
              <span style={{ background: "rgba(232,160,76,0.2)", borderRadius: "999px", padding: "1px 8px" }}>{hidden.length}</span>
              more {hidden.length === 1 ? "message" : "messages"} — tap to expand
            </button>
          )}

          {threadExpanded && middleMessages.map(msg => renderMsg(msg))}

          {threadExpanded && middleMessages.length > 0 && (
            <button
              onClick={() => onThreadExpanded(false)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold transition-all hover:opacity-80"
              style={{ color: T.inkFaint }}>
              <Icon name="chevron" size={13} className="rotate-180" /> Collapse thread
            </button>
          )}

          {messages.length > 1 && renderMsg(messages[messages.length - 1])}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
