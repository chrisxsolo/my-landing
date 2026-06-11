"use client";
// Revenue insights: deterministic, reproducible observations. Each card cites
// its metric, analyzed period and baseline, and clicking it filters or jumps
// the dashboard to the supporting records.

import type { Insight } from "@/lib/revenue/insights";
import { EmptyState, GlassPanel, SectionHeader } from "./Glass";
import { REV } from "./palette";

type Props = {
  loading: boolean;
  insights: Insight[];
  onDrill: (insight: Insight) => void;
};

export default function InsightsSection({ loading, insights, onDrill }: Props) {
  return (
    <GlassPanel className="p-5">
      <SectionHeader kicker="Business intelligence" title="Revenue insights" accent={REV.pink}
        right={<span className="text-[10px] font-bold" style={{ color: REV.textFaint }}>computed from the numbers on this page — no AI guesses</span>} />
      {loading ? null : insights.length === 0 ? (
        <EmptyState message="Not enough data in this period for meaningful insights." hint="Widen the date range or clear filters." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map(insight => (
            <button key={insight.id} type="button" onClick={() => onDrill(insight)}
              className="text-left px-4 py-3 rounded-xl transition-all hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              style={{ background: REV.panel, border: `1px solid ${REV.panelBorder}` }}
              title="Show the records behind this insight">
              <p className="text-xs font-bold leading-relaxed" style={{ color: REV.text }}>{insight.text}</p>
              <p className="text-[10px] font-medium mt-1.5" style={{ color: REV.textFaint }}>
                {insight.metric} · {insight.period} · baseline: {insight.baseline} →
              </p>
            </button>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
