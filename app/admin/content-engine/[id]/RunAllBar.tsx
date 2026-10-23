"use client";
// One-click run: everything between "photos are in" and "drafts ready to
// review" — save facts → analyze → curate (big shoots) → create the package →
// generate every content type. Each underlying route is the same one the
// per-step buttons call and every claim is atomic, so pressing this again after
// a failure resumes instead of duplicating work.
import { useCallback, useMemo, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { AUTO_CURATE_THRESHOLD, TOP_PICK_COUNT } from "@/lib/contentEngine/curationConfig";
import {
  runFullPipeline, pendingAnalysisCount, pendingGenerationTypes, includedCount,
  type PipelineProgress,
} from "@/app/admin/content-engine/pipeline";
import type { EnginePackage, EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import { btn, card } from "./ui";

interface Props {
  sessionId: string;
  photos: EnginePhoto[];
  activePackage: EnginePackage | null;
  aiAllowed: boolean;
  flushFacts: () => Promise<void>;
  onChanged: () => void;
}

export default function RunAllBar({
  sessionId, photos, activePackage, aiAllowed, flushFacts, onChanged,
}: Props) {
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const plan = useMemo(() => {
    const pendingPhotos = pendingAnalysisCount(photos);
    const included = includedCount(photos);
    const pendingTypes = pendingGenerationTypes(activePackage);
    const steps: string[] = [];
    if (pendingPhotos > 0) steps.push(`analyze ${pendingPhotos} photo(s)`);
    if (included >= AUTO_CURATE_THRESHOLD) steps.push(`keep the best ${TOP_PICK_COUNT}`);
    if (!activePackage) steps.push("create the content package");
    if (!activePackage) steps.push("generate every content type");
    else if (pendingTypes.length > 0) steps.push(`generate ${pendingTypes.length} remaining type(s)`);
    return {
      included,
      steps,
      hasWork: included > 0 && steps.length > 0,
      resuming: activePackage !== null,
    };
  }, [photos, activePackage]);

  const run = useCallback(async () => {
    setRunning(true);
    setErrors([]);
    setProgress({ stage: "saving", detail: "Starting…" });
    try {
      const result = await runFullPipeline({
        sessionId, photos, activePackage, flushFacts,
        onProgress: setProgress,
        onChanged,
      });
      setErrors(result.errors);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "run failed"]);
    } finally {
      setRunning(false);
      setProgress(null);
      onChanged();
    }
  }, [sessionId, photos, activePackage, flushFacts, onChanged]);

  if (!aiAllowed) return null;

  if (photos.length === 0) {
    return (
      <section style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, color: T.inkSoft }}>
          Drop this session&rsquo;s edited photos below (a whole folder works) — then one
          click analyzes them, writes the journal post and every placement, and leaves
          drafts waiting for your review.
        </span>
      </section>
    );
  }

  if (!plan.hasWork && !running && errors.length === 0) return null;

  return (
    <section style={{ ...card, borderColor: running ? T.blueBorder : T.borderStrong }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.18em",
            textTransform: "uppercase", color: T.action, fontFamily: T.mono,
          }}>
            {running ? "Running" : plan.resuming ? "Resume" : "One click"}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkSoft }}>
            {running && progress
              ? progress.detail
              : plan.hasWork
                ? `Will ${plan.steps.join(", then ")}. Nothing publishes without your approval.`
                : "Nothing left to run for this session."}
          </p>
        </div>
        {plan.hasWork && (
          <button style={{ ...btn(true), padding: "9px 18px", fontSize: 14 }}
            disabled={running} onClick={() => void run()}>
            {running ? "Working…" : plan.resuming ? "Run what's left" : "Generate everything"}
          </button>
        )}
      </div>
      {errors.length > 0 && (
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: T.red }}>
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
    </section>
  );
}
