"use client";
// Client contact card — avatar, status, tap-to-copy contact chips and
// EXIF-style detail rows. Pure presentation.

import type { ReactNode } from "react";
import type { AdminInquiry } from "@/lib/adminInquiries";
import { T, CONV, STATUS_META, Icon, type IconName, Panel, MonoLabel } from "../ui";
import { fmt12h, countdownLabel } from "./helpers";

type Props = {
  inquiry: AdminInquiry;
  status: string;
  copiedField: string | null;
  onCopyField: (text: string, label: string) => void;
};

export default function ContactCard({ inquiry, status, copiedField, onCopyField }: Props) {
  const statusMeta = STATUS_META[status] ?? STATUS_META.archived;
  const initials = inquiry.name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";

  const rows = [
    inquiry.school         && { icon: "cap"      as IconName, label: "School",   value: inquiry.school },
    inquiry.people         && { icon: "users"    as IconName, label: "People",   value: inquiry.people },
    inquiry.date_in_mind   && { icon: "calendar" as IconName, label: "Date",     value: inquiry.date_in_mind },
    inquiry.preferred_time && { icon: "clock"    as IconName, label: "Time",     value: fmt12h(inquiry.preferred_time) },
    inquiry.location       && { icon: "pin"      as IconName, label: "Location", value: inquiry.location },
  ].filter(Boolean) as { icon: IconName; label: string; value: ReactNode }[];

  return (
    <Panel>
      <div className="p-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black flex-shrink-0"
            style={{ background: CONV.gradClient, color: "#fff", boxShadow: "0 6px 16px rgba(122,100,184,0.35)" }}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[19px] font-semibold leading-tight truncate" style={{ color: T.ink, fontFamily: T.display }}>{inquiry.name}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {inquiry.session_type && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: T.violetBg, color: T.violet }}>
                  {inquiry.session_type}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: statusMeta.bg, color: statusMeta.color }}>
                <span className="w-1 h-1 rounded-full" style={{ background: statusMeta.dot }} />
                {statusMeta.label}
              </span>
              {inquiry.session_date && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: T.amberBg, color: T.action }}>
                  {countdownLabel(inquiry.session_date)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tap-to-copy contact chips */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          <button onClick={() => onCopyField(inquiry.email, "Email")}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors max-w-full"
            style={copiedField === "Email"
              ? { background: T.greenBg, color: T.green }
              : { background: T.violetBg, color: T.violet }}
            title="Click to copy">
            <Icon name={copiedField === "Email" ? "check" : "mail"} size={12} />
            <span className="truncate">{copiedField === "Email" ? "Copied" : inquiry.email}</span>
          </button>
          {inquiry.phone && (
            <button onClick={() => onCopyField(inquiry.phone!, "Phone")}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
              style={copiedField === "Phone"
                ? { background: T.greenBg, color: T.green }
                : { background: T.inset, color: T.inkSoft }}
              title="Click to copy">
              <Icon name={copiedField === "Phone" ? "check" : "phone"} size={12} />
              {copiedField === "Phone" ? "Copied" : inquiry.phone}
            </button>
          )}
          {inquiry.instagram && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
              style={{ background: T.inset, color: T.inkSoft }}>
              <Icon name="instagram" size={12} /> @{inquiry.instagram.replace(/^@/, "")}
            </span>
          )}
        </div>

        {/* EXIF-style detail rows */}
        {(rows.length > 0 || inquiry.session_date) && (
          <div className="mt-4">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
                <Icon name={r.icon} size={13} style={{ color: T.inkFaint }} />
                <MonoLabel className="w-16 flex-shrink-0">{r.label}</MonoLabel>
                <span className="text-[13px] font-medium min-w-0" style={{ color: T.inkSoft }}>{r.value}</span>
              </div>
            ))}
            {inquiry.session_date && (
              <div className="flex items-center gap-2.5 py-2" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
                <Icon name="check" size={13} style={{ color: T.green }} />
                <MonoLabel color={T.green} className="w-16 flex-shrink-0">Booked</MonoLabel>
                <span className="text-[13px] font-bold" style={{ color: T.green }}>
                  {new Date(inquiry.session_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
