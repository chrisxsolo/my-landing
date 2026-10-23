"use client";
// Live analysis progress, shared by the background run bar and the Analyze
// button: completed / in progress / waiting / failed, a segmented bar, the
// elapsed time, and an estimate once the run has a measured pace. Counts come
// straight from the photo rows (polled), so they move as each photo commits.
import { useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import {
  estimateRemainingMs, formatDuration, photoProgressLine, summarizePhotoProgress,
  type PhotoStatusRow,
} from "@/lib/contentEngine/jobProgress";

interface Props {
  statuses: readonly PhotoStatusRow[];
  /** Run marker on the server clock: photos started after it belong to this run. */
  runStartedAt: string | null;
  /** When the admin started the run (epoch ms, server clock). Null hides elapsed time. */
  startedAtMs: number | null;
  /** serverNow − Date.now() from the latest poll, so timings use the server's clock. */
  clockOffsetMs: number;
  live: boolean;
}

export default function AnalysisProgress({ statuses, runStartedAt, startedAtMs, clockOffsetMs, live }: Props) {
  // The local clock lives in state (render must stay pure); it ticks while live.
  const [localNow, setLocalNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setLocalNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);

  const now = localNow + clockOffsetMs;
  const progress = summarizePhotoProgress(statuses, now, runStartedAt);
  if (progress.total === 0) return null;
  const elapsed = startedAtMs !== null ? now - startedAtMs : null;
  const eta = live ? estimateRemainingMs(progress, now) : null;
  const pct = (n: number) => `${(n / progress.total) * 100}%`;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
        <span style={{ color: T.ink }}>{photoProgressLine(progress)}</span>
        {elapsed !== null && (
          <span style={{ color: T.inkSoft, fontFamily: T.mono }}>
            {formatDuration(elapsed)} elapsed{eta !== null ? ` · about ${formatDuration(eta)} left` : ""}
          </span>
        )}
      </div>
      <div style={{
        marginTop: 6, height: 4, borderRadius: 999, background: T.inset, overflow: "hidden", display: "flex",
      }}>
        <div style={{ width: pct(progress.completed), background: T.green, transition: "width 400ms ease" }} />
        <div style={{ width: pct(progress.analyzing), background: T.blue, transition: "width 400ms ease" }} />
        <div style={{ width: pct(progress.failed), background: T.red, transition: "width 400ms ease" }} />
      </div>
    </div>
  );
}
