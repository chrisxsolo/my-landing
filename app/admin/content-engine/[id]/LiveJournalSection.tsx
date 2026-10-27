"use client";
// Shown near the top of the workspace whenever a journal post from this
// session is live: the exact set of images the public page renders, open and
// editable, with a link to the page itself. Publication history further down
// keeps the per-item takedown and the cache controls.
import { T } from "@/app/admin/adminTheme";
import { CONTENT_TYPE_LABELS, type EngineItem, type EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import { pathsForPublishedItem } from "@/lib/contentEngine/publishRevalidation";
import PublishedJournalPhotos from "./PublishedJournalPhotos";
import { card, sectionTitle } from "./ui";

const JOURNAL = "journal_post";

/** Live journal items (published, not taken down) in publication order. */
export function liveJournalItems(published: EngineItem[]): EngineItem[] {
  return published.filter((item) => item.content_type === JOURNAL && !item.published_ref?.taken_down_at);
}

export default function LiveJournalSection({ published, photos, onChanged }: {
  published: EngineItem[]; photos: EnginePhoto[]; onChanged: () => void;
}) {
  const items = liveJournalItems(published);
  if (items.length === 0) return null;
  return (
    <section style={card}>
      <h2 style={sectionTitle}>Published journal — exactly what the page shows</h2>
      <p style={{ fontSize: 12, color: T.inkSoft, margin: "0 0 10px" }}>
        Read from the live post record, not from the draft. The public page is cached for up to an hour; every change here refreshes it.
      </p>
      <div style={{ display: "grid", gap: 14 }}>
        {items.map((item) => {
          const livePath = pathsForPublishedItem(item.content_type, item.payload)[1];
          return (
            <div key={item.id} style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13 }}>
                {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
                {" · "}{item.published_at ? new Date(item.published_at).toLocaleDateString() : ""}
                {livePath && (
                  <> · <a href={livePath} target="_blank" rel="noreferrer" style={{ color: T.ink }}>open the live page ↗</a></>
                )}
              </span>
              <PublishedJournalPhotos item={item} photos={photos} onChanged={onChanged} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
