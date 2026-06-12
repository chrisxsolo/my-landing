"use client";
// Booking pipeline rail — derives the client's journey (Inquiry → Replied →
// Date set → Paid) from data already on the inquiry + thread, and surfaces
// the next best action. Pure presentation; no fetches.

import type { GmailMessage } from "@/app/api/gmail/thread/route";
import type { AdminInquiry } from "@/lib/adminInquiries";
import { T, Icon, MonoLabel } from "../ui";
import { countdownLabel } from "./helpers";

type Stage = { label: string; done: boolean };

function buildStages(inquiry: AdminInquiry, messages: GmailMessage[]): Stage[] {
  const replied = inquiry.status === "responded" || messages.some(m => m.isMe);
  return [
    { label: "Inquiry",  done: true },
    { label: "Replied",  done: replied },
    { label: "Date set", done: Boolean(inquiry.session_date) },
    { label: "Paid",     done: inquiry.payment_status === "paid" },
  ];
}

function nextAction(stages: Stage[], inquiry: AdminInquiry): string {
  if (!stages[1].done) return "Send your first reply";
  if (!stages[2].done) return "Lock in the session date";
  if (!stages[3].done) return "Check for payment";
  const date = inquiry.session_date;
  return date ? `Booked & paid — session ${countdownLabel(date).toLowerCase()}` : "All set";
}

export default function PipelineRail({ inquiry, messages }: {
  inquiry: AdminInquiry; messages: GmailMessage[];
}) {
  const stages  = buildStages(inquiry, messages);
  const current = stages.findIndex(s => !s.done);
  const allDone = current === -1;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-2xl overflow-x-auto"
      style={{ background: T.panel, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-0 flex-shrink-0">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center">
            {i > 0 && (
              <div className="w-6 sm:w-10 h-px mx-1"
                style={{ background: s.done ? T.action : T.borderStrong, opacity: s.done ? 0.7 : 0.5 }} />
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={s.done
                  ? { background: T.amberBg, color: T.action, border: `1px solid ${T.amberBorder}` }
                  : i === current
                    ? { background: T.inset, color: T.inkSoft, border: `1px solid ${T.borderStrong}`, animation: "conv-pulse 2.4s ease-in-out infinite" }
                    : { background: T.inset, color: T.inkFaint, border: `1px solid ${T.rowBorder}` }}>
                {s.done ? <Icon name="check" size={10} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />}
              </span>
              <MonoLabel color={s.done ? T.ink : i === current ? T.inkSoft : T.inkFaint}>{s.label}</MonoLabel>
            </div>
          </div>
        ))}
      </div>
      <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
        style={allDone
          ? { background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }
          : { background: T.amberBg, color: T.action, border: `1px solid ${T.amberBorder}` }}>
        <Icon name={allDone ? "check" : "zap"} size={11} />
        {nextAction(stages, inquiry)}
      </span>
    </div>
  );
}
