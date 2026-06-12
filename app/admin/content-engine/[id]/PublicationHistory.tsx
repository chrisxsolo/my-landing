"use client";
// Section 5 — Publication history (spec §7.4): permanent across packages, with
// live link, Revalidate (site-wide cache invalidation — targeted Step-C runs
// at publish; this is the recovery affordance), and per-item Takedown.
import { useState } from "react";
import { C } from "@/lib/colors";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { CONTENT_TYPE_LABELS, type EngineItem } from "@/app/admin/content-engine/engineTypes";
import { pathsForPublishedItem } from "@/lib/contentEngine/publishRevalidation";
import { btn, card, sectionTitle } from "./ui";

interface Props {
  published: EngineItem[];
  onChanged: () => void;
  viewCounts: Record<string, number>;
}

export default function PublicationHistory({ published, onChanged, viewCounts }: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (published.length === 0) return null;

  const takedown = async (item: EngineItem) => {
    if (!confirm(`Take down this ${CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}? The live record is removed or deactivated; history is preserved.`)) return;
    setBusy(item.id);
    setNotice(null);
    try {
      await engineApi.takedown(item.id);
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "takedown failed");
    } finally {
      setBusy(null);
    }
  };

  const revalidate = async () => {
    setBusy("revalidate");
    try {
      await engineApi.revalidateAll();
      setNotice("Caches revalidated.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "revalidation failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={sectionTitle}>Publication history ({published.length})</h2>
        <button style={btn(false)} disabled={busy !== null} onClick={() => void revalidate()}>
          {busy === "revalidate" ? "Revalidating…" : "Revalidate"}
        </button>
      </div>
      {notice && (
        <p style={{ fontSize: 13, color: notice === "Caches revalidated." ? C.muted : C.danger }}>{notice}</p>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        {published.map((item) => {
          const takenDown = Boolean(item.published_ref?.taken_down_at);
          const livePath = pathsForPublishedItem(item.content_type, item.payload)[
            item.content_type === "journal_post" ? 1 : 0
          ];
          return (
            <div key={item.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 13, opacity: takenDown ? 0.55 : 1,
            }}>
              <span>
                {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
                {" · "}{item.published_at ? new Date(item.published_at).toLocaleDateString() : ""}
                {viewCounts[item.id] !== undefined && <> · {viewCounts[item.id]} views</>}
                {takenDown && " · taken down"}
                {livePath && !takenDown && (
                  <> · <a href={livePath} target="_blank" rel="noreferrer" style={{ color: C.ink }}>{livePath}</a></>
                )}
              </span>
              {!takenDown && item.published_target_type !== "none" && (
                <button style={btn(false, true)} disabled={busy !== null} onClick={() => void takedown(item)}>
                  {busy === item.id ? "Removing…" : "Take down"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
