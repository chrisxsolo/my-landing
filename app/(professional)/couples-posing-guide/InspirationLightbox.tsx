"use client";

// Full-screen viewer for one inspiration photo with its notes and source.
// Focus handling (initial focus, Tab trap, focus return, scroll lock) is the
// same hook the portfolio lightbox uses; Escape and arrows are handled by the
// parent, which owns the selection state.

import Image from "next/image";
import { useRef } from "react";
import useDialogFocus from "@/app/components/photoGallery/useDialogFocus";
import { inspirationAltText } from "@/lib/couplesPosingGuide";
import styles from "./couplesPosingGuide.module.css";
import galleryStyles from "./couplesGallery.module.css";

type LightboxImage = {
  image_url: string | null;
  title: string;
  internal_notes?: string | null;
  client_notes: string | null;
  creator_name: string | null;
  attribution_text: string | null;
  categories: string[];
  related_prompt_number: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  visibility: string;
};

type Props = {
  image: LightboxImage;
  mode: "photographer" | "client";
  position: number;
  total: number;
  onClose: () => void;
  onMove: (direction: number) => void;
  onTouchStart: (clientX: number) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
};

export default function InspirationLightbox({ image, mode, position, total, onClose, onMove, onTouchStart, onTouchEnd }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(dialogRef, closeRef);
  if (!image.image_url) return null;

  return (
    <div
      ref={dialogRef}
      className={galleryStyles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={`${image.title} (${position} of ${total})`}
      onClick={onClose}
      onTouchStart={(event) => onTouchStart(event.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
    >
      <div className={galleryStyles.lightboxPanel} onClick={(event) => event.stopPropagation()}>
        <button ref={closeRef} className={galleryStyles.closeButton} type="button" onClick={onClose} aria-label="Close lightbox">×</button>
        <div className={galleryStyles.lightboxMedia}>
          <Image
            src={image.image_url}
            alt={inspirationAltText(image)}
            width={image.width || 1600}
            height={image.height || 2000}
            sizes="95vw"
            loading="eager"
          />
        </div>
        <div className={galleryStyles.lightboxCopy}>
          <p className={styles.eyebrow}>{image.categories.join(" · ") || "Inspiration"}</p>
          <h2>{image.title}</h2>
          <p>{mode === "photographer" ? image.internal_notes || image.client_notes : image.client_notes}</p>
          {image.related_prompt_number && <p>Related prompt: {image.related_prompt_number}</p>}
          {(image.creator_name || image.attribution_text) && (
            <p>Source: {[image.creator_name, image.attribution_text].filter(Boolean).join(" · ")}</p>
          )}
          {mode === "photographer" && <p>Visibility: {image.visibility.replace("_", " ")}</p>}
        </div>
        {total > 1 && (
          <div className={galleryStyles.lightboxNav}>
            <button type="button" onClick={() => onMove(-1)}>Previous</button>
            <span aria-live="polite">{position} / {total}</span>
            <button type="button" onClick={() => onMove(1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
