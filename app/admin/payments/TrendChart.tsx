"use client";
// Interactive SVG area chart: current period vs comparison overlay, hover
// crosshair + tooltip, currency axis, peak annotation. No chart library —
// the series are small (≤400 buckets) and the rendering stays predictable.

import { useId, useMemo, useRef, useState } from "react";
import { fmtMoney } from "@/lib/revenue/format";
import type { SeriesPoint } from "@/lib/revenue/series";
import { useReducedMotion } from "./Glass";
import { REV } from "./palette";

const W = 920;
const H = 280;
const PAD = { top: 18, right: 16, bottom: 26, left: 56 };

type Props = {
  points: SeriesPoint[];
  compPoints: SeriesPoint[] | null; // index-aligned with points
  compareLabel: string | null;
  metricLabel: string;
  color?: string;
  summaryForA11y: string;
};

function buildPath(values: number[], xOf: (i: number) => number, yOf: (v: number) => number): string {
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
}

function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.01; v += step) ticks.push(Math.round(v));
  return ticks;
}

export default function TrendChart({ points, compPoints, compareLabel, metricLabel, color = REV.accent, summaryForA11y }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();
  const gradId = useId();

  const { xOf, yOf, ticks, maxVal, peakIdx } = useMemo(() => {
    const maxVal = Math.max(...points.map(p => p.cents), ...(compPoints?.map(p => p.cents) ?? []), 1);
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const n = Math.max(points.length - 1, 1);
    const xOf = (i: number) => PAD.left + (i / n) * innerW;
    const yOf = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;
    let peakIdx = 0;
    points.forEach((p, i) => { if (p.cents > points[peakIdx].cents) peakIdx = i; });
    return { xOf, yOf, ticks: niceTicks(maxVal), maxVal, peakIdx };
  }, [points, compPoints]);

  if (points.length < 2) {
    return <p className="py-12 text-center text-sm font-bold" style={{ color: REV.textFaint }}>Not enough data points in this range to draw a trend.</p>;
  }

  const values = points.map(p => p.cents);
  const linePath = buildPath(values, xOf, yOf);
  const areaPath = `${linePath} L${xOf(points.length - 1).toFixed(1)},${(H - PAD.bottom).toFixed(1)} L${PAD.left},${(H - PAD.bottom).toFixed(1)} Z`;
  const compPath = compPoints && compPoints.length > 1
    ? buildPath(compPoints.map(p => p.cents), i => xOf(Math.min(i, points.length - 1)), yOf)
    : null;

  // x labels: at most ~8, evenly sampled
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const n = points.length - 1;
    const i = Math.round(((x - PAD.left) / (W - PAD.left - PAD.right)) * n);
    setHover(Math.min(n, Math.max(0, i)));
  }

  const h = hover !== null ? points[hover] : null;
  const hc = hover !== null && compPoints ? compPoints[hover] ?? null : null;

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summaryForA11y}
        className="w-full h-auto select-none touch-none"
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* y grid + currency ticks */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yOf(t)} y2={yOf(t)} stroke="rgba(148,163,184,0.1)" strokeDasharray="3 5" />
            <text x={PAD.left - 8} y={yOf(t) + 3} textAnchor="end" fontSize={10} fontWeight={700} fill={REV.textFaint}>
              {fmtMoney(t)}
            </text>
          </g>
        ))}

        {/* comparison series */}
        {compPath && (
          <path d={compPath} fill="none" stroke={REV.neutral} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.65} />
        )}

        {/* current series */}
        <path d={areaPath} fill={`url(#${gradId})`} style={reduced ? undefined : { animation: "rev-fade 0.5s ease both" }} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round"
          pathLength={1200}
          style={reduced ? undefined : { strokeDasharray: 1200, animation: "rev-draw 0.7s cubic-bezier(0.22,1,0.36,1) both" }} />

        {/* peak annotation */}
        {points[peakIdx].cents > 0 && (
          <g>
            <circle cx={xOf(peakIdx)} cy={yOf(points[peakIdx].cents)} r={3.5} fill={color} stroke="#0c1626" strokeWidth={1.5} />
            <text x={xOf(peakIdx)} y={yOf(points[peakIdx].cents) - 8}
              textAnchor={peakIdx > points.length * 0.8 ? "end" : "middle"}
              fontSize={10} fontWeight={800} fill={REV.textSoft}>
              peak {fmtMoney(points[peakIdx].cents)}
            </text>
          </g>
        )}

        {/* x labels */}
        {points.map((p, i) => (
          i % labelEvery === 0 && (
            <text key={p.t} x={xOf(i)} y={H - 8} textAnchor="middle" fontSize={10} fontWeight={700} fill={REV.textFaint}>
              {p.label}
            </text>
          )
        ))}

        {/* crosshair */}
        {hover !== null && h && (
          <g>
            <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="rgba(232,237,246,0.35)" strokeWidth={1} />
            <circle cx={xOf(hover)} cy={yOf(h.cents)} r={4.5} fill={color} stroke="#0c1626" strokeWidth={2} />
            {hc && <circle cx={xOf(hover)} cy={yOf(hc.cents)} r={3.5} fill={REV.neutral} stroke="#0c1626" strokeWidth={1.5} />}
          </g>
        )}

        {/* axis label: max value context */}
        <text x={W - PAD.right} y={12} textAnchor="end" fontSize={9} fontWeight={700} fill={REV.textFaint}>
          {metricLabel} · y-max {fmtMoney(maxVal)}
        </text>
      </svg>

      {/* tooltip */}
      {hover !== null && h && (
        <div className="absolute pointer-events-none z-20 px-3 py-2 rounded-xl"
          style={{
            left: `${(xOf(hover) / W) * 100}%`,
            top: 0,
            transform: `translateX(${hover > points.length * 0.7 ? "-105%" : "8px"})`,
            background: "rgba(8,12,22,0.96)",
            border: `1px solid ${REV.panelBorderStrong}`,
            boxShadow: REV.shadow,
          }}>
          <p className="text-[10px] font-black" style={{ color: REV.textSoft }}>{h.label}</p>
          <p className="text-sm font-black" style={{ color }}>{fmtMoney(h.cents)}</p>
          <p className="text-[10px] font-bold" style={{ color: REV.textFaint }}>
            {h.count} payment{h.count === 1 ? "" : "s"}
          </p>
          {hc && compareLabel && (
            <p className="text-[10px] font-bold mt-0.5" style={{ color: REV.neutral }}>
              {compareLabel}: {fmtMoney(hc.cents)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
