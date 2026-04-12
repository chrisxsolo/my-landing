import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | soloxsnaps",
  description: "Meet Chris Solorzano, the San Francisco based photographer behind soloxsnaps.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About | soloxsnaps",
    description: "Meet Chris Solorzano, the San Francisco based photographer behind soloxsnaps.",
    type: "profile",
  },
};

const portrait =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/DSC02593_(2).jpg";

const process = [
  ["01", "Planning",  "Location, timing, outfit notes, and the reason for the session get set before we shoot."],
  ["02", "Session",   "I give clear direction, then leave enough room for the in-between moments to happen naturally."],
  ["03", "Delivery",  "The final gallery is edited cleanly and delivered in a private online space, ready to share."],
];

const CSS = `
  .about-pro-img { transition: transform 0.7s ease; }
  .about-pro-wrap:hover .about-pro-img { transform: scale(1.03); }
  .pro-step:not(:last-child) { border-bottom: 1px solid rgba(0,0,0,0.07); }
  @media (max-width: 720px) {
    .about-hero-grid { grid-template-columns: 1fr !important; }
    .about-approach-grid { grid-template-columns: 1fr !important; }
    .about-process-grid { grid-template-columns: 1fr !important; }
  }
`;

export default function ProfessionalAboutPage() {
  return (
    <main style={{ background: "#fff", color: "#1a1a1a", paddingTop: 80 }}>
      <style>{CSS}</style>

      {/* ── PAGE HEADER ── */}
      <section style={{ padding: "80px 60px 80px", textAlign: "center" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.7rem",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "#555",
          marginBottom: 20,
        }}>
          All about Chris
        </p>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(2.5rem, 7vw, 6rem)",
          fontWeight: 300,
          letterSpacing: "0.06em",
          color: "#111",
          lineHeight: 1.05,
          margin: "0 auto 28px",
          maxWidth: 800,
        }}>
          I&rsquo;m Chris.
        </h1>
        <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.15)", margin: "0 auto" }} />
      </section>

      {/* ── HERO — photo + intro text ── */}
      <section style={{ padding: "0 60px 100px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="about-hero-grid" style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: "72px",
          alignItems: "end",
        }}>
          <div className="about-pro-wrap" style={{ overflow: "hidden" }}>
            <img
              src={portrait}
              alt="Chris Solorzano"
              className="about-pro-img"
              style={{ width: "100%", maxHeight: 780, objectFit: "cover", display: "block" }}
            />
          </div>
          <div style={{ paddingBottom: 16 }}>
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: "italic",
              fontSize: "1rem",
              color: "#555",
              marginBottom: 16,
            }}>
              photographer, bay area
            </p>
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "1.1rem",
              lineHeight: 1.9,
              color: "#555",
              marginBottom: 32,
            }}>
              I photograph people with a clean, direct style built around light, timing,
              and calm direction. The work is polished, but the session should still feel
              like a real person made space for you.
            </p>
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "1.1rem",
              lineHeight: 1.9,
              color: "#555",
              marginBottom: 40,
            }}>
              My work spans Bay Area graduation portraits, families, individual portraits,
              and creative sessions. The common thread is simple: strong light, clean
              composition, and images that still feel like the moment.
            </p>
            <Link
              href="/contact"
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.78rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#fff",
                background: "#1a1a1a",
                padding: "14px 32px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Work with me
            </Link>
          </div>
        </div>
      </section>

      {/* ── APPROACH ── */}
      <section style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: "100px 60px",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        <div className="about-approach-grid" style={{
          display: "grid",
          gridTemplateColumns: "0.65fr 1.35fr",
          gap: "80px",
          alignItems: "start",
        }}>
          <div>
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "0.7rem",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#555",
              marginBottom: 20,
            }}>
              Approach
            </p>
            <h2 style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(1.6rem, 3.5vw, 3rem)",
              fontWeight: 300,
              letterSpacing: "0.04em",
              color: "#111",
              lineHeight: 1.2,
              margin: 0,
            }}>
              Direction without the stiffness.
            </h2>
          </div>
          <div>
            <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "1.05rem", lineHeight: 1.9, color: "#555", marginBottom: 24 }}>
              Sessions are built to feel clear and easy. I help with posing, pacing, location choices,
              and small adjustments so the final gallery feels intentional without flattening the person
              in front of the camera.
            </p>
            <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "1.05rem", lineHeight: 1.9, color: "#555", marginBottom: 24 }}>
              My work spans Bay Area graduation portraits, individual portraits, small events, and
              creative sessions. The common thread: strong light, clean composition, and images that
              still feel like the moment.
            </p>
            <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "1.05rem", lineHeight: 1.9, color: "#555" }}>
              soloxsnaps is the professional home for that work. The warmer guides and behind-the-scenes
              journal live on the fun side of the site.
            </p>
          </div>
        </div>
      </section>

      {/* ── PROCESS ── */}
      <section style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: "100px 60px",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        <div className="about-process-grid" style={{
          display: "grid",
          gridTemplateColumns: "0.65fr 1.35fr",
          gap: "80px",
          alignItems: "start",
        }}>
          <div>
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "0.7rem",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#555",
              marginBottom: 20,
            }}>
              How it works
            </p>
            <h2 style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(1.6rem, 3.5vw, 3rem)",
              fontWeight: 300,
              letterSpacing: "0.04em",
              color: "#111",
              lineHeight: 1.2,
              margin: 0,
            }}>
              A simple rhythm from first note to final gallery.
            </h2>
          </div>
          <div>
            {process.map(([number, name, body]) => (
              <div key={name} className="pro-step" style={{ padding: "32px 0" }}>
                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 24, alignItems: "start" }}>
                  <p style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "2rem",
                    fontWeight: 300,
                    color: "#555",
                    margin: 0,
                    lineHeight: 1,
                  }}>
                    {number}
                  </p>
                  <div>
                    <h3 style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontSize: "1.2rem",
                      fontWeight: 400,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#1a1a1a",
                      margin: "0 0 10px",
                    }}>
                      {name}
                    </h3>
                    <p style={{ fontSize: "0.9rem", lineHeight: 1.75, color: "#555", margin: 0 }}>
                      {body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: "100px 60px",
        textAlign: "center",
        background: "#fff",
      }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
          color: "#555",
          marginBottom: 36,
          maxWidth: 560,
          margin: "0 auto 36px",
          lineHeight: 1.7,
        }}>
          Ready to see what this could look like for you?
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/investment" style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.75rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#fff",
            background: "#1a1a1a",
            padding: "14px 32px",
            textDecoration: "none",
          }}>
            View investment
          </Link>
          <Link href="/contact" style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.75rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#1a1a1a",
            border: "1px solid rgba(0,0,0,0.2)",
            padding: "14px 32px",
            textDecoration: "none",
          }}>
            Get in touch
          </Link>
        </div>
      </section>
    </main>
  );
}
