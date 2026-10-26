// Featured + grid cards for the /blog index. Markup is unchanged from the
// original server-rendered page; it now renders inside the client-side
// filter (BlogIndex), so dates arrive pre-formatted from the server.
import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { C } from "@/lib/colors";

export type BlogIndexPost = {
  id: number;
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  dateLabel: string;
  coverUrl: string | null;
  coverAlt: string;
  photoCount: number;
  categories: string[];
};

function excerpt(body: string, max: number) {
  return body.length > max ? `${body.slice(0, max).trim()}…` : body;
}

function ArrowIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhotoPlaceholder({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" opacity="0.25" aria-hidden="true">
      <rect x="4" y="10" width="44" height="32" rx="4" stroke={C.proAccent} strokeWidth="1.5" fill="none" />
      <circle cx="17" cy="22" r="5" stroke={C.proAccent} strokeWidth="1.5" fill="none" />
      <path d="M4 36l12-9 10 7 9-6 13 10" stroke={C.proAccent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FeaturedPostCard({ post, label }: { post: BlogIndexPost; label: string }) {
  return (
    <Link href={`/blog/${post.slug}`} className="blog-featured glass-shimmer" data-reveal>
      <div className="blog-featured-media">
        {post.coverUrl ? (
          <OptimizedPhoto src={post.coverUrl} alt={post.coverAlt} sizes="(max-width: 860px) 100vw, 50vw" priority quality={90} />
        ) : (
          <div className="blog-featured-media-empty"><PhotoPlaceholder size={52} /></div>
        )}
      </div>

      <div className="blog-featured-body">
        <span className="blog-featured-label">
          <span className="blog-featured-label-dot" />
          {label}
        </span>
        <h2 className="blog-featured-title">{post.title}</h2>
        <p className="blog-featured-excerpt">{excerpt(post.description, 170)}</p>
        <div className="blog-featured-meta">
          <span>{post.dateLabel}</span>
          {post.photoCount > 1 && (
            <>
              <span className="blog-featured-meta-dot" />
              <span>{post.photoCount} photos</span>
            </>
          )}
        </div>
        <span className="blog-featured-cta">
          Read the story
          <ArrowIcon size={14} />
        </span>
      </div>
    </Link>
  );
}

export function PostCard({ post, index }: { post: BlogIndexPost; index: number }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="blog-card glass-shimmer"
      data-reveal
      data-delay={String(Math.min((index % 3) + 1, 5))}
    >
      <div className="blog-card-media">
        {post.coverUrl ? (
          <OptimizedPhoto src={post.coverUrl} alt={post.coverAlt} sizes="(max-width: 760px) 100vw, 33vw" loading="lazy" />
        ) : (
          <div className="blog-card-media-empty"><PhotoPlaceholder size={34} /></div>
        )}
      </div>

      <div className="blog-card-body">
        <p className="blog-card-date">{post.dateLabel}</p>
        <h2 className="blog-card-title">{post.title}</h2>
        <p className="blog-card-excerpt">{excerpt(post.description, 110)}</p>
        <span className="blog-card-cta">
          Read the story
          <ArrowIcon size={13} />
        </span>
      </div>
    </Link>
  );
}
