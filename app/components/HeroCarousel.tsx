"use client";

import { useEffect, useState } from "react";

type CarouselImage = {
  id: string | number;
  image_url: string;
  alt: string;
  category_slug: string;
};

export default function HeroCarousel({ images }: { images: CarouselImage[] }) {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  function goTo(i: number) {
    if (i === current || transitioning) return;
    setTransitioning(true);
    setPrev(current);
    setCurrent(i);
    setTimeout(() => {
      setPrev(null);
      setTransitioning(false);
    }, 800);
  }

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      const next = (current + 1) % images.length;
      goTo(next);
    }, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, images.length, transitioning]);

  if (!images.length) return null;

  return (
    <>
      <style>{`
        .hero-slide {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
        }
        .hero-slide-enter {
          animation: heroFadeIn 0.8s ease forwards;
        }
        .hero-slide-exit {
          animation: heroFadeOut 0.8s ease forwards;
        }
        @keyframes heroFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes heroFadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        .hero-dot-btn {
          border: none;
          padding: 0;
          cursor: pointer;
          background: none;
          transition: all 0.35s ease;
        }
        .hero-dot-btn:hover { opacity: 0.7; }
        .hero-wordmark {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 5.5rem;
          font-weight: 300;
          letter-spacing: 0px;
          text-transform: uppercase;
          color: #ffffff;
          margin: 0;
          text-align: center;
          text-shadow: 0 1px 24px rgba(0,0,0,0.2);
          white-space: nowrap;
          max-width: calc(100vw - 32px);
        }
        @media (max-width: 760px) {
          .hero-wordmark { font-size: 2.9rem; }
        }
        @media (max-width: 360px) {
          .hero-wordmark { font-size: 2.45rem; }
        }
      `}</style>

      {/* Full-viewport image stack */}
      <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", background: "#e8e4df" }}>
        {/* Previous image (fading out) */}
        {prev !== null && images[prev] && (
          <div
            className="hero-slide hero-slide-exit"
            style={{ backgroundImage: `url(${images[prev].image_url})` }}
          />
        )}

        {/* Current image (fading in) */}
        {images[current] && (
          <div
            className={`hero-slide ${transitioning ? "hero-slide-enter" : ""}`}
            style={{ backgroundImage: `url(${images[current].image_url})` }}
          />
        )}

        {/* Overlay — very subtle darkening at top and bottom for text legibility */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.22) 100%)",
          pointerEvents: "none",
        }} />

        {/* Centered studio name overlaid on image */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <h1 className="hero-wordmark">
            soloxsnaps
          </h1>
        </div>

        {/* Dots — bottom center */}
        <div style={{
          position: "absolute", bottom: 28, left: 0, right: 0,
          display: "flex", justifyContent: "center", gap: 8,
        }}>
          {images.map((_, i) => (
            <button
              key={i}
              className="hero-dot-btn"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === current ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>

        {/* Scroll hint */}
        <div style={{
          position: "absolute", bottom: 28, right: 32,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontSize: "0.72rem",
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.6)",
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
        }}>
          scroll
        </div>
      </div>
    </>
  );
}
