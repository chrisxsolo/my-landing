"use client";
// Accounts receivable: estimated open balances with aging buckets. Estimates
// are flagged as such — this panel never blends into collected revenue.

import Link from "next/link";
import { fmtDate, fmtMoney } from "@/lib/revenue/format";
import { AGING_META, type AgingBucket, type Receivable } from "@/lib/revenue/receivables";
import { EmptyState, GlassPanel, InfoTip, SectionHeader, Skeleton } from "./Glass";
import { REV } from "./palette";

const BUCKET_COLORS: Record<AgingBucket, { color: string; bg: string }> = {
  due30plus: { color: REV.red, bg: REV.redBg },
  due8to30: { color: REV.orange, bg: REV.orangeBg },
  due1to7: { color: REV.amber, bg: REV.amberBg },
  notDue: { color: REV.blue, bg: REV.blueBg },
  unknown: { color: REV.neutral, bg: REV.neutralBg },
};

type Props = {
  loading: boolean;
  receivables: Receivable[];
};

export default function ReceivablesPanel({ loading, receivables }: Props) {
  const total = receivables.reduce((s, r) => s + r.outstandingCents, 0);
  const buckets = (Object.keys(AGING_META) as AgingBucket[])
    .map(b => ({
      bucket: b,
      items: receivables.filter(r => r.bucket === b),
    }))
    .filter(g => g.items.length)
    .sort((a, b) => AGING_META[a.bucket].order - AGING_META[b.bucket].order);

  return (
    <GlassPanel className="p-5">
      <SectionHeader kicker="Accounts receivable" title="Outstanding balances" accent={REV.amber}
        right={
          <span className="inline-flex items-center gap-1.5 text-sm font-black" style={{ color: total > 0 ? REV.amber : REV.textFaint }}>
            ~{fmtMoney(total)} open
            <InfoTip text="Estimated per booking: inferred session total (explicit quote → deposit pair → retainer-based estimate → pricing catalog) minus collected payments. The ~ marks estimates; these amounts are never counted as collected revenue." />
          </span>
        } />
      {loading ? <Skeleton className="h-32 w-full" /> : receivables.length === 0 ? (
        <EmptyState message="Nothing outstanding 🎉" hint="Every booking with payments on record is fully collected, per inferred totals." />
      ) : (
        <div className="space-y-4">
          {buckets.map(({ bucket, items }) => {
            const meta = BUCKET_COLORS[bucket];
            return (
              <div key={bucket}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-2 inline-flex items-center gap-2 px-2 py-1 rounded-md"
                  style={{ background: meta.bg, color: meta.color }}>
                  {AGING_META[bucket].label} · {items.length} · {fmtMoney(items.reduce((s, r) => s + r.outstandingCents, 0))}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[560px]">
                    <tbody>
                      {items.map(r => (
                        <tr key={r.inquiryId} style={{ borderBottom: `1px solid ${REV.rowBorder}` }}>
                          <td className="py-2 pr-3">
                            <span className="text-xs font-black" style={{ color: REV.text }}>{r.clientName}</span>
                            <span className="block text-[10px] font-medium" style={{ color: REV.textFaint }}>{r.serviceType ?? "service unknown"}</span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="text-[10px] font-bold block" style={{ color: REV.textFaint }}>session value</span>
                            <span className="text-xs font-bold" style={{ color: REV.textSoft }}>
                              {r.totalIsEstimate ? "~" : ""}{fmtMoney(r.totalCents)}{r.totalIsEstimate ? " est." : ""}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="text-[10px] font-bold block" style={{ color: REV.textFaint }}>paid</span>
                            <span className="text-xs font-bold" style={{ color: REV.accent }}>{fmtMoney(r.paidCents)}</span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="text-[10px] font-bold block" style={{ color: REV.textFaint }}>remaining</span>
                            <span className="text-xs font-black" style={{ color: meta.color }}>~{fmtMoney(r.outstandingCents)}</span>
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <span className="text-[10px] font-bold block" style={{ color: REV.textFaint }}>session date</span>
                            <span className="text-xs font-bold" style={{ color: REV.textSoft }}>
                              {fmtDate(r.sessionDate)}
                              {r.daysOutstanding != null && r.daysOutstanding > 0 && ` · ${r.daysOutstanding}d ago`}
                            </span>
                          </td>
                          <td className="py-2 pl-3 text-right">
                            <Link href={`/admin/conversation/${r.inquiryId}`} target="_blank"
                              className="text-[10px] font-black px-2.5 py-1 rounded-lg whitespace-nowrap inline-block"
                              style={{ background: REV.violetBg, color: REV.violet }}
                              title="Open the client conversation to follow up">
                              Follow up ↗
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassPanel>
  );
}
