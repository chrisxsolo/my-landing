import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPostBySlug } from "@/lib/professionalData";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug("professional", slug);

  if (!post) {
    return {
      title: "Case Study Not Found | soloxsnaps",
    };
  }

  const description =
    post.meta_description ||
    (post.body.length > 155 ? `${post.body.slice(0, 155).trim()}...` : post.body);

  return {
    title: `${post.title} | soloxsnaps`,
    description,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    keywords: post.meta_keywords ?? undefined,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      publishedTime: post.published_at,
      images: post.og_image_url || post.cover_image_url ? [post.og_image_url || post.cover_image_url || ""] : undefined,
    },
  };
}

export default async function ProfessionalBlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPostBySlug("professional", slug);

  if (!post) {
    notFound();
  }

  const images = [post.cover_image_url, ...(post.extra_image_urls ?? [])].filter(Boolean) as string[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.published_at,
    image: images,
    author: {
      "@type": "Person",
      name: "Chris Solorzano",
    },
    publisher: {
      "@type": "Organization",
      name: "soloxsnaps",
    },
  };

  return (
    <main className="bg-[#fbfbfa] text-[#202020]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <article>
        <header className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-20">
          <Link href="/blog" className="text-sm text-black/55 underline underline-offset-4 hover:text-black">
            Back to case studies
          </Link>
          <p className="mt-10 text-xs uppercase text-black/38">{formatDate(post.published_at)}</p>
          <h1 className="mx-auto mt-4 max-w-5xl font-serif text-5xl font-normal leading-none text-[#202020] sm:text-7xl lg:text-8xl">
            {post.title}
          </h1>
        </header>

        {post.cover_image_url ? (
          <div className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-8">
            <div className="max-h-[820px] overflow-hidden bg-black/5">
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        ) : null}

        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.55fr_1fr]">
          <aside className="text-sm leading-6 text-black/45">
            <p className="font-medium uppercase text-black/38">Details</p>
            <p className="mt-4">San Francisco and Bay Area photography by Chris Solorzano.</p>
          </aside>
          <div className="space-y-6 text-lg leading-8 text-black/68">
            {post.body
              .split(/\n\n+/)
              .filter((paragraph) => paragraph.trim())
              .map((paragraph, index) => (
                <p key={index}>{paragraph.trim()}</p>
              ))}
          </div>
        </div>

        {post.extra_image_urls?.length > 0 ? (
          <section className="border-t border-black/10 px-3 py-14 sm:px-5 lg:px-8">
            <div className="mx-auto max-w-[1600px]">
              <div className="mb-8 flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm uppercase text-black/42">Gallery</p>
                  <h2 className="mt-3 font-serif text-5xl font-normal leading-none text-[#202020] sm:text-7xl">
                    More from this story
                  </h2>
                </div>
                <a href="https://www.soloxsnaps.com/contact/" className="text-sm text-black/52 underline underline-offset-4 hover:text-black">
                  Inquire now
                </a>
              </div>
              <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
                {post.extra_image_urls.map((url, index) => (
                  <div key={url} className="mb-3 break-inside-avoid overflow-hidden bg-black/5">
                    <div style={{ aspectRatio: index % 2 === 0 ? "4 / 5" : "5 / 4" }}>
                      <img
                        src={url}
                        alt={`${post.title} image ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </article>
    </main>
  );
}
