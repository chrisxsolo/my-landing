"use client";
// "Photo Tagging Health" — a compact summary on the Content Engine dashboard.
// Every number is counted from the live audit of real database rows, and each
// one opens the photo tagging grid with that filter applied.
import { useEffect, useState } from "react";
import Link from "next/link";
import { T } from "@/app/admin/adminTheme";
import { btn, card, sectionTitle } from "@/app/admin/content-engine/[id]/ui";
import type { TagCounts, TagFilter } from "@/lib/photoTagging/types";
import { taggingApi } from "./taggingApi";

const REVIEW_PATH = "/admin/content-engine/photos";

const href = (filter: TagFilter) => `${REVIEW_PATH}?filter=${filter}`;

export default function TaggingHealthCard() {
  const [counts, setCounts] = useState<TagCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    taggingApi.load()
      .then((r) => setCounts(r.counts))
      .catch((err) => {
        console.error("[photo-tagging] health card failed", err);
        setError(err instanceof Error ? err.message : "could not load");
      });
  }, []);

  const stats: { label: string; value: number | undefined; filter: TagFilter; tone: string }[] = [
    { label: "Published photos", value: counts?.published, filter: "all", tone: T.inkSoft },
    { label: "Fully categorized", value: counts?.full, filter: "full", tone: T.green },
    { label: "Missing critical tags", value: counts?.needs, filter: "needs", tone: T.red },
    { label: "Incomplete tags", value: counts?.partial, filter: "partial", tone: T.amber },
    { label: "Grads without university", value: counts?.gradsMissingSchool, filter: "grads-missing-school", tone: T.red },
    { label: "Unresolved location tips", value: counts?.unresolvedLocation, filter: "suggestions", tone: T.blue },
  ];
  const attention = counts ? counts.needs + counts.partial : 0;

  return (
    <section style={{ ...card, display: "grid", gap: 12 }} aria-labelledby="tagging-health-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 id="tagging-health-title" style={{ ...sectionTitle, margin: 0 }}>Photo Tagging Health</h2>
        <Link href={href(counts && counts.needs > 0 ? "needs" : "partial")}
          style={{ ...btn(attention > 0), textDecoration: "none" }}>
          Review Photos Needing Tags{counts ? ` (${attention})` : ""}
        </Link>
      </div>
      {error ? <p style={{ margin: 0, fontSize: 13, color: T.red }}>Tagging status unavailable: {error}</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          {stats.map((s) => (
            <Link key={s.label} href={href(s.filter)} style={{
              textDecoration: "none", padding: "8px 10px", borderRadius: 12, background: T.inset, border: `1px solid ${T.border}`,
            }}>
              <span style={{ display: "block", fontSize: 22, fontWeight: 700, color: s.tone, fontFamily: T.mono }}>
                {s.value ?? "…"}
              </span>
              <span style={{ fontSize: 11, color: T.inkSoft }}>{s.label}</span>
            </Link>
          ))}
        </div>
      )}
      {counts && (
        <p style={{ margin: 0, fontSize: 12, color: T.inkFaint }}>
          {counts.total} photos across Portfolio and the Content Engine · {counts.highConfidence} with a high-confidence tag ready to apply
        </p>
      )}
    </section>
  );
}
