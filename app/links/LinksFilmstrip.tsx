// The drifting "Recent work" strip on /links: real portfolio photos, rendered
// twice so the loop is seamless (the second copy is hidden from screen readers).
// Renders nothing if the portfolio cannot be loaded.

import NextLink from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPortfolioData } from "@/lib/professionalData";
import { pickFilmstripImages } from "./filmstripPicker";
import styles from "./links.module.css";

export default async function LinksFilmstrip() {
  const { images } = await getPortfolioData();
  const frames = pickFilmstripImages(images);
  if (frames.length === 0) return null;

  return (
    <section aria-label="Recent work">
      <div className={styles.sectionHead}>
        <p className={styles.eyebrow}>Recent work</p>
        <NextLink href="/portfolio" className={styles.sectionLink}>
          See the portfolio
          <span aria-hidden="true">→</span>
        </NextLink>
      </div>

      <div className={styles.strip}>
        <div className={styles.track}>
          {[false, true].map((isCopy) =>
            frames.map((frame) => (
              <div
                key={`${isCopy ? "copy" : "first"}-${frame.id}`}
                className={styles.frame}
                aria-hidden={isCopy || undefined}
              >
                <OptimizedPhoto src={frame.image_url} alt={isCopy ? "" : frame.alt} sizes="132px" />
              </div>
            )),
          )}
        </div>
      </div>
    </section>
  );
}
