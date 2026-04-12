import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioData, getSiteSettings, type PortfolioCategory, type PortfolioImage } from "@/lib/professionalData";
import HeroCarousel from "@/app/components/HeroCarousel";

export const dynamic = "force-dynamic";

const title = "soloxsnaps | Bay Area Graduation and Family Photographer";
const description =
  "Bay Area graduation and family photography by Chris Solorzano — honest portraits, warm milestones, and quietly cinematic imagery.";
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

function getCoverForCategory(
  category: PortfolioCategory,
  images: PortfolioImage[],
  fallback: PortfolioImage | undefined,
  index: number
) {
  return images.find((img) => img.category_slug === category.slug) ?? images[index] ?? fallback;
}

const CSS = `
  .pro-img { transition: transform 0.7s ease; display: block; }
  .pro-img-wrap:hover .pro-img { transform: scale(1.04); }
  .pro-card-link { text-decoration: none; display: block; }
  .pro-card-link:hover .pro-card-label { opacity: 0.5; }
  .pro-card-label { transition: opacity 0.2s ease; }
  .pro-insta { transition: opacity 0.25s ease; }
  .pro-insta:hover { opacity: 0.75; }
  @media (max-width: 720px) {
    .about-grid   { grid-template-columns: 1fr !important; }
    .port-grid    { grid-template-columns: 1fr !important; }
    .cats-grid    { grid-template-columns: 1fr !important; }
    .cats-grid > * { border-right: none !important; border-bottom: 1px solid rgba(0,0,0,0.08) !important; }
    .footer-grid  { grid-template-columns: 1fr !important; }
  }
`;

