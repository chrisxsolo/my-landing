import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, type PortfolioCategory, type PortfolioImage } from "@/lib/professionalData";

export const dynamic = "force-dynamic";

const title = "soloxsnaps | Bay Area Graduation and Family Photographer";
const description =
  "Bay Area graduation and family photography by Chris Solorzano, focused on honest portraits, warm milestones, and clean editorial imagery.";
const profileImage =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/DSC02593_(2).jpg";
const visiblePortfolioSlugs = ["grads", "families"];

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/",
  },
  keywords: [
    "Bay Area graduation photographer",
    "San Francisco graduation photographer",
    "Bay Area family photographer",
    "family photographer",
    "soloxsnaps",
    "Chris Solorzano photography",
  ],
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "soloxsnaps",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

function getCoverForCategory(
  category: PortfolioCategory,
  images: PortfolioImage[],
  fallbackImage: PortfolioImage | undefined,
  index: number
) {
  return images.find((image) => image.category_slug === category.slug) ?? images[index] ?? fallbackImage;
}

export default async function ProfessionalHomePage() {
  const { categories, images } = await getPortfolioData();
  const heroImage = images[0];
  const heroImageUrl = heroImage?.image_url ?? profileImage;
  const heroImageAlt = heroImage?.alt ?? "Bay Area portrait by Chris Solorzano";
  const visibleCategories = visiblePortfolioSlugs
    .map((slug) => categories.find((category) => category.slug === slug))
    .filter(Boolean) as PortfolioCategory[];
  const portfolioSections = visibleCategories.map((category, index) => ({
    category,
    cover: getCoverForCategory(category, images, heroImage, index),
    subline: category.slug === "grads" ? "the milestone" : "the people",
  }));
  const portfolioPreviewImages = images.slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "soloxsnaps",
    url: "https://soloxsnaps.com",
    image: heroImageUrl,
    founder: {
      "@type": "Person",
      name: "Chris Solorzano",
    },
    areaServed: ["San Francisco", "Bay Area", "San Jose", "Oakland", "Berkeley"],
    serviceType: ["Graduation photography", "Family photography"],
  };

  return (
    <main className="bg-[#fbfbfa] text-[#242424]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <section className="px-6 pb-20 pt-10 sm:px-10">
        <div className="mx-auto max-w-[1460px]">
          <h1 className="text-center font-serif text-6xl font-normal lowercase leading-none text-[#171717] sm:text-8xl lg:text-9xl">
            soloxsnaps
          </h1>

          <div className="relative mx-auto mt-10 max-w-[1280px]">
            <div className="hidden lg:block">
              <p className="absolute -left-16 top-1/2 -translate-y-1/2 rotate-90 font-serif text-sm italic text-black/45">
                scroll
              </p>
              <div className="absolute -left-10 top-[56%] h-16 w-px bg-black/25" />
            </div>
            <Link href="/portfolio?category=grads" className="group block overflow-hidden bg-black/5">
              <img
                src={heroImageUrl}
                alt={heroImageAlt}
                className="h-[420px] w-full object-cover transition duration-700 group-hover:scale-[1.02] sm:h-[620px] lg:h-[760px]"
              />
            </Link>
            <div className="mt-5 flex justify-center gap-3" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, index) => (
                <span key={index} className="h-3 w-3 bg-black/10" />
              ))}
            </div>
          </div>

          <div className="mx-auto mt-20 max-w-4xl text-center">
            <p className="font-serif text-2xl uppercase leading-loose text-[#242424] sm:text-4xl">
              Photographing the honest,
              <br />
              for grads and families who feel deeply.
            </p>
            <div className="mx-auto mt-10 h-px w-20 bg-black/20" />
            <p className="mt-7 font-serif text-xl italic leading-relaxed text-[#333333] sm:text-2xl">
              Bay Area graduation and family photographer
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="text-center">
            <p className="font-serif text-xl italic text-[#242424]">artistry &amp; ease</p>
            <h2 className="mt-6 font-serif text-3xl font-normal uppercase leading-none text-[#242424]">
              Chris Solorzano
            </h2>
            <div className="mx-auto mt-8 h-px w-16 bg-black/20" />
            <p className="mx-auto mt-10 max-w-md font-serif text-xl leading-relaxed text-[#333333]">
              I photograph the real stuff with a calm eye: proud grads, growing families, and the little pauses that make a session feel like you.
            </p>
            <Link href="/about" className="mt-10 inline-block font-serif text-lg italic text-[#242424] hover:opacity-60">
              learn more about me and my photographs here
            </Link>
            <div className="mx-auto mt-8 h-px w-20 bg-black/30" />
          </div>

          <div className="overflow-hidden bg-black/5">
            <img src={profileImage} alt="Chris Solorzano" className="h-full max-h-[760px] w-full object-cover" />
          </div>
        </div>
      </section>

      {portfolioPreviewImages.length > 0 ? (
        <section className="px-6 py-20 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-serif text-3xl font-normal uppercase text-[#242424]">
              From the portfolio
            </h2>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {portfolioPreviewImages.map((image) => (
                <Link key={image.id} href={`/portfolio?category=${image.category_slug}`} className="group block overflow-hidden bg-black/5">
                  <img
                    src={image.image_url}
                    alt={image.alt}
                    className="h-[360px] w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                  />
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-6 py-20 sm:px-10">
        <div className="mx-auto grid max-w-7xl border-y border-black/20 md:grid-cols-2">
          {portfolioSections.map(({ category, cover, subline }, index) => (
            <Link
              key={category.slug}
              href={`/portfolio?category=${category.slug}`}
              className={`group flex min-h-[560px] flex-col items-center justify-center px-8 py-14 text-center ${
                index === 0 ? "md:border-r md:border-black/20" : ""
              }`}
            >
              <h2 className="font-serif text-4xl font-normal uppercase text-[#242424]">{category.name}</h2>
              <p className="mt-4 font-serif text-2xl italic text-[#242424]">{subline}</p>
              <div className="mx-auto mt-8 h-px w-16 bg-black/20" />
              {cover ? (
                <div className="mt-10 w-full max-w-[360px] overflow-hidden bg-black/5">
                  <img
                    src={cover.image_url}
                    alt={cover.alt}
                    className="h-[300px] w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                  />
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 text-center sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="font-serif text-3xl italic leading-relaxed text-[#333333] sm:text-4xl">
            The best photos feel like a memory you can still step into: familiar, easy, and full of the people who matter.
          </p>
          <p className="mt-10 font-serif text-lg uppercase text-[#242424]">soloxsnaps</p>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1fr] lg:items-end">
          <div>
            <p className="font-serif text-xl italic text-black/65">you love the work and you're</p>
            <h2 className="mt-5 font-serif text-5xl font-normal leading-none text-[#202020] sm:text-7xl">
              Ready to work together?
            </h2>
            <a
              href="https://www.soloxsnaps.com/contact/"
              className="mt-10 inline-flex border border-black px-8 py-4 text-sm uppercase text-[#202020] transition-colors hover:bg-black hover:text-white"
            >
              Inquire now
            </a>
          </div>
          {heroImage ? (
            <div className="overflow-hidden bg-black/5">
              <img src={heroImage.image_url} alt={heroImage.alt} className="h-full max-h-[720px] w-full object-cover" />
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
