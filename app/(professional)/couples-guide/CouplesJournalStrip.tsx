// Async server component: "From the couples journal" related-posts strip, shown on
// the couples hub and location pages. Self-fetches couples-tagged posts and renders
// nothing until at least one exists (no empty section, no fabricated posts). Relies
// on the parent page already injecting COUPLES_GUIDE_CSS (fg-* classes).

import Link from "next/link";
import { getBlogPostSummariesForCategory } from "@/lib/professionalData";
import { COUPLES_JOURNAL_CATEGORY } from "@/lib/couplesGuide/journal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function CouplesJournalStrip({ heading = "From the couples journal" }: { heading?: string }) {
  const posts = (await getBlogPostSummariesForCategory(COUPLES_JOURNAL_CATEGORY)).slice(0, 3);
  if (posts.length === 0) return null;

  return (
    <section className="fg-section">
      <div className="fg-shell">
        <p className="fg-sec-kicker" data-reveal>Journal</p>
        <h2 className="fg-sec-title" data-reveal>{heading}</h2>
        <div className="fg-related">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} data-reveal data-delay="1">
              <span className="fg-related-title">{post.title}</span>
              <span className="fg-related-desc">
                {formatDate(post.published_at)}
                {post.meta_description ? ` — ${post.meta_description}` : ""}
              </span>
            </Link>
          ))}
        </div>
        <p style={{ marginTop: 16 }}>
          <Link href={`/blog/category/${COUPLES_JOURNAL_CATEGORY}`} className="fg-inline-link">
            Read more in the couples photography journal →
          </Link>
        </p>
      </div>
    </section>
  );
}
