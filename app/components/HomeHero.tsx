"use client";

import Image from "next/image";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { SERVICES_SECTION_ID, type HomepageHeroSlide } from "@/lib/homepageData";
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

function PlaybackIcon({ paused }: { paused: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paused ? (
        <path d="M8 5v14l11-7-11-7Z" />
      ) : (
        <>
          <path d="M9 5v14" />
          <path d="M15 5v14" />
        </>
      )}
    </svg>
  );
}

function trackHero(action: string) {
  track("Homepage Hero Interaction", { action });
}

// "Explore Sessions" is a plain #services link that works without JS. With JS
// it scrolls (smoothly unless reduced motion is requested) and moves focus to
// the section so keyboard and screen-reader users land there too. The section's
// scroll-margin-top keeps its heading clear of the fixed nav.
function scrollToServices(event: MouseEvent<HTMLAnchorElement>, reducedMotion: boolean) {
  const target = document.getElementById(SERVICES_SECTION_ID);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  target.focus({ preventScroll: true });
  window.history.replaceState(null, "", `#${SERVICES_SECTION_ID}`);
}

export default function HomeHero({ slides }: { slides: HomepageHeroSlide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Slides whose image is in the DOM. The server HTML carries only the first
  // (preloaded, high priority), so it gets the page's early bandwidth. Once the
  // page has loaded, every other slide mounts and downloads in the background,
  // so they are ready long before anyone picks one; a slide picked even
  // earlier mounts on the spot.
  const [mountedThrough, setMountedThrough] = useState(0);
  const currentRef = useRef(0);

  const showSlide = useCallback((index: number, action?: string) => {
    const next = (index + slides.length) % slides.length;
    currentRef.current = next;
    setCurrent(next);
    setMountedThrough((value) => Math.max(value, next));
    if (action) trackHero(action);
  }, [slides.length]);

  useEffect(() => {
    const warmNext = () => setMountedThrough(slides.length - 1);
    if (document.readyState === "complete") {
      const id = window.setTimeout(warmNext, 0);
      return () => window.clearTimeout(id);
    }
    window.addEventListener("load", warmNext, { once: true });
    return () => window.removeEventListener("load", warmNext);
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
              {index <= mountedThrough ? (
                <Image
                  src={slide.image_url}
                  alt=""
                  fill
                  sizes="100vw"
                  preload={index === 0}
                  loading={index === 0 ? undefined : "eager"}
                  fetchPriority={index === 0 ? "high" : "low"}
                  quality={index === 0 ? 90 : 85}
                  className={styles.image}
                  style={imageStyle}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={styles.overlay} />
      <div className={styles.content}>
        <p className={styles.brand}>SoloXSnaps Photography</p>
        <h1>
          <span className={styles.headlinePlace}>San Francisco &amp; Bay Area</span>{" "}
          Graduation and Couples Photographer
        </h1>
        <p className={styles.copy}>
          Bright, natural photography with guided posing and a relaxed, personalized experience.
          Capturing graduations, couples, families, and meaningful moments throughout the Bay Area.
        </p>
        <div className={styles.actions}>
          <a
            href={`#${SERVICES_SECTION_ID}`}
            className={styles.primaryAction}
            onClick={(event) => {
              trackHero("explore_sessions");
              scrollToServices(event, reducedMotion);
            }}
          >
            Explore Sessions
          </a>
          <Link
            href="/availability"
            className={styles.secondaryAction}
            onClick={() => trackHero("check_availability")}
          >
            Check Availability
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
              aria-label={paused ? "Play slideshow" : "Pause slideshow"}
            >
              <PlaybackIcon paused={paused} />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
