"use client";

import Image from "next/image";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { HomepageHeroSlide } from "@/lib/homepageData";
import styles from "@/app/components/HomeHero.module.css";

const AUTOPLAY_INTERVAL_MS = 7000;

type HeroImageStyle = CSSProperties & {
  "--hero-position": string;
  "--hero-mobile-position": string;
};

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

function trackHero(action: string) {
  track("Homepage Hero Interaction", { action });
}

export default function HomeHero({ slides }: { slides: HomepageHeroSlide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [renderedSlides, setRenderedSlides] = useState(() => new Set([0]));
  const currentRef = useRef(0);

  const showSlide = useCallback((index: number, action?: string) => {
    const next = (index + slides.length) % slides.length;
    const following = slides.length > 1 ? (next + 1) % slides.length : next;
    currentRef.current = next;
    setRenderedSlides((previous) => new Set([...previous, next, following]));
    setCurrent(next);
    if (action) trackHero(action);
  }, [slides.length]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused || reducedMotion) return;

    let intervalId: number | undefined;
    const warmupId = window.setTimeout(() => {
      const next = (currentRef.current + 1) % slides.length;
      setRenderedSlides((previous) => new Set([...previous, next]));
    }, 1200);
    const start = () => {
      if (intervalId || document.hidden) return;
      intervalId = window.setInterval(
        () => showSlide(currentRef.current + 1),
        AUTOPLAY_INTERVAL_MS,
      );
    };
    const stop = () => {
      if (!intervalId) return;
      window.clearInterval(intervalId);
      intervalId = undefined;
    };
    const handleVisibility = () => (document.hidden ? stop() : start());

    document.addEventListener("visibilitychange", handleVisibility);
    start();
    return () => {
      window.clearTimeout(warmupId);
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [paused, reducedMotion, showSlide, slides.length]);

  if (!slides.length) return null;

  return (
    <section
      className={styles.hero}
      aria-label="Featured SoloXSnaps photography"
      aria-roledescription="carousel"
    >
      <div className={styles.slides}>
        {slides.map((slide, index) => {
          if (!renderedSlides.has(index)) return null;
          const imageStyle: HeroImageStyle = {
            "--hero-position": slide.objectPosition,
            "--hero-mobile-position": slide.mobileObjectPosition,
          };
          return (
            <div
              key={slide.id}
              className={styles.slide}
              data-active={index === current}
              aria-hidden={index !== current}
            >
              <Image
                src={slide.image_url}
                alt=""
                fill
                sizes="100vw"
                preload={index === 0}
                quality={index === 0 ? 90 : 85}
                className={styles.image}
                style={imageStyle}
              />
            </div>
          );
        })}
      </div>

      <div className={styles.overlay} />
      <div className={styles.content}>
        <p className={styles.brand}>SoloXSnaps Photography</p>
        <h1>Bay Area Graduation &amp; Couples Photographer</h1>
        <p className={styles.copy}>
          Bright, natural portraits with clear posing guidance throughout San Francisco
          and the Bay Area.
        </p>
        <div className={styles.actions}>
          <Link
            href="/availability"
            className={styles.primaryAction}
            onClick={() => trackHero("check_availability")}
          >
            Check Availability
          </Link>
          <Link
            href="#sessions"
            className={styles.secondaryAction}
            onClick={() => trackHero("explore_sessions")}
          >
            Explore Sessions
          </Link>
        </div>
      </div>

      {slides.length > 1 ? (
        <div className={styles.controls}>
          <div className={styles.arrowControls}>
            <button
              type="button"
              onClick={() => showSlide(current - 1, "previous_slide")}
              aria-label="Previous hero image"
            >
              <ArrowIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={() => showSlide(current + 1, "next_slide")}
              aria-label="Next hero image"
            >
              <ArrowIcon direction="right" />
            </button>
          </div>
          <div className={styles.indicators} aria-label="Choose a hero image">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                data-active={index === current}
                onClick={() => showSlide(index, "slide_indicator")}
                aria-label={`Go to hero image ${index + 1}`}
                aria-current={index === current ? "true" : undefined}
              />
            ))}
          </div>
          {!reducedMotion ? (
            <button
              type="button"
              className={styles.pause}
              onClick={() => {
                setPaused((value) => !value);
                trackHero(paused ? "play_slideshow" : "pause_slideshow");
              }}
              aria-label={paused ? "Play hero slideshow" : "Pause hero slideshow"}
            >
              {paused ? "Play" : "Pause"}
            </button>
          ) : null}
        </div>
      ) : null}

      <Link
        href="#homepage-content"
        className={styles.scroll}
        onClick={() => trackHero("scroll_to_content")}
      >
        <span>Scroll to explore</span>
        <span className={styles.scrollLine} aria-hidden="true" />
      </Link>
    </section>
  );
}
