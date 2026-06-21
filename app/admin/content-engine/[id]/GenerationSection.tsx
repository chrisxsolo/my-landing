"use client";
// Section 3 — Generation (spec §7.4): pre-generation summary, per-type
// progress, dependency-ORDERED sequencing (links + testimonial BEFORE journal
// — Plan 3 contract), Skip failed type, and Regenerate (archive + new package,
// optional preserve-approvals copy-forward per §8.4).
import { useCallback, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
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

// Explains a "skipped" type so the bare chip isn't a mystery. The generation
// targets only skip for two reasons (see generationTargets.ts): a guide type
// whose service has no guide page, or a school photo with no school set. Facts
// live in the package SNAPSHOT, so the school remedy is set-then-Regenerate.
function skipReason(type: string, serviceType: string, schoolSlug: string | null): string | null {
  if (type === "guide_photo") {
    return `Guides exist only for couples & families — a ${serviceType || "this"} session has no guide page, so there's nothing to publish here.`;
  }
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
  const [busyType, setBusyType] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preserveApprovals, setPreserveApprovals] = useState(true);

  const serviceType = typeof session.service_type === "string" ? session.service_type : "";
  const schoolSlug = typeof session.school_slug === "string" ? session.school_slug : null;
  const analyzedCount = photos.filter((p) => !p.excluded && p.analysis_status === "completed").length;
  const progress = activePackage?.generation_settings.progress ?? {};
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

  const generateOne = useCallback(async (contentType: string) => {
    if (!activePackage) return;
    setBusyType(contentType);
    setNotice(null);
    try {
      const result = await engineApi.generateType(activePackage.id, contentType);
      if (result.outcome === "failed") setNotice(`${CONTENT_TYPE_LABELS[contentType]}: ${result.error ?? "failed"}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "generation failed");
    } finally {
      setBusyType(null);
      onChanged();
    }
  }, [activePackage, onChanged]);

  const generateAll = useCallback(async () => {
    if (!activePackage) return;
    setNotice(null);
    // dependency order is mandatory: links + testimonial feed the journal
    for (const type of GENERATION_ORDER) {
      const entry = progress[type];
      if (!entry || entry.status === "completed" || entry.status === "skipped") continue;
      setBusyType(type);
      try {
        const result = await engineApi.generateType(activePackage.id, type);
        if (result.outcome === "failed") {
          setNotice(`${CONTENT_TYPE_LABELS[type]}: ${result.error ?? "failed"} — continue or skip below`);
        }
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "generation failed");
        break;
      } finally {
        onChanged();
      }
    }
    setBusyType(null);
    onChanged();
  }, [activePackage, progress, onChanged]);

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
        Inputs: {analyzedCount} analyzed photos. Journal generation uses the link and
        testimonial drafts, so types run in dependency order.
      </p>
      {notice && <p style={{ fontSize: 13, color: T.red }}>{notice}</p>}

      {activePackage && (
        <>
          <div style={{ display: "grid", gap: 6 }}>
            {GENERATION_ORDER.filter((t) => selected.includes(t)).map((type) => {
              const entry = progress[type];
              const status = entry?.status ?? "pending";
              const color = status === "failed" ? T.red : status === "completed" ? T.ink : T.inkSoft;
              const reason = status === "skipped" ? skipReason(type, serviceType, schoolSlug) : null;
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
                        <button style={btn(false)} disabled={busyType !== null}
                          onClick={() => void generateOne(type)}>
                          {busyType === type ? "Generating…" : status === "failed" ? "Retry" : "Generate"}
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
            <button style={{ ...btn(true), marginTop: 10 }} disabled={busyType !== null}
              onClick={() => void generateAll()}>
              {busyType ? `Generating ${CONTENT_TYPE_LABELS[busyType] ?? busyType}…` : "Generate all remaining"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
