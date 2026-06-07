"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./couplesPosingGuide.module.css";
import galleryStyles from "./couplesGallery.module.css";

type Prompt = {
  number: number;
  slug: string;
  title: string;
  category: string;
  keywords: string[];
  instructions?: string;
};

type InspirationImage = {
  id: string;
  image_url: string | null;
  title: string;
  internal_notes?: string | null;
  client_notes: string | null;
  creator_name: string | null;
  attribution_text: string | null;
  external_source_url: string | null;
  categories: string[];
  tags: string[];
  related_prompt_number: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  visibility: string;
};

type Props = {
  mode: "photographer" | "client";
  isAdmin: boolean;
  prompts: Prompt[];
  images: InspirationImage[];
  promptCategories: string[];
  inspirationCategories: string[];
};

const FAVORITES_KEY = "couples_guide_favorites";
const USED_KEY = "couples_guide_recently_used";

function readNumbers(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

export default function CouplesPosingGuideClient({
  mode,
  isAdmin,
  prompts,
  images,
  promptCategories,
  inspirationCategories,
}: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [used, setUsed] = useState<number[]>([]);
  const [galleryCategory, setGalleryCategory] = useState("All");
  const [activeImage, setActiveImage] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (mode !== "photographer") return;
    const timeout = window.setTimeout(() => {
      setFavorites(readNumbers(FAVORITES_KEY));
      setUsed(readNumbers(USED_KEY));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [mode]);

  const filteredPrompts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return prompts.filter((prompt) => {
      if (category === "Favorites" && !favorites.includes(prompt.number)) return false;
      if (category !== "All" && category !== "Favorites" && prompt.category !== category) {
        return false;
      }
      if (!needle) return true;
      return [
        prompt.title,
        prompt.instructions ?? "",
        prompt.category,
        ...prompt.keywords,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [category, favorites, prompts, search]);

  const filteredImages = useMemo(() => {
    if (galleryCategory === "All") return images;
    return images.filter((image) => image.categories.includes(galleryCategory));
  }, [galleryCategory, images]);

  const moveLightbox = useCallback((direction: number) => {
    setActiveImage((current) => {
      if (current === null || filteredImages.length < 2) return current;
      return (current + direction + filteredImages.length) % filteredImages.length;
    });
  }, [filteredImages.length]);

  useEffect(() => {
    if (activeImage === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveImage(null);
      if (event.key === "ArrowRight") moveLightbox(1);
      if (event.key === "ArrowLeft") moveLightbox(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeImage, moveLightbox]);

  const groupedPrompts = promptCategories.map((name) => ({
    name,
    prompts: filteredPrompts.filter((prompt) => prompt.category === name),
  })).filter((group) => group.prompts.length > 0);

  function persistNumbers(key: string, values: number[]) {
    localStorage.setItem(key, JSON.stringify(values));
  }

  function toggleFavorite(number: number) {
    setFavorites((current) => {
      const next = current.includes(number)
        ? current.filter((item) => item !== number)
        : [...current, number];
      persistNumbers(FAVORITES_KEY, next);
      return next;
    });
  }

  function toggleUsed(number: number) {
    setUsed((current) => {
      const next = current.includes(number)
        ? current.filter((item) => item !== number)
        : [...current, number];
      persistNumbers(USED_KEY, next);
      return next;
    });
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (touchStart.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(distance) > 48) moveLightbox(distance < 0 ? 1 : -1);
    touchStart.current = null;
  }

  const selectedImage = activeImage === null ? null : filteredImages[activeImage];
  const navCategories = mode === "photographer"
    ? ["All", ...promptCategories, "Favorites"]
    : ["All", ...promptCategories];

  return (
    <>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {mode === "photographer" ? "Field guide" : "Couples sessions"}
          </p>
          <h1>Couples Posing Guide</h1>
          <p className={styles.subtitle}>
            {mode === "photographer"
              ? "Movement, connection, and storytelling prompts for natural couples sessions"
              : "A visual guide to the natural, playful, and connected moments we’ll create during your session"}
          </p>
        </div>
        {isAdmin && (
          <div className={styles.headerActions}>
            <Link href="/admin?tab=couplesGuide" className={styles.secondaryButton}>
              Manage images
            </Link>
            <Link
              href={mode === "photographer" ? "/couples-posing-guide?preview=client" : "/couples-posing-guide"}
              className={styles.primaryButton}
            >
              {mode === "photographer" ? "Preview client view" : "Photographer view"}
            </Link>
          </div>
        )}
      </header>

      {mode === "client" && (
        <section className={styles.intro}>
          <p>Your session will focus on natural movement, genuine connection, and moments that feel like you. Rather than holding stiff poses for the entire session, I’ll guide you through simple prompts that create real interaction, laughter, and emotion</p>
          <p>You don’t need any modeling experience or a list of poses prepared. I’ll guide you throughout the session while leaving enough room for your relationship and personalities to come through naturally</p>
        </section>
      )}

      <div className={styles.stickyTools}>
        <nav className={styles.chips} aria-label="Prompt categories">
          {navCategories.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              className={category === item ? styles.chipActive : styles.chip}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <label className={styles.search}>
          <span className="sr-only">Search posing prompts</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search prompts..."
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              Clear
            </button>
          )}
        </label>
      </div>

      <section className={styles.promptSection} aria-labelledby="prompt-heading">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Prompt library</p>
          <h2 id="prompt-heading">{filteredPrompts.length} prompts</h2>
        </div>
        {groupedPrompts.length === 0 ? (
          <p className={styles.empty}>No posing prompts match your search</p>
        ) : (
          groupedPrompts.map((group) => (
            <details key={group.name} className={styles.promptGroup} open>
              <summary>
                <span>{group.name}</span>
                <span>{group.prompts.length}</span>
              </summary>
              <div className={styles.promptGrid}>
                {group.prompts.map((prompt) => (
                  <article
                    key={prompt.number}
                    className={`${styles.promptCard} ${used.includes(prompt.number) ? styles.promptUsed : ""}`}
                  >
                    <div className={styles.promptMeta}>
                      <span>Prompt {String(prompt.number).padStart(2, "0")}</span>
                      <span>{prompt.category}</span>
                    </div>
                    <h3>{prompt.title}</h3>
                    {prompt.instructions && (
                      <p className={styles.instructions}>{prompt.instructions}</p>
                    )}
                    {mode === "photographer" && (
                      <div className={styles.promptActions}>
                        <button
                          type="button"
                          aria-pressed={favorites.includes(prompt.number)}
                          onClick={() => toggleFavorite(prompt.number)}
                        >
                          {favorites.includes(prompt.number) ? "★ Favorite" : "☆ Favorite"}
                        </button>
                        <button
                          type="button"
                          aria-pressed={used.includes(prompt.number)}
                          onClick={() => toggleUsed(prompt.number)}
                        >
                          {used.includes(prompt.number) ? "Used ✓" : "Mark used"}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(`${prompt.title}\n\n${prompt.instructions}`)}
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </details>
          ))
        )}
      </section>

      <section className={galleryStyles.gallerySection} aria-labelledby="gallery-heading">
        <div className={galleryStyles.galleryHeader}>
          <div>
            <p className={styles.eyebrow}>Visual references</p>
            <h2 id="gallery-heading">Couples Session Inspiration</h2>
            <p>
              {mode === "photographer"
                ? "Reference images for posing, composition, movement, lighting, styling, and emotional direction"
                : "A collection of visual references that represents the natural movement, connection, and storytelling we may explore during your session"}
            </p>
          </div>
          <label>
            <span>Filter gallery</span>
            <select value={galleryCategory} onChange={(event) => setGalleryCategory(event.target.value)}>
              <option>All</option>
              {inspirationCategories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>

        {filteredImages.length === 0 ? (
          <div className={styles.empty}>
            <p>{images.length === 0 ? "No inspiration images have been added yet" : "No images match these filters"}</p>
            {isAdmin && <p>Upload references from the admin dashboard to begin building the visual guide</p>}
          </div>
        ) : (
          <div className={galleryStyles.masonry}>
            {filteredImages.map((image, index) => image.image_url && (
              <button
                key={image.id}
                type="button"
                className={galleryStyles.galleryItem}
                onClick={() => setActiveImage(index)}
                aria-label={`Open ${image.title}`}
              >
                <Image
                  src={image.image_url}
                  alt={image.alt_text || image.title}
                  width={image.width || 1200}
                  height={image.height || 1500}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
                <span>{image.title}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {isAdmin && (
        <section className={styles.shareBar}>
          <div>
            <strong>Sharing controls</strong>
            <span>Private images are excluded from public and client previews.</span>
          </div>
          <button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/couples-posing-guide`)}>
            Copy public link
          </button>
          <Link href="/couples-posing-guide?preview=client">Preview client view</Link>
        </section>
      )}

      {selectedImage && selectedImage.image_url && (
        <div
          className={galleryStyles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label={selectedImage.title}
          onClick={() => setActiveImage(null)}
          onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
          onTouchEnd={onTouchEnd}
        >
          <div className={galleryStyles.lightboxPanel} onClick={(event) => event.stopPropagation()}>
            <button className={galleryStyles.closeButton} type="button" onClick={() => setActiveImage(null)} aria-label="Close lightbox">×</button>
            <div className={galleryStyles.lightboxMedia}>
              <Image
                src={selectedImage.image_url}
                alt={selectedImage.alt_text || selectedImage.title}
                width={selectedImage.width || 1600}
                height={selectedImage.height || 2000}
                sizes="95vw"
              />
            </div>
            <div className={galleryStyles.lightboxCopy}>
              <p className={styles.eyebrow}>{selectedImage.categories.join(" · ") || "Inspiration"}</p>
              <h2>{selectedImage.title}</h2>
              <p>{mode === "photographer" ? selectedImage.internal_notes || selectedImage.client_notes : selectedImage.client_notes}</p>
              {selectedImage.related_prompt_number && <p>Related prompt: {selectedImage.related_prompt_number}</p>}
              {(selectedImage.creator_name || selectedImage.attribution_text) && (
                <p>Source: {[selectedImage.creator_name, selectedImage.attribution_text].filter(Boolean).join(" · ")}</p>
              )}
              {mode === "photographer" && <p>Visibility: {selectedImage.visibility.replace("_", " ")}</p>}
            </div>
            {filteredImages.length > 1 && (
              <div className={galleryStyles.lightboxNav}>
                <button type="button" onClick={() => moveLightbox(-1)}>Previous</button>
                <span>{activeImage! + 1} / {filteredImages.length}</span>
                <button type="button" onClick={() => moveLightbox(1)}>Next</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
