"use client";

// /blog post list with category filter pills + date sort. All published posts
// arrive from the server, so filtering and sorting run in memory over the full
// set with no refetch. The view lives in the URL (?category=couples&sort=oldest)
// via the native History API: shareable, refresh-safe, back/forward aware. The
// server render is always the default view (All, newest), which keeps the page
// statically cached; /blog stays the canonical URL for every filtered view.
import { useMemo, useSyncExternalStore } from "react";
import { C } from "@/lib/colors";
import { normalizeCategoryTag, type CategoryFilter } from "@/lib/blog/postCategories";
import { FeaturedPostCard, PostCard, type BlogIndexPost } from "./BlogPostCards";

type SortOrder = "newest" | "oldest";
type View = { category: string; sort: SortOrder };

const ALL = "all";
const CATEGORY_PARAM = "category";
const SORT_PARAM = "sort";
const DEFAULT_VIEW: View = { category: ALL, sort: "newest" };
const SORT_LABELS: Record<SortOrder, string> = { newest: "Newest first", oldest: "Oldest first" };

// pushState doesn't fire popstate, so the view store notifies its own listeners.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}
const getSearch = () => window.location.search;
const getServerSearch = () => "";

function parseView(search: string): View {
  const params = new URLSearchParams(search);
  const rawCategory = params.get(CATEGORY_PARAM)?.trim().toLowerCase() || ALL;
  const category = rawCategory === ALL ? ALL : normalizeCategoryTag(rawCategory)?.slug ?? rawCategory;
  return { category, sort: params.get(SORT_PARAM) === "oldest" ? "oldest" : "newest" };
}

function pushView(view: View) {
  const params = new URLSearchParams(window.location.search);
  if (view.category === ALL) params.delete(CATEGORY_PARAM);
  else params.set(CATEGORY_PARAM, view.category);
  if (view.sort === DEFAULT_VIEW.sort) params.delete(SORT_PARAM);
  else params.set(SORT_PARAM, view.sort);
  const query = params.toString();
  window.history.pushState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  listeners.forEach((listener) => listener());
}

function selectPosts(posts: readonly BlogIndexPost[], view: View): BlogIndexPost[] {
  const direction = view.sort === "newest" ? -1 : 1;
  return posts
    .filter((post) => view.category === ALL || post.categories.includes(view.category))
    .sort((a, b) => direction * (Date.parse(a.publishedAt) - Date.parse(b.publishedAt)));
}

type FilterBarProps = { filters: CategoryFilter[]; total: number; view: View; onChange: (view: View) => void };

function FilterBar({ filters, total, view, onChange }: FilterBarProps) {
  const pills = [{ slug: ALL, label: "All Posts", count: total }, ...filters];
  return (
    <div className="blog-filters">
      {filters.length > 0 && (
        <div className="blog-filter-pills" role="group" aria-label="Filter posts by category">
          {pills.map((pill) => (
            <button
              key={pill.slug}
              type="button"
              className="blog-filter-pill"
              aria-pressed={view.category === pill.slug}
              onClick={() => onChange({ ...view, category: pill.slug })}
            >
              {pill.label}
              <span className="blog-filter-count" aria-hidden="true">{pill.count}</span>
            </button>
          ))}
        </div>
      )}
      <label className="blog-sort">
        <span className="blog-sort-label">Sort by</span>
        <span className="blog-sort-field">
          <select
            className="blog-sort-select"
            value={view.sort}
            onChange={(e) => onChange({ ...view, sort: e.target.value as SortOrder })}
          >
            {(Object.keys(SORT_LABELS) as SortOrder[]).map((sort) => (
              <option key={sort} value={sort}>{SORT_LABELS[sort]}</option>
            ))}
          </select>
          <svg className="blog-sort-chevron" width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </label>
    </div>
  );
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return (
    <div className="blog-empty" data-reveal>
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ margin: "0 auto" }} aria-hidden="true">
        <rect x="5" y="10" width="34" height="26" rx="4" stroke={C.proAccent} strokeWidth="1.5" fill="none" />
        <path d="M14 21h16M14 27h10" stroke={C.proAccent} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {filtered ? (
        <>
          <p className="blog-empty-title">No posts found in this category.</p>
          <button type="button" className="blog-empty-action" onClick={onReset}>View all posts</button>
        </>
      ) : (
        <>
          <p className="blog-empty-title">No case studies yet.</p>
          <p className="blog-empty-copy">Check back after grad season.</p>
        </>
      )}
    </div>
  );
}

export default function BlogIndex({ posts, filters }: { posts: BlogIndexPost[]; filters: CategoryFilter[] }) {
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  const view = useMemo(() => parseView(search), [search]);
  const visible = useMemo(() => selectPosts(posts, view), [posts, view]);
  const [featured, ...rest] = visible;
  const activeLabel = filters.find((f) => f.slug === view.category)?.label;
  const status = `Showing ${visible.length} ${activeLabel ? `${activeLabel.toLowerCase()} ` : ""}post${visible.length === 1 ? "" : "s"}, ${SORT_LABELS[view.sort].toLowerCase()}`;

  if (posts.length === 0) return <EmptyState filtered={false} onReset={() => pushView(DEFAULT_VIEW)} />;

  return (
    <>
      {posts.length > 1 && <FilterBar filters={filters} total={posts.length} view={view} onChange={pushView} />}
      <p className="blog-sr-only" role="status">{status}</p>

      {!featured ? (
        <EmptyState filtered onReset={() => pushView({ ...view, category: ALL })} />
      ) : (
        <>
          <FeaturedPostCard key={featured.id} post={featured} label={view.sort === "newest" ? "Latest story" : "First story"} />
          {rest.length > 0 && (
            <div className="blog-grid">
              {rest.map((post, index) => <PostCard key={post.id} post={post} index={index} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}
