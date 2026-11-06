"use client";
// The live-post list under the Blog form (extracted from BlogTab unchanged in
// behaviour): cover, meta line, Blog link, live-photo manager, AI SEO, Edit,
// two-step Delete.
import { C } from "@/lib/colors";
import BlogPostImages from "@/app/admin/BlogPostImages";

export type BlogCategory = "journal" | "professional";
export type BlogPost = {
  id: number; title: string; body: string; published_at: string; slug: string; cover_image_url: string | null;
  extra_image_urls: string[]; category?: BlogCategory | string | null; sites?: string[] | null; meta_description?: string | null;
  meta_keywords?: string | null; cover_image_alt?: string | null; extra_image_alts?: string[] | null;
};

const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";

interface Props {
  posts: BlogPost[];
  loading: boolean;
  editingPostId: number | null;
  imagesOpenId: number | null;
  seoGeneratingId: number | null;
  deleteConfirmId: number | null;
  showToast: (msg: string, ok?: boolean) => void;
  onToggleImages: (id: number) => void;
  onSeo: (post: BlogPost) => void;
  onEdit: (post: BlogPost) => void;
  onAskDelete: (id: number | null) => void;
  onDelete: (id: number) => void;
  onLiveImagesChanged: (id: number) => void;
}

const sitesOf = (post: BlogPost) =>
  post.sites && post.sites.length > 0 ? post.sites : [post.category === "professional" ? "professional" : "journal"];

export default function BlogPostList(p: Props) {
  const { posts, loading } = p;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: C.p1 }}>Professional Blog Posts</p>
          <span className="text-xs font-bold text-slate-400">({posts.length})</span>
        </div>
      </div>
      {loading ? [...Array(2)].map((_, i) => <div key={i} className="rounded-2xl animate-pulse h-20 mb-3" style={{ background: `linear-gradient(135deg,${C.p1_08},${C.p2_06})` }} />) : (
        posts.length === 0 ? <p className="text-sm text-slate-400 font-medium">No posts yet — write your first one above.</p> : (
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className={card} style={p.editingPostId === post.id ? { outline: `2px solid ${C.p1}` } : {}}>
                <div className="flex">
                  {post.cover_image_url ? <div className="w-20 h-20 flex-shrink-0 overflow-hidden"><img src={post.cover_image_url} className="w-full h-full object-cover" /></div> : <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: C.p1_06 }}>✍️</div>}
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate mb-0.5">{post.title}</p>
                        <p className="text-xs text-slate-400">{sitesOf(post).map(s => s === "professional" ? "Professional" : "Journal").join(" + ")} · {new Date(post.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {(post.extra_image_urls?.length ?? 0) + 1} photo{(post.extra_image_urls?.length ?? 0) > 0 ? "s" : ""}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 flex-wrap">
                        {sitesOf(post).includes("professional") && (
                          <a href={`/blog/${post.slug}`} target="_blank" className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: C.p1_08, color: C.p1 }}>Blog →</a>
                        )}
                        <button onClick={() => p.onToggleImages(post.id)} title="Every image the live page renders, with remove / replace and revision history" className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: p.imagesOpenId === post.id ? C.p1 : C.p1_08, color: p.imagesOpenId === post.id ? C.white : C.p1 }}>{p.imagesOpenId === post.id ? "Hide photos" : "Live photos"}</button>
                        <button onClick={() => p.onSeo(post)} disabled={p.seoGeneratingId === post.id} title="Analyze photos + text and write SEO metadata" className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: C.p3_10, color: C.ink, opacity: p.seoGeneratingId === post.id ? 0.6 : 1 }}>{p.seoGeneratingId === post.id ? "✨ Generating…" : "✨ SEO"}</button>
                        {p.editingPostId !== post.id && <button onClick={() => p.onEdit(post)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: C.p2_08, color: C.p2 }}>Edit</button>}
                        {p.deleteConfirmId === post.id ? (
                          <div className="flex gap-1.5">
                            <button onClick={() => p.onDelete(post.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{ background: "#be123c" }}>Delete</button>
                            <button onClick={() => p.onAskDelete(null)} className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-100">✕</button>
                          </div>
                        ) : <button onClick={() => p.onAskDelete(post.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>}
                      </div>
                    </div>
                  </div>
                </div>
                {p.imagesOpenId === post.id && (
                  <BlogPostImages postId={post.id} showToast={p.showToast} onChanged={() => { p.onLiveImagesChanged(post.id); }} />
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
