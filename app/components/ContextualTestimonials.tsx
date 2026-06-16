import type { CSSProperties } from "react";
import { C } from "@/lib/colors";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import type { FeaturedTestimonial } from "@/lib/testimonialsData";

// Contextually-matched social proof (spec §8). Presentational, like
// HomeTestimonials — the page fetches the matched testimonials (via
// getContextualTestimonials) and passes them in. Renders nothing when the list
// is empty, so a placement never ships an empty heading or placeholder cards.
type Props = {
  testimonials: FeaturedTestimonial[];
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  tint?: boolean;
};

export default function ContextualTestimonials({
  testimonials,
  eyebrow = "Client experiences",
  heading = "What clients say",
  subheading,
  tint = false,
}: Props) {
  if (testimonials.length === 0) return null;

  const solo = testimonials.length === 1;

  return (
    <section style={sectionStyle(tint)} aria-label={heading}>
      <div style={shellStyle}>
        <p style={eyebrowStyle}>{eyebrow}</p>
        <h2 style={headingStyle}>{heading}</h2>
        {subheading ? <p style={subheadingStyle}>{subheading}</p> : null}
        <div style={gridStyle(solo)}>
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({ testimonial }: { testimonial: FeaturedTestimonial }) {
  const badge = testimonial.school || testimonial.session_type;
  const meta = [testimonial.location, testimonial.year ? String(testimonial.year) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <figure style={cardStyle}>
      {badge ? <span style={badgeStyle}>{badge}</span> : null}
      <blockquote style={quoteStyle}>{`“${testimonial.message}”`}</blockquote>
      <figcaption style={citeStyle}>
        <Avatar src={testimonial.client_image_url} name={testimonial.display_name} />
        <span style={citeTextStyle}>
          <span style={nameStyle}>{testimonial.display_name}</span>
          <span style={roleStyle}>{meta || "SoloXSnaps Client"}</span>
        </span>
      </figcaption>
      {(testimonial.gallery_url || testimonial.google_review_url) ? (
        <div style={linksStyle}>
          {testimonial.gallery_url ? (
            <a href={testimonial.gallery_url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              View the gallery →
            </a>
          ) : null}
          {testimonial.google_review_url ? (
            <a href={testimonial.google_review_url} target="_blank" rel="noopener noreferrer" style={reviewLinkStyle}>
              ★ Read on Google
            </a>
          ) : null}
        </div>
      ) : null}
    </figure>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <span style={avatarStyle} aria-hidden="true">
        <OptimizedPhoto src={src} alt="" sizes="52px" quality={85} />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return (
    <span style={{ ...avatarStyle, ...avatarFallbackStyle }} aria-hidden="true">
      {initials || "★"}
    </span>
  );
}

// ── Styles (driven by C tokens — no hardcoded hex) ────────────────────────────

function sectionStyle(tint: boolean): CSSProperties {
  return {
    padding: "72px 0",
    background: tint ? C.proPage : "transparent",
  };
}

const shellStyle: CSSProperties = {
  width: "min(1100px, calc(100% - 48px))",
  margin: "0 auto",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: C.proAccent,
  fontSize: 12,
  fontWeight: 820,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const headingStyle: CSSProperties = {
  margin: "10px 0 0",
  color: C.ink,
  fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
  fontWeight: 880,
  letterSpacing: "-0.02em",
  lineHeight: 1.05,
  textWrap: "balance",
};

const subheadingStyle: CSSProperties = {
  margin: "12px 0 0",
  color: C.muted,
  fontSize: 16,
  lineHeight: 1.6,
  maxWidth: 560,
};

function gridStyle(solo: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: solo ? "minmax(0, 620px)" : "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 18,
    marginTop: 32,
  };
}

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
  margin: 0,
  padding: 28,
  borderRadius: 18,
  background: C.white,
  border: `1px solid ${C.proBorder}`,
  boxShadow: C.proShadow,
};

const badgeStyle: CSSProperties = {
  alignSelf: "flex-start",
  padding: "6px 12px",
  borderRadius: 999,
  background: C.proAccentSoft,
  border: `1px solid ${C.proAccentBorder}`,
  color: C.proAccentDark,
  fontSize: 11,
  fontWeight: 820,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const quoteStyle: CSSProperties = {
  margin: 0,
  color: C.inkSoft,
  fontSize: 17,
  lineHeight: 1.72,
  textWrap: "pretty",
};

const citeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  marginTop: "auto",
};

const avatarStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 52,
  height: 52,
  borderRadius: 999,
  overflow: "hidden",
  background: C.proAccentSoft,
};

const avatarFallbackStyle: CSSProperties = {
  color: C.proAccentDark,
  fontSize: 16,
  fontWeight: 820,
};

const citeTextStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const nameStyle: CSSProperties = {
  color: C.ink,
  fontSize: 15,
  fontWeight: 820,
};

const roleStyle: CSSProperties = {
  color: C.muted,
  fontSize: 13,
  fontWeight: 600,
};

const linksStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px 20px",
  paddingTop: 4,
};

const linkStyle: CSSProperties = {
  color: C.proAccent,
  fontSize: 13,
  fontWeight: 820,
  textDecoration: "none",
};

const reviewLinkStyle: CSSProperties = {
  ...linkStyle,
  color: C.muted,
};
