import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import Testimonials from "@/app/components/Testimonials";
import type { Testimonial } from "@/lib/testimonials";
import type { FeaturedSession } from "@/lib/homepageData";
import type { PortfolioImage } from "@/lib/professionalData";
import styles from "@/app/(professional)/home.module.css";
import details from "@/app/(professional)/homeDetails.module.css";
import responsive from "@/app/(professional)/homeResponsive.module.css";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";

type HomeImage = Pick<PortfolioImage, "id" | "image_url" | "alt" | "category_slug">;

const TRUST_ITEMS = [
  "Based in San Francisco",
  "Clear posing guidance",
  "Private online galleries",
  `Standard ${PRICING_CATALOG.standardTurnaroundDays / 7}-week turnaround`,
  "Organized client dashboard",
] as const;

const PROCESS = [
  ["01", "Choose your session and date", "Compare session options, pricing, and galleries, then select the date and time that work for you."],
  ["02", "Complete the invoice and contract", "Confirm your booking with a straightforward invoice and contract — no back-and-forth guesswork."],
  ["03", "Plan, shoot, and receive your gallery", "Get preparation guidance before the shoot, enjoy guided posing on the day, and download your edited gallery from a private link."],
] as const;

function ServiceCard({
  href,
  image,
  eyebrow,
  title,
  copy,
  cta,
}: {
  href: string;
  image: HomeImage;
  eyebrow: string;
  title: string;
  copy: string;
  cta: string;
}) {
  return (
    <Link href={href} className={`${styles.serviceCard} ${responsive.serviceCard}`}>
      <div className={styles.serviceImage}>
        <OptimizedPhoto src={image.image_url} alt={image.alt} sizes="(max-width: 760px) 100vw, 38vw" />
      </div>
      <div className={styles.serviceBody}>
        <span className={styles.sessionMeta}>{eyebrow}</span>
        <h3>{title}</h3>
        <p>{copy}</p>
        <span className={styles.cardCta}>{cta} →</span>
      </div>
    </Link>
  );
}

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

