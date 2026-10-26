// "Where couples sessions happen" — published couples location guides only, each
// with its cover photo when one exists. Renders nothing when no guide is live.

import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import type { FeaturedCouplesLocation } from "@/lib/couplesGuide/featuredLocations";
import styles from "./CouplesPortfolio.module.css";

export default function CouplesLocationCards({ locations }: { locations: FeaturedCouplesLocation[] }) {
  if (locations.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="couples-locations">
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>Location guides</p>
        <h2 id="couples-locations" className={styles.heading}>Where couples sessions happen</h2>
        <p className={styles.lead}>
          Light, crowds, and the best angles for each spot I photograph couples at.{" "}
          <Link href="/couples-guide/locations" className={styles.inlineLink}>Browse every couples location</Link>
        </p>
      </div>
      <div className={styles.locations}>
        {locations.map((location) => (
          <Link key={location.slug} href={location.href} className={styles.locationCard}>
            {location.cover && (
              <div className={styles.locationMedia}>
                <OptimizedPhoto
                  src={location.cover.image_url}
                  alt={location.cover.alt}
                  sizes="(max-width: 640px) 100vw, 420px"
                  loading="lazy"
                  quality={75}
                />
              </div>
            )}
            <div className={styles.locationBody}>
              <span className={styles.locationArea}>{location.area}</span>
              <h3 className={styles.locationName}>{location.name}</h3>
              <p className={styles.locationText}>{location.summary}</p>
              <span className={styles.locationLink}>{location.name} couples guide →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
