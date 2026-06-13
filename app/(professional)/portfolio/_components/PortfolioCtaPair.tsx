import Link from "next/link";
import styles from "@/app/(professional)/portfolio/Portfolio.module.css";

// Two-button CTA bookend for the portfolio page: category-aware pricing on the
// left, availability on the right. Replaces the old single "Inquire now" link.
export default function PortfolioCtaPair({
  pricingHref,
  pricingLabel,
}: {
  pricingHref: string;
  pricingLabel: string;
}) {
  return (
    <section className={styles.portCta}>
      <p className={styles.portCtaEyebrow}>Ready to book?</p>
      <h2 className={styles.portCtaHeading}>Like what you see?</h2>
      <div className={styles.portCtaActions}>
        <Link href="/availability" className={styles.portCtaLink}>
          Check availability
        </Link>
        <Link href={pricingHref} className={`${styles.portCtaLink} ${styles.portCtaLinkGhost}`}>
          {pricingLabel}
        </Link>
      </div>
    </section>
  );
}
