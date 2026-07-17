"use client";
// Section 3 — Generation (spec §7.4): pre-generation summary, per-type
// progress, parallel generation of independent types with the journal post
// LAST (it consumes the link + testimonial drafts — Plan 3 contract), Skip
// failed type, and Regenerate (archive + new package, optional
// preserve-approvals copy-forward per §8.4).
import { useCallback, useMemo, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { guideTypeForService, isSchoolSlug, SPOT_SCHOOL_IDS } from "@/lib/contentEngine/taxonomy";
import {
  GENERATION_ORDER, CONTENT_TYPE_LABELS,
  type EngineItem, type EnginePackage, type EnginePhoto,
} from "@/app/admin/content-engine/engineTypes";
import { btn, card, chip, sectionTitle } from "./ui";

interface Props {
  sessionId: string;
  session: Record<string, unknown>;
  activePackage: EnginePackage | null;
  items: EngineItem[];
  photos: EnginePhoto[];
  aiAllowed: boolean;
  onChanged: () => void;
}

// The grad guide is the campus-spots page: placements key off the school (not
// primary_location), and only campuses in SPOT_SCHOOL_IDS have spots. Mirrors
// the skip conditions in gradSpotTarget.
function gradGuideStatusNote(
  status: string, snapshot: EnginePackage["session_facts_snapshot"],
): string | null {
  const school = typeof snapshot?.school_slug === "string" ? snapshot.school_slug : null;
  if (!school) {
    return "Set a school in Session facts, then Regenerate to place photos in the campus spots guide.";
  }
  if (!isSchoolSlug(school) || !SPOT_SCHOOL_IDS[school]) {
    return `The campus spots guide doesn't cover ${school} yet.`;
  }
  if (status === "skipped") {
    return "This package predates campus spot placements — Regenerate to include them.";
  }
  return "Campus spot placements ready to generate (each pick replaces that spot's current photo).";
}

// Generation reads the package SNAPSHOT, not the live session row, so guide
// messaging compares the two: a couples session whose package predates the
// service-type fix must Regenerate (the snapshot is what skipped, not the
// session). Mirrors the skip conditions in generationTargets.ts.
function guideStatusNote(
  status: string, serviceType: string, snapshot: EnginePackage["session_facts_snapshot"],
): string | null {
  const currentGuide = guideTypeForService(serviceType);
  const snapshotGuide = guideTypeForService(snapshot?.service_type);
  if (!currentGuide && !snapshotGuide) {
    return status === "skipped" ? "No guide page is configured for this session type yet." : null;
  }
  if (currentGuide && !snapshotGuide) {
    return `This package was created while the session type was "${snapshot?.service_type || "unset"}" — ` +
      `Regenerate to include the ${currentGuide} guide step.`;
  }
  const guide = snapshotGuide ?? currentGuide!;
  if (guide === "grad") return gradGuideStatusNote(status, snapshot);
  if (!snapshot?.primary_location?.trim()) {
    return status === "skipped"
      ? `Add a location in Session facts, then Regenerate to generate a ${guide} guide entry.`
      : `Add a location before generating a ${guide} guide entry (set it in Session facts, then Regenerate).`;
  }
  if (status === "skipped") {
    return `No ${guide} guide location matched this session, so there was nothing to place.`;
  }
  const label = guide === "couples" ? "Couples" : guide === "portrait" ? "Portrait" : "Family";
  return `${label} guide entry ready to generate.`;
}

// Explains skipped/pending chips so they aren't a mystery. Facts live in the
// package SNAPSHOT, so most remedies are set-then-Regenerate.
function statusNote(
  type: string, status: string, serviceType: string, schoolSlug: string | null,
  snapshot: EnginePackage["session_facts_snapshot"],
): string | null {
  if (type === "guide_photo") return guideStatusNote(status, serviceType, snapshot);
  if (status !== "skipped") return null;
  if (type === "school_page_photo" && !schoolSlug) {
    return "No school set on this session. Choose a school in Session facts above, then Regenerate to include school-page photos.";
  }
  if (type === "testimonial_feature") {
    return "No approved testimonial matched this client (matched by email), so there's nothing to feature.";
  }
  return null;
}

export default function GenerationSection({
  sessionId, session, activePackage, items, photos, aiAllowed, onChanged,
}: Props) {
  const [busyTypes, setBusyTypes] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [preserveApprovals, setPreserveApprovals] = useState(true);

  const serviceType = typeof session.service_type === "string" ? session.service_type : "";
  const schoolSlug = typeof session.school_slug === "string" ? session.school_slug : null;
  const analyzedCount = photos.filter((p) => !p.excluded && p.analysis_status === "completed").length;
  const progress = useMemo(
    () => activePackage?.generation_settings.progress ?? {},
    [activePackage],
  );
  const selected = activePackage?.generation_settings.selected_types ?? [];

  const createPackage = useCallback(async (archive: boolean) => {
    setNotice(null);
    try {
      const copyItems = archive && preserveApprovals
        ? items.filter((i) => i.status === "approved" && !i.published_target_id)
            .map((i) => ({ item_id: i.id, preserve_approval: true }))
        : [];
      await engineApi.createPackage(sessionId, [...GENERATION_ORDER], { archiveCurrent: archive, copyItems });
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "could not create package");
    }
  }, [sessionId, items, preserveApprovals, onChanged]);

  // Runs the given types concurrently (backend claims are atomic per type) and
  // returns per-type error messages. Each type clears its own busy flag and
  // refreshes as it finishes, so results stream in as they complete.
  const generateBatch = useCallback(async (types: string[]): Promise<string[]> => {
    if (!activePackage || types.length === 0) return [];
    setBusyTypes((prev) => new Set([...prev, ...types]));
    const results = await Promise.all(types.map(async (type) => {
      try {
        const result = await engineApi.generateType(activePackage.id, type);
        return result.outcome === "failed" ? `${CONTENT_TYPE_LABELS[type]}: ${result.error ?? "failed"}` : null;
      } catch (err) {
        return `${CONTENT_TYPE_LABELS[type]}: ${err instanceof Error ? err.message : "generation failed"}`;
      } finally {
        setBusyTypes((prev) => {
          const next = new Set(prev);
          next.delete(type);
          return next;
        });
        onChanged();
      }
    }));
    return results.filter((r): r is string => r !== null);
  }, [activePackage, onChanged]);

  const generateOne = useCallback(async (contentType: string) => {
    setNotice(null);
    const errors = await generateBatch([contentType]);
    if (errors.length > 0) setNotice(errors.join(" · "));
  }, [generateBatch]);

  const generateAll = useCallback(async () => {
    if (!activePackage) return;
    setNotice(null);
    const remaining = GENERATION_ORDER.filter((type) => {
      const entry = progress[type];
      return !!entry && entry.status !== "completed" && entry.status !== "skipped" && !busyTypes.has(type);
    });
    // journal_post consumes the link + testimonial drafts, so it waits for the
    // parallel wave; everything else is independent and runs concurrently
    const errors = await generateBatch(remaining.filter((t) => t !== "journal_post"));
    if (remaining.includes("journal_post")) {
      errors.push(...await generateBatch(["journal_post"]));
    }
    if (errors.length > 0) setNotice(`${errors.join(" · ")} — retry or skip below`);
  }, [activePackage, progress, busyTypes, generateBatch]);

  const skip = useCallback(async (contentType: string) => {
    if (!activePackage) return;
    try {
      await engineApi.skipType(activePackage.id, contentType);
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "skip failed");
    }
  }, [activePackage, onChanged]);

  if (!aiAllowed) {
    return (
      <section style={card}>
        <h2 style={sectionTitle}>Generation</h2>
        <p style={{ color: T.inkSoft, fontSize: 13 }}>
          Generation is disabled until AI processing is confirmed in Permissions.
        </p>
      </section>
    );
  }

  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={sectionTitle}>
          Generation{activePackage ? ` — package #${activePackage.generation_number} (${activePackage.status})` : ""}
        </h2>
        {activePackage ? (
          <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
            <label style={{ color: T.inkSoft }}>
              <input type="checkbox" checked={preserveApprovals}
                onChange={(e) => setPreserveApprovals(e.target.checked)} /> preserve approvals
            </label>
            <button style={btn(false)} onClick={() => {
              if (confirm("Archive the current package and start a new generation run?")) void createPackage(true);
            }}>Regenerate ▾</button>
          </span>
        ) : (
          <button style={btn(true)} disabled={analyzedCount === 0}
            title={analyzedCount === 0 ? "Analyze photos first" : undefined}
            onClick={() => void createPackage(false)}>
            Generate content package
          </button>
        )}
      </div>
      <p style={{ fontSize: 13, color: T.inkSoft, margin: "4px 0 10px" }}>
        Inputs: {analyzedCount} analyzed photos. Independent types generate in parallel;
        the journal post runs last because it uses the link and testimonial drafts.
      </p>
      {notice && <p style={{ fontSize: 13, color: T.red }}>{notice}</p>}

      {activePackage && (
        <>
          <div style={{ display: "grid", gap: 6 }}>
            {GENERATION_ORDER.filter((t) => selected.includes(t)).map((type) => {
              const entry = progress[type];
              const status = entry?.status ?? "pending";
              const color = status === "failed" ? T.red : status === "completed" ? T.ink : T.inkSoft;
              const reason = status === "skipped" || status === "pending"
                ? statusNote(type, status, serviceType, schoolSlug, activePackage.session_facts_snapshot)
                : null;
              return (
                <div key={type} style={{ display: "grid", gap: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                    <span>{CONTENT_TYPE_LABELS[type]}</span>
                    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {entry?.usage && (
                        <span style={{ color: T.inkSoft, fontSize: 11 }}>
                          {entry.usage.input_tokens + entry.usage.output_tokens} tok
                        </span>
                      )}
                      <span style={chip(color, T.inset)} title={entry?.error ?? undefined}>{status}</span>
                      {(status === "pending" || status === "failed") && (
                        <button style={btn(false)} disabled={busyTypes.has(type)}
                          onClick={() => void generateOne(type)}>
                          {busyTypes.has(type) ? "Generating…" : status === "failed" ? "Retry" : "Generate"}
                        </button>
                      )}
                      {status === "failed" && (
                        <button style={btn(false)} onClick={() => void skip(type)}>Skip</button>
                      )}
                    </span>
                  </div>
                  {reason && <span style={{ fontSize: 11, color: T.inkSoft, lineHeight: 1.4 }}>{reason}</span>}
                </div>
              );
            })}
          </div>
          {activePackage.status === "generating" && (
            <button style={{ ...btn(true), marginTop: 10 }} disabled={busyTypes.size > 0}
              onClick={() => void generateAll()}>
              {busyTypes.size > 0
                ? `Generating ${[...busyTypes].map((t) => CONTENT_TYPE_LABELS[t] ?? t).join(", ")}…`
                : "Generate all remaining"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
