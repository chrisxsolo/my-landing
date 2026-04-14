import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings, type PortfolioCategory, type PortfolioImage } from "@/lib/professionalData";
import HeroCarousel from "@/app/components/HeroCarousel";

export const dynamic = "force-dynamic";

const title = "soloxsnaps | Bay Area Graduation and Family Photographer";
const description =
  "Bay Area graduation and family photography by Chris Solorzano. Clean direction, warm portraits, and galleries built around real milestones.";
const profileImage =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/DSC02593_(2).jpg";
const visiblePortfolioSlugs = ["grads", "families"];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  keywords: [
    "Bay Area graduation photographer",
    "San Francisco graduation photographer",
    "Bay Area family photographer",
    "soloxsnaps",
    "Chris Solorzano photography",
  ],
  openGraph: { title, description, type: "website", siteName: "soloxsnaps" },
  twitter: { card: "summary_large_image", title, description },
};

type CoverImage = Pick<PortfolioImage, "image_url" | "alt">;

function getCoverForCategory(
  category: PortfolioCategory,
  images: PortfolioImage[],
  fallback: PortfolioImage | undefined,
  index: number
) {
  return images.find((img) => img.category_slug === category.slug) ?? images[index] ?? fallback;
}

const CSS = `
  .home-page {
    background: transparent;
    color: #101412;
  }
  .home-section {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }
  .home-kicker,
  .home-chip,
  .home-link,
  .home-card-kicker,
  .home-meta {
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
  }
  .home-kicker {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
  }
  .home-title {
    margin: 0;
    color: #101412;
    font-size: 56px;
    font-weight: 860;
    letter-spacing: 0;
    line-height: 0.98;
    text-wrap: balance;
  }
  .home-copy {
    margin: 0;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.75;
    text-wrap: pretty;
  }
  .home-link {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 17px;
    border: 1px solid rgba(112, 139, 133, 0.22);
    border-radius: 8px;
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
    box-shadow: 0 10px 24px rgba(112, 139, 133, 0.05);
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .home-link[data-variant="ghost"] {
    border-color: rgba(18, 24, 22, 0.11);
    background: rgba(255, 255, 255, 0.72);
    color: #101412;
    box-shadow: none;
  }
  .home-link:hover {
    transform: translateY(-1px);
    border-color: rgba(112, 139, 133, 0.32);
    background: rgba(239, 246, 244, 0.98);
    box-shadow: 0 14px 28px rgba(112, 139, 133, 0.07);
  }
  .home-link[data-variant="ghost"]:hover {
    background: #ffffff;
    box-shadow: 0 10px 22px rgba(18, 24, 22, 0.06);
  }
  .home-proof {
    position: relative;
    z-index: 1;
    padding: 0 0 96px;
  }
  .home-proof-grid {
    display: grid;
    grid-template-columns: 1.08fr repeat(4, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 18px 40px rgba(18, 24, 22, 0.08);
    color: #101412;
  }
  .home-proof-intro,
  .home-proof-item {
    min-height: 148px;
    padding: 22px;
  }
  .home-proof-intro {
    display: grid;
    align-content: space-between;
    border-right: 1px solid rgba(18, 24, 22, 0.1);
    background: rgba(247, 250, 249, 0.76);
  }
  .home-proof-eyebrow {
    margin: 0 0 28px;
    color: #667f79;
    font-size: 12px;
    font-weight: 820;
    letter-spacing: 0;
  }
  .home-proof-title {
    margin: 0;
    color: #101412;
    font-size: 24px;
    font-weight: 860;
    letter-spacing: 0;
    line-height: 1.02;
    text-wrap: balance;
  }
  .home-proof-item {
    display: grid;
    align-content: space-between;
    gap: 28px;
    border-right: 1px solid rgba(18, 24, 22, 0.1);
  }
  .home-proof-item:last-child {
    border-right: 0;
  }
  .home-proof-number {
    color: rgba(112, 139, 133, 0.42);
    font-size: 13px;
    font-weight: 820;
    letter-spacing: 0;
  }
  .home-proof-item h3 {
    display: block;
    margin: 0 0 8px;
    color: #101412;
    font-size: 18px;
    font-weight: 860;
    letter-spacing: 0;
    line-height: 1.05;
  }
  .home-proof-item p {
    display: block;
    margin: 0;
    color: #5f6c67;
    font-size: 13px;
    line-height: 1.5;
  }
  .home-editorial {
    padding: 8px 0 86px;
  }
  .home-editorial-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    gap: 48px;
    align-items: end;
  }
  .home-editorial-copy {
    display: grid;
    gap: 26px;
  }
  .home-editorial-media {
    position: relative;
    min-height: 560px;
  }
  .home-stacked-photo {
    position: absolute;
    overflow: hidden;
    border-radius: 8px;
    background: #dfe8e4;
    box-shadow: 0 14px 34px rgba(18, 24, 22, 0.1);
  }
  .home-stacked-photo img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .home-stacked-photo[data-size="large"] {
    inset: 0 0 42px 98px;
  }
  .home-stacked-photo[data-size="small"] {
    left: 0;
    bottom: 0;
    width: 46%;
    aspect-ratio: 4 / 5;
    border: 8px solid #f7faf8;
  }
  .home-services {
    padding: 82px 0 68px;
  }
  .home-section-heading {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 24px;
    margin-bottom: 28px;
  }
  .home-section-heading .home-copy {
    max-width: 410px;
  }
  .home-card-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .home-card {
    min-height: 100%;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 14px;
    padding: 14px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.92);
    color: #101412;
    text-decoration: none;
    box-shadow: 0 10px 26px rgba(18, 24, 22, 0.06);
    transition: background 0.18s ease, border-color 0.18s ease;
  }
  .home-card:hover {
    background: #ffffff;
    border-color: rgba(18, 24, 22, 0.16);
  }
  .home-card-media {
    position: relative;
    overflow: hidden;
    width: 100%;
    aspect-ratio: 16 / 10;
    border-radius: 8px;
    background: #dfe8e4;
  }
  .home-card-media img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .home-card-body {
    padding: 0 4px;
  }
  .home-card-kicker {
    margin: 0 0 8px;
    color: #667f79;
    font-size: 12px;
    font-weight: 820;
  }
  .home-card h3 {
    margin: 0 0 10px;
    color: #101412;
    font-size: 22px;
    font-weight: 860;
    letter-spacing: 0;
    line-height: 1.02;
  }
  .home-card p {
    margin: 0;
    color: #5b6763;
    font-size: 14px;
    line-height: 1.55;
  }
  .home-card-footer {
    min-height: 34px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 4px;
    border-top: 1px solid rgba(18, 24, 22, 0.1);
    color: #101412;
    font-size: 13px;
    font-weight: 820;
  }
  .home-cta {
    padding: 88px 0 110px;
  }
  .home-cta-panel {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
    gap: 34px;
    align-items: center;
    padding: 12px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 14px 36px rgba(18, 24, 22, 0.08);
  }
  .home-cta-copy {
    padding: 34px 28px;
  }
  .home-cta-media {
    overflow: hidden;
    min-height: 420px;
    border-radius: 8px;
    background: #dfe8e4;
  }
  .home-cta-media img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .home-strip {
    padding: 0 0 12px;
  }
  .home-strip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
  }
  .home-strip-grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(120px, 1fr));
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .home-strip-link {
    display: block;
    min-width: 120px;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 8px;
    background: #dfe8e4;
  }
  .home-strip-link img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  @media (max-width: 920px) {
    .home-card-grid,
    .home-editorial-grid,
    .home-cta-panel {
      grid-template-columns: 1fr;
    }
    .home-proof-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .home-proof-intro {
      grid-column: 1 / -1;
      min-height: 120px;
      border-right: 0;
      border-bottom: 1px solid rgba(18, 24, 22, 0.1);
    }
    .home-proof-item:nth-child(3),
    .home-proof-item:last-child {
      border-right: 0;
    }
    .home-section-heading {
      align-items: start;
      flex-direction: column;
    }
    .home-editorial-media {
      min-height: 520px;
      order: -1;
    }
    .home-stacked-photo[data-size="large"] {
      inset: 0 0 54px 48px;
    }
  }
  @media (max-width: 760px) {
    .home-section {
      width: min(1180px, calc(100% - 36px));
    }
    .home-proof-intro,
    .home-proof-item {
      min-height: 118px;
      padding: 18px;
    }
    .home-proof-title {
      font-size: 22px;
    }
    .home-editorial {
      padding: 0 0 66px;
    }
    .home-title {
      font-size: 40px;
      line-height: 1;
    }
    .home-copy {
      font-size: 16px;
      line-height: 1.68;
    }
    .home-editorial-media {
      min-height: 430px;
    }
    .home-stacked-photo[data-size="large"] {
      inset: 0 0 48px 26px;
    }
    .home-stacked-photo[data-size="small"] {
      width: 52%;
      border-width: 6px;
    }
    .home-services {
      padding: 62px 0 54px;
    }
    .home-card-grid {
      gap: 10px;
    }
    .home-card {
      gap: 10px;
      padding: 10px;
    }
    .home-card-kicker {
      font-size: 11px;
      margin-bottom: 5px;
    }
    .home-card h3 {
      font-size: 20px;
      margin-bottom: 6px;
    }
    .home-card p {
      font-size: 13px;
      line-height: 1.45;
    }
    .home-card-footer {
      min-height: 28px;
      font-size: 12px;
    }
    .home-cta {
      padding: 66px 0 78px;
    }
    .home-cta-copy {
      padding: 18px 8px 8px;
    }
    .home-cta-media {
      min-height: 340px;
    }
  }
  @media (max-width: 430px) {
    .home-proof-grid {
      grid-template-columns: 1fr;
    }
    .home-proof-item {
      min-height: 112px;
      border-right: 0;
      border-bottom: 1px solid rgba(18, 24, 22, 0.1);
    }
    .home-proof-item:last-child {
      border-bottom: 0;
    }
    .home-title {
      font-size: 34px;
    }
    .home-editorial-media {
      min-height: 360px;
    }
  }
`;

