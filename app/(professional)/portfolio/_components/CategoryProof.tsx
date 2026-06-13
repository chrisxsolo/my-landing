import type { FeaturedTestimonial } from "@/lib/testimonialsData";
import styles from "@/app/(professional)/portfolio/Portfolio.module.css";

// Social proof for the current portfolio view: client testimonials matched to
// the selected category. Renders nothing when none qualify, so the page never
// ships an empty heading or placeholder card.
export default function CategoryProof({ testimonials }: { testimonials: FeaturedTestimonial[] }) {
  if (testimonials.length === 0) return null;

  return (
    <section className={styles.portProof} aria-labelledby="portfolio-proof-heading">
      <div className={styles.portProofInner}>
        <p className={styles.portProofEyebrow}>Client experiences</p>
        <h2 id="portfolio-proof-heading" className={styles.portProofHeading}>
          What clients say
        </h2>
        <div className={styles.portProofGrid}>
          {testimonials.map((testimonial) => (
            <figure key={testimonial.id} className={styles.portProofCard}>
              {testimonial.session_type ? (
                <span className={styles.portProofBadge}>{testimonial.session_type}</span>
              ) : null}
              <blockquote className={styles.portProofQuote}>
                {`“${testimonial.message}”`}
              </blockquote>
              <figcaption className={styles.portProofCite}>{testimonial.display_name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
