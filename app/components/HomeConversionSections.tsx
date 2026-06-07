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

const PRICING = [
  {
    title: "Graduation Sessions",
    copy: "Guided on-campus sessions with time for individual portraits, landmark locations, and photographs with friends or family.",
    href: "/pricing/grads",
    cta: "View Graduation Pricing",
  },
  {
    title: "Couples Sessions",
    copy: "Choose a shorter focused session or more time for movement, outfits, locations, engagements, and proposals.",
    href: "/pricing/couples",
    cta: "View Couples Pricing",
  },
  {
    title: "Family & Portrait Sessions",
    copy: "Natural, guided portraits for families, maternity, individuals, and personal milestones throughout the Bay Area.",
    href: "/pricing/families",
    cta: "View Portrait Pricing",
  },
] as const;

function DashboardPreview() {
  return (
    <div className={details.dashboard} aria-label="Example SoloXSnaps client dashboard">
      <div className={details.dashboardBar}>
        <div className={details.dashboardDots} aria-hidden="true"><span /><span /><span /></div>
        <span>Example client dashboard</span>
      </div>
      <div className={details.dashboardPanel}>
        <p className={details.dashboardLabel}>Graduation session</p>
        <h3>Your gallery is in editing</h3>
        <div className={details.progress} aria-hidden="true"><span /></div>
        <div className={details.dashboardGrid}>
          {[
            ["Session plan", "Campus route, date, and start time"],
            ["Preparation", "Outfit and arrival reminders"],
            ["Editing status", "Progress from booked to gallery ready"],
            ["Gallery access", "Private delivery link when complete"],
          ].map(([title, copy]) => (
            <div key={title} className={details.dashboardTile}>
              <strong>{title}</strong>
              <span>{copy}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomeConversionSections({
  aboutPortrait,
}: {
  aboutPortrait: { image_url: string; alt: string };
}) {
  return (
    <>
      <section className={`${styles.section} ${styles.paper} ${responsive.section}`}>
        <div className={`${styles.shell} ${responsive.shell}`}>
          <div className={details.split}>
            <div data-reveal="left">
              <p className={styles.eyebrow}>Private client dashboard</p>
              <h2 className={styles.title}>Your session, organized in one place</h2>
              <p className={styles.copy}>
                After booking, you will receive a private dashboard containing your session plan,
                location details, reminders, editing status, and final gallery link.
              </p>
              <ul className={details.featureList}>
                <li>Session information and location details</li>
                <li>Preparation reminders before shoot day</li>
                <li>Editing and delivery status updates</li>
                <li>Final private gallery access</li>
              </ul>
              <div className={styles.actions}>
                <Link href="/faq" className={`${styles.button} ${styles.buttonGhost}`}>Learn How Booking Works</Link>
                <Link href="/login" className={`${styles.button} ${styles.buttonGhost}`}>Client Login</Link>
              </div>
            </div>
            <div data-reveal data-delay="2"><DashboardPreview /></div>
          </div>
        </div>
      </section>

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

      <section className={`${styles.section} ${styles.paper} ${responsive.section}`}>
        <div className={`${styles.shell} ${responsive.shell}`}>
          <p className={styles.eyebrow}>Transparent pricing</p>
          <h2 className={styles.title}>Clear pricing before you inquire</h2>
          <p className={styles.copy}>
            Review current session options, package inclusions, and available add-ons before choosing what fits your plans.
          </p>
          <div className={details.pricingGrid} style={{ marginTop: 38 }}>
            {PRICING.map((item) => (
              <article key={item.href} className={details.pricingCard}>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
                <Link href={item.href}>{item.cta} →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
