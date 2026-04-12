import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData } from "@/lib/professionalData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio | soloxsnaps",
  description:
    "Portfolio of Bay Area graduation and family photography by Chris Solorzano.",
  alternates: {
    canonical: "/portfolio",
  },
  openGraph: {
    title: "Portfolio | soloxsnaps",
    description:
      "Bay Area graduation and family photography by Chris Solorzano.",
    type: "website",
  },
};

function imageRatio(index: number) {
  return ["4 / 5", "1 / 1", "3 / 4", "5 / 4", "2 / 3", "4 / 3"][index % 6];
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { categories, images } = await getPortfolioData();
  const selectedCategory = (await searchParams).category;
  const selected = categories.find((category) => category.slug === selectedCategory);
  const filteredImages = selectedCategory
    ? images.filter((image) => image.category_slug === selectedCategory)
    : images;

  return (
    <main className="bg-[#fbfbfa] text-[#202020]">
      <section className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-20">
        <p className="text-sm uppercase text-black/42">Portfolio</p>
        <h1 className="mx-auto mt-4 max-w-5xl font-serif text-5xl font-normal leading-none text-[#202020] sm:text-7xl lg:text-8xl">
          Selected work from recent sessions.
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-black/60">
          {selected?.description ||
            "Graduation and family sessions across the Bay Area."}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-sm text-black/52">
          <Link href="/portfolio" className={!selectedCategory ? "text-[#202020] underline underline-offset-4" : "hover:text-black"}>
            / All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/portfolio?category=${category.slug}`}
              className={selectedCategory === category.slug ? "text-[#202020] underline underline-offset-4" : "hover:text-black"}
            >
              / {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="px-3 pb-16 sm:px-5 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          {filteredImages.length > 0 ? (
            <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
              {filteredImages.map((image, index) => (
                <figure key={image.id} className="group relative mb-3 break-inside-avoid overflow-hidden bg-black/5">
                  <div style={{ aspectRatio: imageRatio(index) }}>
                    <img
                      src={image.image_url}
                      alt={image.alt}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                    />
                  </div>
                  <figcaption className="absolute inset-0 flex items-end justify-between gap-4 bg-black/0 p-4 opacity-0 transition duration-300 group-hover:bg-black/45 group-hover:opacity-100">
                    <span className="text-sm font-medium text-white">{image.title}</span>
                    <span className="text-xs uppercase text-white/70">{image.category_name}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="mx-auto max-w-7xl border border-black/10 p-10 text-black/55">
              No portfolio images yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
