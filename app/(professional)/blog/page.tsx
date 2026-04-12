import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPostsByCategory } from "@/lib/professionalData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | soloxsnaps",
  description:
    "Professional photography case studies and session notes from soloxsnaps in San Francisco and the Bay Area.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Blog | soloxsnaps",
    description:
      "Professional photography case studies and session notes from soloxsnaps.",
    type: "website",
  },
};

function excerpt(body: string, max = 180) {
  return body.length > max ? `${body.slice(0, max).trim()}...` : body;
}

export default async function ProfessionalBlogPage() {
  const posts = await getBlogPostsByCategory("professional");

  return (
    <main className="bg-[#fbfbfa] text-[#202020]">
      <section className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-20">
        <p className="text-sm uppercase text-black/42">Blog</p>
        <h1 className="mx-auto mt-4 max-w-5xl font-serif text-5xl font-normal leading-none text-[#202020] sm:text-7xl lg:text-8xl">
          Case studies and session notes.
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-black/60">
          Recent work, notes from professional sessions, and the quieter details behind the frame.
        </p>
      </section>

      <section className="px-5 pb-16 sm:px-8">
        <div className="mx-auto max-w-7xl border-t border-black/14">
          {posts.length > 0 ? (
            posts.map((post, index) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group grid gap-6 border-b border-black/14 py-8 lg:grid-cols-[120px_0.75fr_1fr] lg:items-end"
              >
                <p className="font-serif text-3xl leading-none text-black/50">
                  {String(index + 1).padStart(2, "0")}
                </p>
                {post.cover_image_url ? (
                  <div className="aspect-[4/3] overflow-hidden bg-black/5">
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                    />
                  </div>
                ) : (
                  <div className="hidden aspect-[4/3] bg-black/5 lg:block" />
                )}
                <div>
                  <p className="text-xs uppercase text-black/38">
                    {new Date(post.published_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <h2 className="mt-4 max-w-2xl text-3xl font-medium leading-tight text-[#202020]">
                    {post.title}
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-black/55">
                    {excerpt(post.meta_description || post.body)}
                  </p>
                  <span className="mt-5 inline-block text-sm text-black/45 group-hover:text-black">
                    Read the story
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <div className="border-b border-black/14 p-10 text-black/55">
              No professional case studies yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
