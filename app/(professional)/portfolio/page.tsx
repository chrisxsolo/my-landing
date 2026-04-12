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
  .port-figure { overflow: hidden; }
  .port-img { display: block; }
  .port-filter-link { transition: color 0.2s ease, border-color 0.2s ease; text-decoration: none; }
  .port-filter-link:hover { color: #111 !important; }
`;

function imageRatio(index: number) {
  return ["4/5", "1/1", "3/4", "5/4", "2/3", "4/3"][index % 6];
}

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
    <main style={{ background: "#fff", color: "#1a1a1a", paddingTop: 80 }}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <section style={{ padding: "80px 60px 60px", textAlign: "center" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.7rem",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "#bbb",
          marginBottom: 20,
        }}>
          Portfolio
        </p>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(2rem, 5.5vw, 5rem)",
          fontWeight: 300,
          letterSpacing: "0.06em",
          color: "#111",
          lineHeight: 1.1,
          margin: "0 auto 28px",
          maxWidth: 800,
        }}>
          {selected?.name ?? "Selected work"}
        </h1>
        <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.12)", margin: "0 auto 28px" }} />
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontSize: "1rem",
          color: "#aaa",
          marginBottom: 40,
        }}>
          {selected?.description ?? "Graduation and family sessions across the Bay Area."}
        </p>

        {/* Category filters */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 24px" }}>
          <Link
            href="/portfolio"
            className="port-filter-link"
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "0.72rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: !selectedCategory ? "#111" : "#bbb",
              borderBottom: !selectedCategory ? "1px solid #111" : "1px solid transparent",
              paddingBottom: 2,
            }}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/portfolio?category=${cat.slug}`}
              className="port-filter-link"
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.72rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: selectedCategory === cat.slug ? "#111" : "#bbb",
                borderBottom: selectedCategory === cat.slug ? "1px solid #111" : "1px solid transparent",
                paddingBottom: 2,
              }}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </section>

      {/* ── GRID ── */}
      <section style={{ padding: "0 20px 100px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          {filteredImages.length > 0 ? (
            <div style={{ columns: "1", columnGap: 8 }} className="port-masonry">
              <style>{`
                @media (min-width: 640px)  { .port-masonry { columns: 2 !important; } }
                @media (min-width: 1024px) { .port-masonry { columns: 3 !important; } }
              `}</style>
              {filteredImages.map((image, index) => (
                <figure
                  key={image.id}
                  className="port-figure"
                  style={{
                    position: "relative",
                    marginBottom: 8,
                    breakInside: "avoid",
                    aspectRatio: imageRatio(index),
                  }}
                >
                  <img
                    src={image.image_url}
                    alt={image.alt}
                    className="port-img"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </figure>
              ))}
            </div>
          ) : (
            <div style={{
              border: "1px solid rgba(0,0,0,0.07)",
              padding: "60px 40px",
              textAlign: "center",
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: "italic",
              color: "#bbb",
            }}>
              No portfolio images yet.
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: "80px 60px",
        textAlign: "center",
      }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontSize: "clamp(1rem, 2.2vw, 1.3rem)",
          color: "#888",
          marginBottom: 32,
        }}>
          Like what you see?
        </p>
        <Link href="/contact" style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.75rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#fff",
          background: "#1a1a1a",
          padding: "14px 36px",
          textDecoration: "none",
          display: "inline-block",
        }}>
          Inquire now
        </Link>
      </section>
    </main>
  );
}
