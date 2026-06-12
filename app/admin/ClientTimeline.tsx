"use client";
import { T } from "@/app/admin/adminTheme";
import { updateAdminInquiry } from "@/lib/adminInquiries";
import { useState } from "react";

export type TimelineInquiry = {
  id: number;
  created_at: string;
  reply_sent_at: string | null;
  invoice_sent_at: string | null;
  contract_sent_at: string | null;
  deposit_paid_at: string | null;
  session_date: string | null;
  gallery_delivered_at: string | null;
  booking_confirmed: boolean | null;
};

type Step = {
  key: keyof TimelineInquiry;
  label: string;
  icon: string;
  dateField: keyof TimelineInquiry | null;
};

const STEPS: Step[] = [
  { key: "created_at",         label: "Inquiry received",  icon: "📬", dateField: "created_at" },
  { key: "reply_sent_at",      label: "Reply sent",        icon: "✉️",  dateField: "reply_sent_at" },
  { key: "invoice_sent_at",    label: "Invoice sent",      icon: "🧾", dateField: "invoice_sent_at" },
  { key: "contract_sent_at",   label: "Contract sent",     icon: "📝", dateField: "contract_sent_at" },
  { key: "deposit_paid_at",    label: "Deposit paid",      icon: "💰", dateField: "deposit_paid_at" },
  { key: "session_date",       label: "Session",           icon: "📸", dateField: "session_date" },
  { key: "gallery_delivered_at", label: "Gallery delivered", icon: "🖼️", dateField: "gallery_delivered_at" },
];

function fmt(val: string | null): string {
  if (!val) return "";
  const d = new Date(val.includes("T") ? val : val + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isDone(inq: TimelineInquiry, step: Step): boolean {
  const val = inq[step.dateField ?? step.key];
  return val !== null && val !== undefined && val !== false;
}

type Props = {
  inq: TimelineInquiry;
  onUpdate: (updated: Partial<TimelineInquiry>) => void;
};

export default function ClientTimeline({ inq, onUpdate }: Props) {
  const [saving, setSaving] = useState<string | null>(null);

  async function toggleStep(step: Step) {
    if (!step.dateField || step.key === "created_at" || step.key === "session_date") return;
    const field = step.dateField as string;
    const alreadyDone = inq[step.dateField] !== null;

    // Marking a step done implies every earlier stage happened too — backfill
    // any unfinished toggleable steps before it in the same save. Un-marking
    // only clears the clicked step.
    const patch: Record<string, string | null> = {};
    if (alreadyDone) {
      patch[field] = null;
    } else {
      const ts = new Date().toISOString();
      const stepIdx = STEPS.findIndex(s => s.key === step.key);
      STEPS.slice(0, stepIdx + 1).forEach(s => {
        if (!s.dateField || s.key === "created_at" || s.key === "session_date") return;
        if (inq[s.dateField] === null) patch[s.dateField as string] = ts;
      });
    }

    setSaving(field);
    try {
      await updateAdminInquiry(inq.id, patch);
      onUpdate(patch as Partial<TimelineInquiry>);
    } catch (error) {
      console.error("[ClientTimeline] update failed:", error);
    } finally {
      setSaving(null);
    }
  }

  const completedCount = STEPS.filter(s => isDone(inq, s)).length;
  const pct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.inset }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? T.green : `linear-gradient(90deg, ${T.green}, ${T.amber})`,
              boxShadow: pct === 100 ? `0 0 8px ${T.green}` : `0 0 8px rgba(232,160,76,0.4)`,
              transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        </div>
        <span className="text-[10px] font-bold flex-shrink-0 tabular-nums" style={{ color: pct === 100 ? T.green : T.inkFaint, fontFamily: T.mono }}>{pct}%</span>
      </div>

      {/* Steps */}
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {STEPS.map((step, i) => {
          const done = isDone(inq, step);
          const isFixed = step.key === "created_at" || step.key === "session_date";
          const isLast = i === STEPS.length - 1;
          const isSaving = saving === step.dateField;
          const dateVal = step.dateField ? inq[step.dateField] as string | null : null;

          return (
            <div key={step.key} className="flex items-start flex-shrink-0">
              <div className="flex flex-col items-center" style={{ minWidth: 64 }}>
                <button
                  onClick={() => toggleStep(step)}
                  disabled={isFixed || isSaving}
                  title={isFixed ? fmt(dateVal) : done ? `Mark as not done` : `Mark as done`}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all duration-200 border-2 hover:scale-110 active:scale-95 disabled:hover:scale-100"
                  style={
                    done
                      ? { background: T.greenBg, borderColor: T.green, color: T.green, boxShadow: `0 0 8px rgba(111,194,150,0.3)` }
                      : { background: T.inset, borderColor: T.borderStrong, color: T.inkFaint, cursor: isFixed ? "default" : "pointer" }
                  }
                >
                  {isSaving ? (
                    <span className="text-[10px] animate-spin">◌</span>
                  ) : done ? (
                    <span className="text-xs">{step.icon}</span>
                  ) : (
                    <span className="text-[10px]" style={{ color: T.inkFaint }}>●</span>
                  )}
                </button>
                <p
                  className="text-[9px] font-bold text-center mt-1 leading-tight"
                  style={{ color: done ? T.green : T.inkFaint, maxWidth: 56 }}
                >
                  {step.label}
                </p>
                {done && dateVal && (
                  <p className="text-[8px] text-center mt-0.5 leading-tight tabular-nums" style={{ color: T.inkFaint, fontFamily: T.mono }}>
                    {fmt(dateVal)}
                  </p>
                )}
              </div>
              {!isLast && (
                <div
                  className="flex-shrink-0 mt-4 w-4 h-0.5 transition-all duration-300"
                  style={{ background: done ? T.green : T.inset }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
