import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import type { PortfolioImage } from "@/lib/professionalData";
import styles from "@/app/(professional)/home.module.css";
import details from "@/app/(professional)/homeDetails.module.css";
import responsive from "@/app/(professional)/homeResponsive.module.css";

type HomeImage = Pick<PortfolioImage, "image_url" | "alt">;

export default function HomeFinalCTA({ image }: { image: HomeImage }) {
  return (
    <section className={`${styles.section} ${styles.paper} ${responsive.section}`}>
      <div className={`${styles.shell} ${responsive.shell}`}>
        <div className={details.finalPanel}>
          <div className={details.finalMedia}>
            <OptimizedPhoto src={image.image_url} alt={image.alt} sizes="(max-width: 760px) 100vw, 1180px" quality={90} />
          </div>
          <div className={details.finalCopy}>
            <h2>Ready to plan your session?</h2>
            <p>
              Share what you are celebrating, your preferred location, and the dates you are considering.
              You will receive the next steps for confirming availability and securing the session.
            </p>
            <div className={styles.actions}>
              <Link href="/availability" className={styles.button}>Check Availability</Link>
              <Link href="/pricing" className={`${styles.button} ${styles.buttonGhost}`}>View Pricing</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