export default function HomeStorySections({
  cardGrads,
  cardCouples,
  cardPortrait,
  storyImages,
  featuredSessions,
  testimonials,
}: {
  cardGrads: HomeImage;
  cardCouples: HomeImage;
  cardPortrait: HomeImage;
  storyImages: HomeImage[];
  featuredSessions: FeaturedSession[];
  testimonials: Testimonial[];
}) {
  return (
    <>
      <section className={styles.trust} aria-label="SoloXSnaps service standards">
        <div className={`${styles.shell} ${responsive.shell}`}>
          <div className={`${styles.trustGrid} ${responsive.trustGrid}`}>
            {TRUST_ITEMS.map((item) => (
              <div key={item} className={`${styles.trustItem} ${responsive.trustItem}`}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Testimonials
        kicker="What clients say"
        title="What clients say about their sessions"
        items={testimonials.slice(0, 2)}
      />

      <section id="sessions" className={`${styles.section} ${styles.tint} ${responsive.section}`}>
        <div className={`${styles.shell} ${responsive.shell}`}>
          <div className={`${styles.headerRow} ${responsive.headerRow}`}>
            <div>
              <p className={styles.eyebrow}>Choose your session</p>
              <h2 className={styles.title}>A clear place to start, whatever you are celebrating</h2>
            </div>
            <p className={`${styles.copy} ${responsive.headerRowCopy}`}>
              Every session includes practical planning, clear direction, and a straightforward path from inquiry to gallery.
            </p>
          </div>
          <div className={`${styles.serviceGrid} ${responsive.serviceGrid}`}>
            <ServiceCard
              href="/pricing/grads"
              image={cardGrads}
              eyebrow="Primary specialty"
              title="Graduation Photography"
              copy="Campus sessions built around your school, personality, milestone, and the locations that matter."
              cta="Explore Graduation Sessions"
            />
            <ServiceCard
              href="/pricing/couples"
              image={cardCouples}
              eyebrow="Couples and engagements"
              title="Couples Sessions"
              copy="Movement-led portraits for engagements, proposals, anniversaries, and ordinary chapters worth keeping."
              cta="Explore Couples Sessions"
            />
            <ServiceCard
              href="/pricing/families"
              image={cardPortrait}
              eyebrow="Families and portraits"
              title="Family & Portrait Sessions"
              copy="Natural portraits for families, individuals, maternity sessions, and personal milestones."
              cta="Explore Family & Portrait Sessions"
            />
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.paper} ${responsive.section}`}>
        <div className={`${styles.shell} ${responsive.shell}`}>
          <div className={`${styles.headerRow} ${responsive.headerRow}`}>
            <div>
              <p className={styles.eyebrow}>The work</p>
              <h2 className={styles.title}>Bright, natural photographs that still feel like you</h2>
            </div>
            <div>
              <p className={`${styles.copy} ${responsive.headerRowCopy}`}>
                You do not need to know how to pose. I will guide flattering positions,
                natural movement, and expressions while leaving room for the moments in between.
              </p>
              <div className={styles.actions}>
                <Link href="/portfolio" className={`${styles.button} ${styles.buttonGhost}`}>
                  View the Portfolio
                </Link>
              </div>
            </div>
          </div>
          <div className={`${styles.storyGrid} ${responsive.storyGrid}`} aria-label="Featured photography">
            {storyImages.map((image, index) => (
              <div key={image.id} className={`${styles.storyImage} ${responsive.storyImage}`} data-reveal data-delay={String((index % 5) + 1)}>
                <OptimizedPhoto
                  src={image.image_url}
                  alt={image.alt}
                  sizes="(max-width: 760px) 100vw, 40vw"
                  quality={index === 0 ? 90 : 85}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {featuredSessions.length > 0 ? (
        <section className={`${styles.section} ${styles.paper} ${responsive.section}`}>
          <div className={`${styles.shell} ${responsive.shell}`}>
            <div className={`${styles.headerRow} ${responsive.headerRow}`}>
              <div>
                <p className={styles.eyebrow}>Explore real sessions</p>
                <h2 className={styles.title}>See how a complete session comes together</h2>
              </div>
              <p className={`${styles.copy} ${responsive.headerRowCopy}`}>
                Move beyond isolated highlights and see the environmental portraits, candid moments, and close-ups that make a full gallery.
              </p>
            </div>
            <div className={`${styles.sessionGrid} ${responsive.sessionGrid}`}>
              {featuredSessions.map((session) => (
                <Link key={session.href} href={session.href} className={`${styles.sessionCard} ${responsive.sessionCard}`}>
                  <div className={styles.sessionImage}>
                    <OptimizedPhoto src={session.imageUrl} alt={session.imageAlt} sizes="(max-width: 760px) 100vw, 33vw" />
                  </div>
                  <div className={styles.sessionBody}>
                    <span className={styles.sessionMeta}>{session.location}</span>
                    <h3>{session.title}</h3>
                    <p>{session.description}</p>
                    <span className={styles.cardCta}>View the Full Session →</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className={styles.actions}>
              <Link href="/blog" className={`${styles.button} ${styles.buttonGhost}`}>View More Galleries</Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className={`${styles.section} ${styles.tint} ${responsive.section}`}>
        <div className={`${styles.shell} ${responsive.shell}`}>
          <p className={styles.eyebrow}>The client experience</p>
          <h2 className={styles.title}>A simple, guided experience from inquiry to gallery</h2>
          <p className={styles.copy}>
            You will know what happens next at every stage, with preparation resources,
            session guidance, and gallery updates organized in one place.
          </p>
          <div className={`${styles.processGrid} ${responsive.processGrid}`} style={{ marginTop: 38 }}>
            {PROCESS.map(([number, title, copy]) => (
              <article key={number} className={styles.processStep} data-reveal>
                <span className={styles.processNumber}>{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <div className={details.split} style={{ marginTop: 48 }}>
            <div data-reveal="left">
              <p className={styles.eyebrow}>Private client dashboard</p>
              <h3 className={styles.title}>Everything for your session, in one place</h3>
              <p className={styles.copy}>
                From booking onward, a private dashboard holds your session plan, location
                details, preparation reminders, editing status, and final gallery link — so you
                always know what happens next.
              </p>
            </div>
            <div data-reveal data-delay="2"><DashboardPreview /></div>
          </div>
          <div className={styles.actions}>
            <Link href="/availability" className={styles.button}>Check Availability</Link>
          </div>
        </div>
      </section>
    </>
  );
}
