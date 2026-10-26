"use client";

// One pose in the private posing reference: tap the name to open the directions
// (and optional variation), star it as a favorite, or jump to the next pose.

import styles from "./couplesPosingReference.module.css";

export type ReferencePrompt = {
  number: number;
  title: string;
  category: string;
  instructions: string;
  variation: string | null;
  keywords: string[];
};

type Props = {
  prompt: ReferencePrompt;
  open: boolean;
  favorite: boolean;
  hasNext: boolean;
  onToggle: () => void;
  onFavorite: () => void;
  onNext: () => void;
};

export default function PoseCard({ prompt, open, favorite, hasNext, onToggle, onFavorite, onNext }: Props) {
  const panelId = `pose-${prompt.number}-directions`;
  return (
    <article id={`pose-${prompt.number}`} className={`${styles.card} ${open ? styles.cardOpen : ""}`}>
      <div className={styles.cardHead}>
        <button
          type="button"
          className={styles.cardToggle}
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <span className={styles.cardTitle}>{prompt.title}</span>
          <span className={styles.cardCategory}>{prompt.category}</span>
        </button>
        <button
          type="button"
          className={`${styles.star} ${favorite ? styles.starOn : ""}`}
          onClick={onFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? `Remove ${prompt.title} from favorites` : `Add ${prompt.title} to favorites`}
        >
          {favorite ? "★" : "☆"}
        </button>
      </div>
      {open && (
        <div id={panelId} className={styles.cardBody}>
          <p className={styles.label}>Directions to give</p>
          <p className={styles.directions}>{prompt.instructions}</p>
          {prompt.variation && (
            <div className={styles.variation}>
              <p className={styles.label}>Variation</p>
              <p className={styles.variationText}>{prompt.variation}</p>
            </div>
          )}
          {hasNext && (
            <button type="button" className={styles.nextButton} onClick={onNext}>
              Next pose →
            </button>
          )}
        </div>
      )}
    </article>
  );
}
