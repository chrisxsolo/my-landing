import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import type { PortfolioImage } from "@/lib/professionalData";
import styles from "@/app/(professional)/home.module.css";
import responsive from "@/app/(professional)/homeResponsive.module.css";

type HeroImage = Pick<PortfolioImage, "image_url" | "alt">;

export default function HomeHero({
  primaryImage,
  secondaryImage,
}: {
  primaryImage: HeroImage;
  secondaryImage?: HeroImage;
}) {
  return (
    <section className={`${styles.hero} ${responsive.hero}`}>
      <div className={`${styles.shell} ${responsive.shell}`}>
        <div className={`${styles.heroGrid} ${responsive.heroGrid}`}>
          <div data-reveal="left">
            <p className={styles.eyebrow}>San Francisco and the Bay Area</p>
            <h1 className={`${styles.heroTitle} ${responsive.heroTitle}`}>
              Bay Area Graduation &amp; Couples Photographer
            </h1>
            <p className={styles.heroCopy}>
              Bright, natural portraits with clear posing guidance for graduates, couples,
              and families. You will know what to do, what happens next, and what your
              session costs before you book.
            </p>
            <div className={styles.actions}>
              <Link href="/availability" className={styles.button}>
                Check Availability
              </Link>
              <Link href="#sessions" className={`${styles.button} ${styles.buttonGhost}`}>
                Explore Sessions
              </Link>
            </div>
          </div>

          <div className={`${styles.heroMedia} ${responsive.heroMedia}`} data-reveal data-delay="2">
            <div className={`${styles.heroPrimary} ${responsive.heroPrimary}`}>
              <OptimizedPhoto
                src={primaryImage.image_url}
                alt={primaryImage.alt}
                sizes="(max-width: 820px) 92vw, 52vw"
                priority
                quality={90}
                objectPosition="center 28%"
              />
            </div>
            {secondaryImage ? (
              <div className={`${styles.heroSecondary} ${responsive.heroSecondary}`}>
                <OptimizedPhoto
                  src={secondaryImage.image_url}
                  alt={secondaryImage.alt}
                  sizes="(max-width: 820px) 34vw, 20vw"
                  quality={85}
                />
              </div>
            ) : null}
            <div className={`${styles.heroNote} ${responsive.heroNote}`}>
              Guided posing, practical planning, and a private dashboard after booking.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
