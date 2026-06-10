import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import type { FeaturedSession } from "@/lib/homepageData";
import type { PortfolioImage } from "@/lib/professionalData";
import styles from "@/app/(professional)/home.module.css";
import responsive from "@/app/(professional)/homeResponsive.module.css";

type HomeImage = Pick<PortfolioImage, "id" | "image_url" | "alt" | "category_slug">;

const MAX_IMAGES = 5;
const MAX_SESSIONS = 2;

export default function HomeFeaturedWork({
  images,
  featuredSessions,
}: {
  images: HomeImage[];
  featuredSessions: FeaturedSession[];
}) {
  const mosaic = images.slice(0, MAX_IMAGES);
  const sessions = featuredSessions.slice(0, MAX_SESSIONS);

  return (
    <section className={`${styles.section} ${styles.paper} ${responsive.section}`}>
      <div className={`${styles.shell} ${responsive.shell}`}>
        <div className={`${styles.headerRow} ${responsive.headerRow}`}>
          <div>
            <p className={styles.eyebrow}>Selected work</p>
            <h2 className={styles.title}>Bright, natural photographs that still feel like you</h2>
          </div>
          <div>
            <p className={`${styles.copy} ${responsive.headerRowCopy}`}>
              You do not need to know how to pose. I will guide flattering positions, natural
              movement, and genuine expressions throughout your session.
            </p>
            <div className={styles.actions}>
              <Link href="/portfolio" className={`${styles.button} ${styles.buttonGhost}`}>
                View Portfolio
              </Link>
            </div>
          </div>
        </div>

        <div className={`${styles.storyGrid} ${responsive.storyGrid}`} aria-label="Featured photography">
          {mosaic.map((image, index) => (
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

        {sessions.length > 0 ? (
          <>
            <div className={`${styles.sessionDuo} ${responsive.sessionDuo}`}>
              {sessions.map((session) => (
                <Link key={session.href} href={session.href} className={`${styles.sessionCard} ${responsive.sessionCard}`}>
                  <div className={styles.sessionImage}>
                    <OptimizedPhoto src={session.imageUrl} alt={session.imageAlt} sizes="(max-width: 760px) 100vw, 50vw" />
                  </div>
                  <div className={styles.sessionBody}>
                    <span className={styles.sessionMeta}>{session.location}</span>
                    <h3>{session.title}</h3>
                    <p>{session.description}</p>
                    <span className={styles.cardCta}>View Full Session →</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className={styles.actions}>
              <Link href="/blog" className={`${styles.button} ${styles.buttonGhost}`}>Explore Full Sessions</Link>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
