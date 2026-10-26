"use client";

// Balanced masonry that keeps each photo's real aspect ratio (no cropping),
// lazy-loads every image, and opens a full-screen viewer on click. Two layouts
// are rendered — two columns on phones, three on wider screens — and CSS shows
// one; lazy images in the hidden layout never load. Boxes carry the photo's
// aspect ratio, so nothing shifts while images arrive.

import { useMemo, useState } from "react";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { distributeIntoColumns } from "@/lib/masonry";
import PhotoLightbox from "./PhotoLightbox";
import styles from "./PhotoGallery.module.css";

export type MasonryPhoto = { id: string; image_url: string; alt: string; width: number; height: number };

const LAYOUTS = [
  { columns: 2, className: styles.masonryMobile, sizes: "50vw" },
  { columns: 3, className: styles.masonryWide, sizes: "(max-width: 1200px) 33vw, 400px" },
] as const;

export default function MasonryGallery({ photos }: { photos: MasonryPhoto[] }) {
  const [active, setActive] = useState<number | null>(null);
  const layouts = useMemo(
    () => LAYOUTS.map((layout) => ({ ...layout, cols: distributeIntoColumns(photos, layout.columns) })),
    [photos],
  );
  if (photos.length === 0) return null;

  return (
    <>
      {layouts.map((layout) => (
        <div key={layout.columns} className={`${styles.masonry} ${layout.className}`}>
          {layout.cols.map((column, columnIndex) => (
            <div key={columnIndex} className={styles.masonryColumn}>
              {column.map((photoIndex) => {
                const photo = photos[photoIndex];
                return (
                  <button
                    key={photo.id}
                    type="button"
                    className={styles.masonryItem}
                    style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                    onClick={() => setActive(photoIndex)}
                    aria-label={`View full screen: ${photo.alt}`}
                  >
                    <OptimizedPhoto src={photo.image_url} alt={photo.alt} sizes={layout.sizes} loading="lazy" quality={75} />
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