export default async function ProfessionalHomePage() {
  const [{ categories, images }, settings] = await Promise.all([
    getPortfolioData(),
    getSiteSettings(),
  ]);
  const heroImage = images[0];
  const heroImageUrl = heroImage?.image_url ?? profileImage;

  function resolveSettingsCover(key: string, fallback: PortfolioImage | undefined): CoverImage | undefined {
    const url = settings[key];
    if (url) return { image_url: url, alt: key.replace("home_cover_", "") };
    return fallback;
  }

  const visibleCategories = visiblePortfolioSlugs
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter(Boolean) as PortfolioCategory[];

  const portfolioSections = visibleCategories.map((category, index) => ({
    category,
    cover: resolveSettingsCover(`home_cover_${category.slug}`, getCoverForCategory(category, images, heroImage, index)),
    subline: category.slug === "grads" ? "Graduation sessions" : "Family sessions",
    copy:
      category.slug === "grads"
        ? "Campus portraits, cap-and-gown details, friend groups, and gallery-ready milestone images."
        : "Calm, warm family portraits with enough direction to keep everyone comfortable.",
  }));

  const carouselImages = images.filter((img) => img.hero_carousel).slice(0, 5);
  const heroImages = carouselImages.length > 0 ? carouselImages : images.slice(0, 5);
  const instagramImages = images.slice(0, 8);
  const firstPortfolioImage = portfolioSections[0]?.cover?.image_url ?? heroImageUrl;
  const secondPortfolioImage = portfolioSections[1]?.cover?.image_url ?? heroImageUrl;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "soloxsnaps",
    url: "https://soloxsnaps.com",
    image: heroImageUrl,
    founder: { "@type": "Person", name: "Chris Solorzano" },
    areaServed: ["San Francisco", "Bay Area", "San Jose", "Oakland", "Berkeley"],
    serviceType: ["Graduation photography", "Family photography"],
  };

  return (
    <main className="home-page">
      <style>{CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <HeroCarousel images={heroImages} />

      <section className="home-section home-services">
        <div className="home-section-heading">
          <div>
            <p className="home-kicker">Choose the session</p>
            <h2 className="home-title">Built for milestones, not stock-photo energy.</h2>
          </div>
          <p className="home-copy">
            Graduation, family, and booking info are kept simple so you can pick a lane and move.
          </p>
        </div>

        <div className="home-card-grid">
          {portfolioSections.map(({ category, cover, subline, copy }) => (
            <Link key={category.slug} href={`/portfolio?category=${category.slug}`} className="home-card">
              {cover && (
                <div className="home-card-media">
                  <img src={cover.image_url} alt={cover.alt} loading="lazy" decoding="async" />
                </div>
              )}
              <div className="home-card-body">
                <p className="home-card-kicker">{subline}</p>
                <h3>{category.name}</h3>
                <p>{copy}</p>
              </div>
              <span className="home-card-footer">
                View gallery
                <span aria-hidden="true">+</span>
              </span>
            </Link>
          ))}

          <Link href="/contact" className="home-card">
            <div className="home-card-media">
              <img src={settings.home_cover_contact ?? heroImageUrl} alt="Book a Bay Area photography session" loading="lazy" decoding="async" />
            </div>
            <div className="home-card-body">
              <p className="home-card-kicker">Booking</p>
              <h3>Contact</h3>
              <p>Share your date, location ideas, and what kind of session you want to make.</p>
            </div>
            <span className="home-card-footer">
              Start inquiry
              <span aria-hidden="true">+</span>
            </span>
          </Link>
        </div>
      </section>

      <section className="home-section home-editorial">
        <div className="home-editorial-grid">
          <div className="home-editorial-copy">
            <div>
              <p className="home-kicker">Portraits for the people you keep</p>
              <h2 className="home-title">Clean galleries with a little life left in them.</h2>
            </div>
            <p className="home-copy">
              I keep sessions calm, directed, and fast enough to feel good. The goal is a polished gallery that still feels like the day happened, not like everyone got turned into a template.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/availability" className="home-link">
                Check dates
              </Link>
              <Link href="/pricing/grads" className="home-link" data-variant="ghost">
                See grad rates
              </Link>
            </div>
          </div>

          <div className="home-editorial-media" aria-label="Featured photography">
            <div className="home-stacked-photo" data-size="large">
              <img src={firstPortfolioImage} alt="Bay Area portrait session" loading="lazy" decoding="async" />
            </div>
            <div className="home-stacked-photo" data-size="small">
              <img src={secondPortfolioImage} alt="Family or graduation session detail" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
      </section>

      <section className="home-proof" aria-label="Session highlights">
        <div className="home-section home-proof-grid">
          <div className="home-proof-intro">
            <p className="home-proof-eyebrow">Session system</p>
            <h2 className="home-proof-title">A smoother shoot, from first note to final gallery.</h2>
          </div>
          {[
            ["01", "Direction", "Clear posing without stiff, frozen photos."],
            ["02", "Locations", "SF, Berkeley, Stanford, SJSU, South Bay."],
            ["03", "Gallery", "Clean delivery for sharing and downloading."],
            ["04", "Timing", "Peak campus dates move fast."],
          ].map(([number, title, copy]) => (
            <div key={title} className="home-proof-item">
              <span className="home-proof-number">{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section home-cta">
        <div className="home-cta-panel">
          <div className="home-cta-copy">
            <p className="home-kicker">Grad season moves quickly</p>
            <h2 className="home-title">Lock the date before campus turns chaotic.</h2>
            <p className="home-copy" style={{ marginTop: 22 }}>
              Open dates change fast during spring. Send the date you have in mind and I will confirm timing, location flow, and next steps.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}>
              <Link href="/contact" className="home-link">
                Book a shoot
              </Link>
              <Link href="/grad-guide" className="home-link" data-variant="ghost">
                Graduation guide
              </Link>
            </div>
          </div>
          <div className="home-cta-media">
            <img src={heroImageUrl} alt="Graduation portrait by soloxsnaps" loading="lazy" decoding="async" />
          </div>
        </div>
      </section>

      {instagramImages.length > 0 && (
        <section className="home-section home-strip" aria-label="Instagram preview">
          <div className="home-strip-header">
            <p className="home-kicker" style={{ margin: 0 }}>@soloxsnaps</p>
            <a
              href="https://www.instagram.com/soloxsnaps"
              target="_blank"
              rel="noopener noreferrer"
              className="home-link"
              data-variant="ghost"
            >
              Instagram
            </a>
          </div>
          <div className="home-strip-grid">
            {instagramImages.map((image) => (
              <a
                key={image.id}
                href="https://www.instagram.com/soloxsnaps"
                target="_blank"
                rel="noopener noreferrer"
                className="home-strip-link"
              >
                <img src={image.image_url} alt={image.alt} loading="lazy" decoding="async" />
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
