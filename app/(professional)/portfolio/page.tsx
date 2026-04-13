import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData } from "@/lib/professionalData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio | soloxsnaps",
  description: "Portfolio of Bay Area graduation and family photography by Chris Solorzano.",
  alternates: { canonical: "/portfolio" },
  openGraph: {
    title: "Portfolio | soloxsnaps",
    description: "Bay Area graduation and family photography by Chris Solorzano.",
    type: "website",
  },
};

const CSS = `
  .portfolio-page {
    background: #fff;
    color: #111;
    padding-top: 78px;
  }
  .port-intro {
    min-height: clamp(260px, 38vw, 480px);
    display: grid;
    place-items: end center;
    padding: 112px 28px 72px;
    text-align: center;
  }
  .port-intro-inner {
    width: min(760px, 100%);
  }
  .port-eyebrow,
  .port-filter-link,
  .port-empty,
  .port-cta-link {
    font-family: var(--font-dm-sans), sans-serif;
    letter-spacing: 0;
    text-transform: uppercase;
  }
  .port-eyebrow {
    margin: 0 0 18px;
    color: #555;
    font-size: 0.68rem;
    font-weight: 620;
  }
  .port-title {
    max-width: 760px;
    margin: 0 auto 28px;
    color: #111;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(2.2rem, 6vw, 5.8rem);
    font-weight: 300;
    letter-spacing: 0.04em;
    line-height: 0.98;
  }
  .port-description {
    max-width: 520px;
    margin: 0 auto 34px;
    color: #4e4e4e;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(1rem, 1.9vw, 1.22rem);
    font-style: italic;
    line-height: 1.75;
  }
  .port-filter-row {
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    padding: 6px;
    border: 1px solid rgba(0,0,0,0.09);
    border-radius: 8px;
    background: #fbfbf9;
  }
  .port-filter-link {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0 13px;
    color: #444;
    border-radius: 6px;
    font-size: 0.68rem;
    font-weight: 620;
    text-decoration: none;
    transition: color 0.18s ease, background 0.18s ease;
  }
  .port-filter-link[aria-current="page"],
  .port-filter-link:hover {
    color: #111;
    background: rgba(0,0,0,0.06);
  }
  .portfolio-gallery-section {
    padding: 0 24px 116px;
  }
  .port-image-wall {
    width: min(1500px, 100%);
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .port-figure {
    position: relative;
    aspect-ratio: 4 / 5;
    margin: 0;
    overflow: hidden;
    background: #ecece8;
    isolation: isolate;
  }
  .port-figure::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.035);
  }
  .port-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    transform: scale(1.01);
    transition: transform 0.7s ease, filter 0.7s ease;
  }
  .port-figure:hover .port-img {
    transform: scale(1.055);
    filter: saturate(1.04) contrast(1.02);
  }
  .port-empty {
    width: min(720px, 100%);
    margin: 0 auto;
    padding: 72px 28px;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 8px;
    color: #4e4e4e;
    font-size: 0.78rem;
    font-weight: 620;
    text-align: center;
  }
  .port-cta {
    border-top: 1px solid rgba(0,0,0,0.07);
    padding: 82px 28px;
    text-align: center;
  }
  .port-cta-copy {
    margin: 0 0 30px;
    color: #4e4e4e;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(1rem, 2.2vw, 1.3rem);
    font-style: italic;
  }
  .port-cta-link {
    display: inline-flex;
    align-items: center;
    min-height: 48px;
    padding: 0 28px;
    border-radius: 8px;
    background: #161616;
    color: #fff;
    font-size: 0.75rem;
    font-weight: 620;
    text-decoration: none;
  }
  @media (max-width: 980px) {
    .port-image-wall {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }
  }
  @media (max-width: 760px) {
    .portfolio-page {
      padding-top: 72px !important;
    }
    .professional-shell .port-intro {
      min-height: 330px;
      padding: 122px 20px 48px !important;
    }
    .port-title {
      font-size: clamp(2.25rem, 14vw, 4.2rem) !important;
      letter-spacing: 0.03em;
    }
    .port-description {
      font-size: 0.98rem;
      line-height: 1.65;
      margin-bottom: 24px;
    }
    .port-filter-row {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
    }
    .port-filter-link {
      justify-content: center;
      padding: 0 8px;
      font-size: 0.66rem;
    }
    .professional-shell .portfolio-gallery-section {
      padding: 0 0 82px !important;
    }
    .port-image-wall {
      width: 100%;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px;
    }
    .port-cta {
      padding: 64px 24px;
    }
    .port-cta-link {
      width: 100%;
      justify-content: center;
    }
  }
`;

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { categories, images } = await getPortfolioData();
  const selectedCategory = (await searchParams).category;
  const selected = categories.find((c) => c.slug === selectedCategory);
  const filteredImages = selectedCategory
    ? images.filter((img) => img.category_slug === selectedCategory)
    : images;

  return (
    <main className="portfolio-page">
      <style>{CSS}</style>

      <section className="port-intro" aria-labelledby="portfolio-title">
        <div className="port-intro-inner">
          <p className="port-eyebrow">Portfolio</p>
          <h1 id="portfolio-title" className="port-title">
            {selected?.name ?? "Selected work"}
          </h1>
          <p className="port-description">
            {selected?.description ?? "Graduation and family sessions across the Bay Area."}
          </p>

          <div className="port-filter-row" aria-label="Portfolio filters">
          <Link
            href="/portfolio"
            className="port-filter-link"
            aria-current={!selectedCategory ? "page" : undefined}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/portfolio?category=${cat.slug}`}
              className="port-filter-link"
              aria-current={selectedCategory === cat.slug ? "page" : undefined}
            >
              {cat.name}
            </Link>
          ))}
          </div>
        </div>
      </section>

      <section className="portfolio-gallery-section" aria-label={`${selected?.name ?? "Selected work"} photos`}>
          {filteredImages.length > 0 ? (
            <div className="port-image-wall">
              {filteredImages.map((image) => (
                <figure
                  key={image.id}
                  className="port-figure"
                >
                  <img
                    src={image.image_url}
                    alt={image.alt}
                    className="port-img"
                  />
                </figure>
              ))}
            </div>
          ) : (
            <div className="port-empty">
              No portfolio images yet.
            </div>
          )}
      </section>

      <section className="port-cta">
        <p className="port-cta-copy">
          Like what you see?
        </p>
        <Link href="/contact" className="port-cta-link">
          Inquire now
        </Link>
      </section>
    </main>
  );
}