export default async function ProfessionalHomePage() {
  const [{ categories, images }, settings] = await Promise.all([
    getPortfolioData(),
    getSiteSettings(),
  ]);
  const heroImage = images[0];
  const heroImageUrl = heroImage?.image_url ?? profileImage;

  function resolveSettingsCover(key: string, fallback: PortfolioImage | undefined) {
    const url = settings[key];
    if (url) return { image_url: url, alt: key.replace("home_cover_", "") } as PortfolioImage;
    return fallback;
  }

  const visibleCategories = visiblePortfolioSlugs
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter(Boolean) as PortfolioCategory[];

  const portfolioSections = visibleCategories.map((category, index) => ({
    category,
    cover: resolveSettingsCover(`home_cover_${category.slug}`, getCoverForCategory(category, images, heroImage, index)),
    subline: category.slug === "grads" ? "the milestone" : "the people",
  }));

  const carouselImages = images.filter(img => img.hero_carousel).slice(0, 5);
  const heroImages = carouselImages.length > 0 ? carouselImages : images.slice(0, 5);
  const instagramImages = images.slice(0, 8);

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
    <main style={{ background: "#ffffff", color: "#1a1a1a" }}>
      <style>{CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* ── 1. HERO — full viewport, image cycles, name overlaid ── */}
      <HeroCarousel images={heroImages} />

      {/* ── 2. INTRO STATEMENT ── */}
      <section style={{ padding: "100px 40px", textAlign: "center", background: "#fff" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(1.05rem, 2.6vw, 1.55rem)",
          fontWeight: 400,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          lineHeight: 1.9,
          color: "#1a1a1a",
          maxWidth: 660,
          margin: "0 auto 36px",
        }}>
          Photographing the honest,<br />
          for grads and families who feel deeply.
        </p>
        <div style={{ width: 40, height: 1, background: "rgba(0,0,0,0.2)", margin: "0 auto 32px" }} />
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontSize: "clamp(0.95rem, 1.8vw, 1.15rem)",
          color: "#555",
        }}>
          Bay Area Graduation &amp; Family Photographer
        </p>
      </section>

      {/* ── 3. ABOUT ── */}
      <section style={{ padding: "0 60px 120px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="about-grid" style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "80px",
          alignItems: "center",
        }}>
          {/* Photo */}
          <div className="pro-img-wrap" style={{ overflow: "hidden", aspectRatio: "3/4" }}>
            <img
              src={profileImage}
              alt="Chris Solorzano"
              className="pro-img"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          {/* Text */}
          <div>
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: "italic",
              fontSize: "1rem",
              color: "#555",
              marginBottom: 14,
              letterSpacing: "0.04em",
            }}>
              artistry &amp; adventure
            </p>
            <h2 style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(1.3rem, 2.5vw, 2rem)",
              fontWeight: 400,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#111",
              margin: "0 0 24px",
            }}>
              Chris Solorzano
            </h2>
            <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.15)", marginBottom: 28 }} />
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "1.05rem",
              lineHeight: 1.9,
              color: "#555",
              marginBottom: 32,
              maxWidth: 380,
            }}>
              My name is Chris Solorzano — a hopeless romantic, a lover of real light and
              honest stories. I specialize in Bay Area graduation portraits and family sessions,
              always in pursuit of the quiet, ephemeral moments that matter most.
            </p>
            <Link href="/about" style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: "italic",
              fontSize: "0.95rem",
              color: "#111",
              textDecoration: "none",
              borderBottom: "1px solid rgba(0,0,0,0.25)",
              paddingBottom: 2,
              letterSpacing: "0.02em",
            }}>
              learn more about me →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4. CATEGORY CARDS ── */}
      <section style={{ borderTop: "1px solid rgba(0,0,0,0.07)", borderBottom: "1px solid rgba(0,0,0,0.07)", marginBottom: 120 }}>
        <div className="cats-grid" style={{
          display: "grid",
          gridTemplateColumns: `repeat(${portfolioSections.length + 1}, 1fr)`,
          maxWidth: "100%",
        }}>
          {portfolioSections.map(({ category, cover, subline }, index) => (
            <Link
              key={category.slug}
              href={`/portfolio?category=${category.slug}`}
              className="pro-card-link"
              style={{
                borderRight: index < portfolioSections.length ? "1px solid rgba(0,0,0,0.07)" : "none",
                padding: "60px 40px",
                textAlign: "center",
              }}
            >
              {cover && (
                <div className="pro-img-wrap" style={{ overflow: "hidden", marginBottom: 28 }}>
                  <img
                    src={cover.image_url}
                    alt={cover.alt}
                    className="pro-img"
                    style={{ width: "100%", height: 260, objectFit: "cover" }}
                  />
                </div>
              )}
              <h2 className="pro-card-label" style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "clamp(0.9rem, 1.8vw, 1.3rem)",
                fontWeight: 400,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "#1a1a1a",
                margin: "0 0 8px",
              }}>
                {category.name}
              </h2>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontStyle: "italic",
                fontSize: "0.95rem",
                color: "#555",
                margin: "0 0 20px",
              }}>
                {subline}
              </p>
              <div style={{ width: 24, height: 1, background: "rgba(0,0,0,0.15)", margin: "0 auto" }} />
            </Link>
          ))}

          {/* Contact card */}
          <Link
            href="/contact"
            className="pro-card-link"
            style={{ padding: "60px 40px", textAlign: "center" }}
          >
            {(settings["home_cover_contact"] ?? heroImage?.image_url) && (
              <div className="pro-img-wrap" style={{ overflow: "hidden", marginBottom: 28 }}>
                <img
                  src={settings["home_cover_contact"] ?? heroImage!.image_url}
                  alt="Book a session"
                  className="pro-img"
                  style={{ width: "100%", height: 260, objectFit: "cover" }}
                />
              </div>
            )}
            <h2 className="pro-card-label" style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(0.9rem, 1.8vw, 1.3rem)",
              fontWeight: 400,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#1a1a1a",
              margin: "0 0 8px",
            }}>
              Contact
            </h2>
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: "italic",
              fontSize: "0.95rem",
              color: "#555",
              margin: "0 0 20px",
            }}>
              get in touch
            </p>
            <div style={{ width: 24, height: 1, background: "rgba(0,0,0,0.15)", margin: "0 auto" }} />
          </Link>
        </div>
      </section>

      {/* ── 6. TESTIMONIAL ── */}
      <section style={{ padding: "0 60px 120px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            fontSize: "clamp(1.1rem, 2.2vw, 1.45rem)",
            lineHeight: 1.85,
            color: "#444",
            marginBottom: 28,
          }}>
            &ldquo;His superpower is that he&rsquo;s able to capture the indescribable — the
            in-between moments, so packed with emotion they couldn&rsquo;t possibly be
            contained. Chris is an artist, a storyteller, and you can tell he loves
            what he does.&rdquo;
          </p>
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.72rem",
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "#555",
          }}>
            Samantha &amp; Family &nbsp;·&nbsp; Berkeley, CA
          </p>
        </div>
      </section>

      {/* ── 7. INSTAGRAM STRIP ── */}
      {instagramImages.length > 0 && (
        <section style={{ padding: "0 0 0", background: "#fff" }}>
          <p style={{
            textAlign: "center",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.68rem",
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "#555",
            marginBottom: 20,
            paddingTop: 0,
          }}>
            @soloxsnaps
          </p>
          <div style={{ display: "flex", gap: 3, overflowX: "auto" }}>
            {instagramImages.map((image) => (
              <a
                key={image.id}
                href="https://www.instagram.com/soloxsnaps"
                target="_blank"
                rel="noopener noreferrer"
                className="pro-insta"
                style={{ flexShrink: 0, display: "block", overflow: "hidden" }}
              >
                <img
                  src={image.image_url}
                  alt={image.alt}
                  style={{ width: 150, height: 150, objectFit: "cover", display: "block" }}
                />
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
