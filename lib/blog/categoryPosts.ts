// Posts for a curated journal archive (/blog/category/<slug>): posts explicitly
// tagged with the category, plus — when the category names a `service` — journal
// posts whose title/slug reads as that service. Newest first, no duplicates.
import { getBlogPostSummaries, getBlogPostSummariesForCategory, type BlogPostSummary } from "@/lib/professionalData";
import { getBlogCategory } from "@/lib/blogCategories";
import { detectPostService } from "@/lib/blog/postService";

export async function getJournalPostsForCategory(slug: string): Promise<BlogPostSummary[]> {
  const category = getBlogCategory(slug);
  const [tagged, journal] = await Promise.all([
    getBlogPostSummariesForCategory(slug),
    category?.service ? getBlogPostSummaries("professional") : Promise.resolve([] as BlogPostSummary[]),
  ]);
  const detected = journal.filter(
    (post) => detectPostService(`${post.title} ${post.slug}`) === category?.service,
  );
  const seen = new Set<number>();
  return [...tagged, ...detected]
    .filter((post) => (seen.has(post.id) ? false : (seen.add(post.id), true)))
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}
