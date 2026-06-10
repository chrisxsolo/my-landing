import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import styles from "@/app/(professional)/home.module.css";
import details from "@/app/(professional)/homeDetails.module.css";
import responsive from "@/app/(professional)/homeResponsive.module.css";

const PROCESS = [
  ["01", "Plan", "Choose your session, location, and preferred date."],
  ["02", "Prepare", "Receive clear outfit, timing, location, and arrival guidance."],
  ["03", "Photograph", "Get full posing direction and natural movement prompts throughout your session."],
  ["04", "Receive", "Download your professionally edited photographs from a private online gallery."],
] as const;

export default function HomeAboutExperience({
  aboutPortrait,
}: {
  aboutPortrait: { image_url: string; alt: string };
}) {
  return (
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
            <p className={styles.eyebrow}>The photographer and the experience</p>
            <h2 className={styles.title}>Hi, I&rsquo;m Chris</h2>
            <p className={styles.copy}>
              I am a San Francisco-based photographer specializing in graduation and couples
              portraits throughout the Bay Area. Most of my clients are not professional models, so
              I provide clear posing guidance while keeping the experience relaxed, natural, and
              personal.
            </p>
            <div className={styles.actions}>
              <Link href="/about" className={styles.button}>More About Chris</Link>
              <Link href="/availability" className={`${styles.button} ${styles.buttonGhost}`}>
                View Availability
              </Link>
            </div>
          </div>
        </div>

        <div className={`${styles.stepsGrid} ${responsive.stepsGrid}`} style={{ marginTop: 48 }}>
          {PROCESS.map(([number, title, copy]) => (
            <article key={number} className={styles.processStep} data-reveal>
              <span className={styles.processNumber}>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>

        <p className={styles.copy}>
          Your booking details, preparation resources, editing status, and gallery are organized
          inside your private client dashboard.
        </p>
      </div>
    </section>
  );
}
