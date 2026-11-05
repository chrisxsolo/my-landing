"use client";

// Full-screen photo viewer shared by the couples portfolio and the grad school
// galleries. Shows the whole frame
// (object-fit: contain), supports arrow keys, Escape, swipe, keeps Tab inside
// the dialog, and returns focus to the page on close. Body scrolling is locked
// while open.

import Image from "next/image";
import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import { C } from "@/lib/colors";
import useDialogFocus from "./useDialogFocus";
import styles from "./PhotoGallery.module.css";

export type LightboxPhoto = { id: string | number; image_url: string; alt: string };

type Props = {
  photos: LightboxPhoto[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
};

const SWIPE_THRESHOLD_PX = 40;

// Colors come from the shared palette, set as variables on the dialog itself so
// the viewer looks the same on any page that mounts it.
const LIGHTBOX_VARS = {
  "--lb-backdrop": C.lightboxBackdrop,
  "--lb-button": C.lightboxButton,
  "--lb-white": C.white,
  "--lb-white-22": C.white_22,
  "--lb-white-82": C.white_82,
  "--lb-focus": C.proFilmEdge,
} as CSSProperties;

export default function PhotoLightbox({ photos, index, onChange, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const photo = photos[index];

  const move = useCallback(
    (direction: number) => onChange((index + direction + photos.length) % photos.length),
    [index, onChange, photos.length],
  );

  useDialogFocus(dialogRef, closeRef);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move, onClose]);

  function onTouchEnd(clientX: number) {
    if (touchStartX.current === null) return;
    const delta = clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) move(delta < 0 ? 1 : -1);
  }

  return (
    <div
      ref={dialogRef}
      className={styles.lightbox}
      style={LIGHTBOX_VARS}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => onTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
    >
      <div className={styles.lightboxFrame}>
        <Image
          key={photo.id}
          src={photo.image_url}
          alt={photo.alt}
          fill
          sizes="100vw"
          quality={90}
          style={{ objectFit: "contain" }}
        />
      </div>
      <p className={styles.lightboxCounter} aria-live="polite">
        {index + 1} / {photos.length}
      </p>
      <button ref={closeRef} type="button" className={styles.lightboxClose} onClick={onClose} aria-label="Close full-screen view">
        ✕
      </button>
      {photos.length > 1 && (
        <>
          <button type="button" className={`${styles.lightboxNav} ${styles.lightboxPrev}`} onClick={() => move(-1)} aria-label="Previous photo">
            ‹
          </button>
          <button type="button" className={`${styles.lightboxNav} ${styles.lightboxNext}`} onClick={() => move(1)} aria-label="Next photo">
            ›
          </button>
        </>
      )}
    </div>
  );
}
