import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import type { FeaturedSession } from "@/lib/homepageData";
import type { PortfolioImage } from "@/lib/professionalData";
import styles from "@/app/(professional)/home.module.css";
import responsive from "@/app/(professional)/homeResponsive.module.css";

type HomeImage = Pick<PortfolioImage, "id" | "image_url" | "alt" | "category_slug">;

const TRUST_ITEMS = [
  "Based in San Francisco",
  "Clear posing guidance",
  "Private online galleries",
  "Standard two-week turnaround",
  "Organized client dashboard",
] as const;

const PROCESS = [
  ["01", "Choose your session", "Compare session options, pricing, galleries, and location resources."],
  ["02", "Confirm your date", "Select the date and time, then complete the invoice and contract."],
  ["03", "Plan the details", "Receive location, lighting, outfit, and preparation guidance before the shoot."],
  ["04", "Enjoy the session", "Chris guides poses, movement, expressions, and location changes throughout."],
  ["05", "Follow gallery progress", "Use the private dashboard for reminders, editing progress, and status updates."],
  ["06", "Receive your photographs", "Download the professionally edited gallery through a private online link."],
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

export default function HomeStorySections({
  cardGrads,
  cardCouples,
  cardPortrait,
  storyImages,
  featuredSessions,
}: {
  cardGrads: HomeImage;
  cardCouples: HomeImage;
  cardPortrait: HomeImage;
  storyImages: HomeImage[];
  featuredSessions: FeaturedSession[];
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
              title="Portrait Sessions"
              copy="Natural portraits for families, individuals, maternity sessions, and personal milestones."
              cta="Explore Portrait Sessions"
            />
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
          <div className={styles.actions}>
            <Link href="/availability" className={styles.button}>Check Availability</Link>
          </div>
        </div>
      </section>
    </>
  );
}
