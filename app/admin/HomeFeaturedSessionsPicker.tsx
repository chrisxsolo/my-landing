"use client";

// Website → Home Page: choose which journal sessions the homepage features.
// Each slot is a blog post slug in site_settings; "Automatic" clears it and the
// homepage falls back to the newest published post of that service
// (lib/homepageData buildFeaturedSessions). Only published posts are listed.
import { useEffect, useState } from "react";
import { FEATURED_SESSION_SETTING_KEYS } from "@/lib/homepageData";

type PostOption = { slug: string; title: string; published_at: string | null };

type Props = {
  settings: Record<string, string | null>;
  savingKey: string | null;
  onSave: (key: string, value: string | null) => void;
};

const SLOTS = [
  { key: FEATURED_SESSION_SETTING_KEYS.grads, label: "Featured graduation session", auto: "Automatic: newest graduation journal" },
  { key: FEATURED_SESSION_SETTING_KEYS.couples, label: "Featured couples session", auto: "Automatic: newest couples journal" },
] as const;

const AUTO_VALUE = "";

export default function HomeFeaturedSessionsPicker({ settings, savingKey, onSave }: Props) {
  const [posts, setPosts] = useState<PostOption[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/blog-posts")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json: { posts?: PostOption[] }) => {
        if (cancelled) return;
        const now = Date.now();
        // A future published_at is scheduled, not live: don't offer it.
        setPosts((json.posts ?? []).filter((p) => p.slug && (!p.published_at || Date.parse(p.published_at) <= now)));
      })
      .catch((error) => {
        console.error("[admin] featured sessions: failed to load posts", error);
        if (!cancelled) setLoadError(true);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="h-[3px]" style={{ background: "#111827" }} />
      <div className="p-6">
        <h2 className="text-base font-black text-slate-900 mb-1">Home Page Featured Sessions</h2>
        <p className="text-xs text-slate-400 mb-5">
          The two full sessions under &ldquo;Selected work.&rdquo; Leave a slot on Automatic to always show the newest
          journal for that service.
        </p>
        {loadError ? (
          <p className="text-xs text-red-600">Couldn&rsquo;t load journal posts. Refresh to try again.</p>
        ) : (
          <div className="space-y-4">
            {SLOTS.map(({ key, label, auto }) => {
              const current = settings[key] ?? AUTO_VALUE;
              const missing = Boolean(current) && posts !== null && !posts.some((p) => p.slug === current);
              return (
                <div key={key}>
                  <label htmlFor={`featured-${key}`} className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                    {label}
                  </label>
                  <select
                    id={`featured-${key}`}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={current}
                    disabled={posts === null || savingKey === key}
                    onChange={(event) => onSave(key, event.target.value || null)}
                  >
                    <option value={AUTO_VALUE}>{auto}</option>
                    {(posts ?? []).map((post) => (
                      <option key={post.slug} value={post.slug}>{post.title}</option>
                    ))}
                  </select>
                  {missing ? (
                    <p className="text-xs text-amber-700 mt-1">
                      The pinned post is no longer published, so the homepage is using Automatic.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
