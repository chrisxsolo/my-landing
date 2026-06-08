import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import styles from "@/app/(professional)/home.module.css";
import details from "@/app/(professional)/homeDetails.module.css";
import responsive from "@/app/(professional)/homeResponsive.module.css";

const SCHOOLS = [
  ["UC Berkeley", "/grads/uc-berkeley"],
  ["San Jose State", "/grads/sjsu"],
  ["SF State", "/grads/sf-state"],
  ["University of San Francisco", "/grads/usf"],
  ["CSU East Bay", "/grads/csueb"],
] as const;

export default function HomeConversionSections({
  aboutPortrait,
}: {
  aboutPortrait: { image_url: string; alt: string };
}) {
  return (
    <>
      <section className={`${styles.section} ${styles.tint} ${responsive.section}`}>
        <div className={`${styles.shell} ${responsive.shell}`}>
          <div className={details.split}>
            <div className={details.portrait} data-reveal="scale">
              <OptimizedPhoto
                src={aboutPortrait.image_url}
                alt={aboutPortrait.alt}
                sizes="(max-width: 920px) 92vw, 44vw"
                quality={90}
              />
            </div>
            <div data-reveal="left">
              <p className={styles.eyebrow}>The person behind the camera</p>
              <h2 className={styles.title}>Hi, I&rsquo;m Chris</h2>
              <p className={styles.copy}>
                I am a San Francisco-based photographer specializing in graduation and couples portraits
                throughout the Bay Area. I built SoloXSnaps by photographing real people who often told me
                they felt awkward or unsure in front of the camera.
              </p>
              <p className={styles.copy}>
                My approach combines clear direction with natural movement, so you are never left wondering
                what to do while still receiving photographs that feel relaxed and personal.
              </p>
              <div className={styles.actions}>
                <Link href="/about" className={styles.button}>More About Chris</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.paper} ${responsive.section}`}>
        <div className={`${styles.shell} ${responsive.shell}`}>
          <div className={`${styles.headerRow} ${responsive.headerRow}`}>
            <div>
              <p className={styles.eyebrow}>Campus expertise</p>
              <h2 className={styles.title}>Graduation photography across the Bay Area</h2>
            </div>
            <p className={`${styles.copy} ${responsive.headerRowCopy}`}>
              Campus-specific sessions with guidance on locations, timing, lighting, crowds, outfits, and posing.
            </p>
          </div>
          <div className={details.schoolGrid}>
            {SCHOOLS.map(([name, href], index) => (
              <Link key={href} href={href} className={details.schoolCard}>
                <span className={details.schoolIndex}>{String(index + 1).padStart(2, "0")}</span>
                <h3>{name}</h3>
                <span>Explore graduation sessions →</span>
              </Link>
            ))}
          </div>
          <div className={styles.actions}>
            <Link href="/pricing/grads" className={styles.button}>Explore Graduation Photography</Link>
            <Link href="/grad-guide" className={`${styles.button} ${styles.buttonGhost}`}>Read the Graduation Guide</Link>
          </div>
        </div>
      </section>
    </>
  );
}
