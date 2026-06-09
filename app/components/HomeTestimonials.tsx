import Link from "next/link";
import type { FeaturedTestimonial } from "@/lib/testimonialsData";
import styles from "@/app/(professional)/home.module.css";
import responsive from "@/app/(professional)/homeResponsive.module.css";
import local from "@/app/components/HomeTestimonials.module.css";

// Featured client testimonials — homepage social proof for the graduation and
// portrait services. Renders nothing when no testimonials qualify, so the
// section never ships an empty heading or placeholder cards.
export default function HomeTestimonials({ testimonials }: { testimonials: FeaturedTestimonial[] }) {
  if (testimonials.length === 0) return null;
  const solo = testimonials.length === 1;

  return (
    <section
      className={`${styles.section} ${styles.tint} ${responsive.section}`}
      aria-labelledby="testimonials-heading"
    >
      <div className={`${styles.shell} ${responsive.shell}`}>
        <div className={local.header}>
          <p className={styles.eyebrow}>Client experiences</p>
          <h2 id="testimonials-heading" className={styles.title}>
            What It&rsquo;s Like to Work With Me
          </h2>
          <p className={styles.copy}>
            A comfortable, guided photography experience from the first conversation to the final gallery.
          </p>
        </div>

        <div className={`${local.grid} ${solo ? local.solo : ""}`}>
          {testimonials.map((testimonial, index) => (
            <article key={testimonial.id} className={local.card} data-reveal data-delay={String((index % 2) + 1)}>
              {testimonial.session_type ? (
                <span className={local.badge}>{testimonial.session_type}</span>
              ) : null}
              <blockquote className={local.quote}>
                <p className={local.quoteText}>{`“${testimonial.message}”`}</p>
                <footer className={local.cite}>
                  <span className={local.name}>{testimonial.display_name}</span>
                  <span className={local.role}>SoloXSnaps Client</span>
                </footer>
              </blockquote>
            </article>
          ))}
        </div>

        <div className={local.cta} data-reveal>
          <h3 className={local.ctaHeading}>Ready to Create Your Own Photos?</h3>
          <div className={`${styles.actions} ${local.actions}`}>
            <Link href="/contact" className={styles.button}>Inquire About a Session</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
