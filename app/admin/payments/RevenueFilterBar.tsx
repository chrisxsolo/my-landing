"use client";
// Sticky control bar: date preset + custom range, comparison mode, dimension
// filters, search, reset, CSV export, refresh and last-reconciled timestamp.

import { fmtDate } from "@/lib/revenue/format";
import { SERVICE_LABELS, type ServiceKey } from "@/lib/revenue/enrich";
import { SCHOOL_DEFS, SCHOOL_OTHER, SCHOOL_UNLINKED } from "@/lib/revenue/schools";
import { COMPARE_MODES, DATE_PRESETS } from "@/lib/revenue/periods";
import { METHOD_META, REV } from "./palette";
import { DEFAULT_REVENUE_FILTERS, hasActiveDimensionFilters, type RevenueFilters } from "./state";

const fieldStyle = {
  background: REV.inset,
  border: `1px solid ${REV.panelBorder}`,
  color: REV.text,
} as const;

const fieldClass =
  "text-xs font-bold px-2.5 py-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400";

type Props = {
  filters: RevenueFilters;
  onChange: (patch: Partial<RevenueFilters>) => void;
  periodLabel: string;
  lastReconciledAt: string | null;
  loading: boolean;
  onRefresh: () => void;
  onExport: () => void;
  exportCount: number;
};

export default function RevenueFilterBar({
  filters, onChange, periodLabel, lastReconciledAt, loading, onRefresh, onExport, exportCount,
}: Props) {
  const select = (
    label: string,
    value: string,
    onSel: (v: string) => void,
    options: [string, string][],
  ) => (
    <label className="inline-flex items-center gap-1">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={e => onSel(e.target.value)} className={fieldClass} style={fieldStyle}>
        {options.map(([v, l]) => <option key={v} value={v} style={{ background: "#0c1626" }}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <div className="sticky top-2 z-40 rounded-2xl backdrop-blur-xl px-3 py-2.5"
      style={{ background: "rgba(10,16,30,0.88)", border: `1px solid ${REV.panelBorderStrong}`, boxShadow: REV.shadow }}>
      <div className="flex items-center gap-2 flex-wrap">
        {select("Date range", filters.preset, v => onChange({ preset: v as RevenueFilters["preset"] }),
          DATE_PRESETS.map(p => [p.value, p.label]))}
        {filters.preset === "custom" && (
          <span className="inline-flex items-center gap-1">
            <input type="date" aria-label="Custom range start" value={filters.customStart}
              onChange={e => onChange({ customStart: e.target.value })} className={fieldClass} style={fieldStyle} />
            <span className="text-xs" style={{ color: REV.textFaint }}>→</span>
            <input type="date" aria-label="Custom range end" value={filters.customEnd}
              onChange={e => onChange({ customEnd: e.target.value })} className={fieldClass} style={fieldStyle} />
          </span>
        )}
        {select("Comparison period", filters.compare, v => onChange({ compare: v as RevenueFilters["compare"] }),
          COMPARE_MODES.map(m => [m.value, m.label]))}
        {select("Service filter", filters.service, v => onChange({ service: v }), [
          ["", "All services"],
          ...(Object.entries(SERVICE_LABELS) as [ServiceKey, string][]).map(([k, l]) => [k, l] as [string, string]),
        ])}
        {select("School filter", filters.school, v => onChange({ school: v }), [
          ["", "All schools"],
          ...SCHOOL_DEFS.map(s => [s.key, s.label] as [string, string]),
          [SCHOOL_OTHER.key, SCHOOL_OTHER.label],
          [SCHOOL_UNLINKED.key, SCHOOL_UNLINKED.label],
        ])}
        {select("Payment platform filter", filters.method, v => onChange({ method: v }),
          [["", "All platforms"], ...Object.keys(METHOD_META).map(m => [m, METHOD_META[m].label] as [string, string])])}
        {select("Payment status filter", filters.status, v => onChange({ status: v }),
          [["", "All statuses"], ["active", "Active"], ["refunded", "Refunded"], ["voided", "Voided"]])}
        <input type="search" placeholder="Search client, invoice, note…" aria-label="Search payments"
          value={filters.search} onChange={e => onChange({ search: e.target.value })}
          className={`${fieldClass} flex-1 min-w-[150px] placeholder:text-slate-500`} style={fieldStyle} />
        {(hasActiveDimensionFilters(filters) || filters.preset !== DEFAULT_REVENUE_FILTERS.preset) && (
          <button type="button" onClick={() => onChange({ ...DEFAULT_REVENUE_FILTERS })}
            className="text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: REV.redBg, color: REV.red }}>
            ✕ Reset
          </button>
        )}
        <button type="button" onClick={onExport} disabled={!exportCount}
          className="text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: REV.accentBg, color: REV.accent }}>
          ⬇ CSV ({exportCount})
        </button>
        <button type="button" onClick={onRefresh} disabled={loading}
          className="text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: REV.violetBg, color: REV.violet }}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        <p className="text-[10px] font-bold" style={{ color: REV.textSoft }}>
          Showing <span style={{ color: REV.accent }}>{periodLabel}</span>
        </p>
        {lastReconciledAt && (
          <p className="text-[10px] font-medium" style={{ color: REV.textFaint }}>
            Ledger last reconciled {fmtDate(lastReconciledAt)}
          </p>
        )}
      </div>
    </div>
  );
}
