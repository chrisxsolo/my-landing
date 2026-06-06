"use client";
import { C } from "@/lib/colors";
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
    const newVal = alreadyDone ? null : new Date().toISOString();

    setSaving(field);
    try {
      await updateAdminInquiry(inq.id, { [field]: newVal });
      onUpdate({ [field]: newVal } as Partial<TimelineInquiry>);
    } catch (error) {
      console.error("[ClientTimeline] update failed:", error);
    } finally {
      setSaving(null);
    }
  }

  const completedCount = STEPS.filter(s => isDone(inq, s)).length;
  const pct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(148,163,184,0.12)" }}>
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(148,163,184,0.15)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct === 100 ? "linear-gradient(90deg,#10b981,#34d399)" : C.grad12 }}
          />
        </div>
        <span className="text-[10px] font-bold text-slate-400 flex-shrink-0">{pct}%</span>
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
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 border-2"
                  style={
                    done
                      ? { background: "#10b981", borderColor: "#10b981", color: "#fff" }
                      : { background: "#fff", borderColor: "rgba(148,163,184,0.3)", color: "rgba(148,163,184,0.6)" }
                  }
                >
                  {isSaving ? (
                    <span className="text-[10px] animate-spin">◌</span>
                  ) : done ? (
                    <span className="text-xs">{step.icon}</span>
                  ) : (
                    <span className="text-[10px] text-slate-300">●</span>
                  )}
                </button>
                <p
                  className="text-[9px] font-bold text-center mt-1 leading-tight"
                  style={{ color: done ? "#059669" : "#94a3b8", maxWidth: 56 }}
                >
                  {step.label}
                </p>
                {done && dateVal && (
                  <p className="text-[8px] text-slate-400 text-center mt-0.5 leading-tight">
                    {fmt(dateVal)}
                  </p>
                )}
              </div>
              {!isLast && (
                <div
                  className="flex-shrink-0 mt-4 w-4 h-0.5 transition-all duration-300"
                  style={{ background: done ? "#10b981" : "rgba(148,163,184,0.2)" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
