"use client";

// Couples portfolio gallery: balanced masonry that keeps each photo's real aspect
// ratio (no cropping), lazy-loaded, with a full-screen viewer (keyboard arrows,
// Escape, swipe). Two layouts are rendered — two columns on phones, three on
// larger screens — and CSS shows one; lazy images in the hidden one never load.

import { useMemo, useState } from "react";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { distributeIntoColumns } from "@/lib/masonry";
import type { CouplesPortfolioPhoto } from "@/lib/couplesPortfolio";
import PhotoLightbox from "@/app/components/photoGallery/PhotoLightbox";
import styles from "./CouplesPortfolio.module.css";

type Props = { photos: CouplesPortfolioPhoto[] };

const LAYOUTS = [
  { columns: 2, className: styles.galleryMobile, sizes: "50vw" },
  { columns: 3, className: styles.galleryWide, sizes: "(max-width: 1200px) 33vw, 420px" },
] as const;

export default function CouplesGallery({ photos }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const layouts = useMemo(
    () => LAYOUTS.map((layout) => ({ ...layout, cols: distributeIntoColumns(photos, layout.columns) })),
    [photos],
  );

  if (photos.length === 0) {
    return <p className={styles.galleryEmpty}>New couples sessions are being added — check back soon.</p>;
  }

  return (
    <>
      {layouts.map((layout) => (
        <div key={layout.columns} className={`${styles.gallery} ${layout.className}`}>
          {layout.cols.map((column, columnIndex) => (
            <div key={columnIndex} className={styles.galleryColumn}>
              {column.map((photoIndex) => {
                const photo = photos[photoIndex];
                return (
                  <button
                    key={photo.id}
                    type="button"
                    className={styles.galleryItem}
                    style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                    onClick={() => setActive(photoIndex)}
                    aria-label={`View full screen: ${photo.alt}`}
                  >
                    <OptimizedPhoto
                      src={photo.image_url}
                      alt={photo.alt}
                      sizes={layout.sizes}
                      loading="lazy"
                      quality={75}
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ))}
      {active !== null && (
        <PhotoLightbox photos={photos} index={active} onChange={setActive} onClose={() => setActive(null)} />
      )}
    </>
  );
}
