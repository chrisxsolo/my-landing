"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";

type CarouselImage = {
  id: string | number;
  image_url: string;
  alt: string;
  category_slug: string;
};

export default function HeroCarousel({ images }: { images: CarouselImage[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;

    // Respect reduced-motion: hold on the first slide, no auto-rotation.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let intervalId: number | null = null;
    const start = () => {
      if (intervalId !== null) return;
      intervalId = window.setInterval(() => {
        setCurrent((index) => (index + 1) % images.length);
      }, 5200);
    };
    const stop = () => {
      if (intervalId === null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };

    // Pause rotation while the tab is hidden; resume when it returns.
    const handleVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", handleVisibility);
    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [images.length]);

  if (!images.length) return null;

  return (
    <>
      <style>{`
        .home-hero {
          position: relative;
          height: clamp(680px, 88svh, 920px);
          overflow: hidden;
          isolation: isolate;
          background: #101412;
        }
        .home-hero-slide {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.7s ease;
        }
        .home-hero-slide[data-active="true"] {
          opacity: 1;
        }
        .home-hero-slide img {
          object-position: center 30%;
        }
        .home-hero::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(90deg, rgba(10, 14, 13, 0.6) 0%, rgba(10, 14, 13, 0.2) 46%, rgba(10, 14, 13, 0.04) 100%),
            linear-gradient(180deg, rgba(10, 14, 13, 0.12) 0%, rgba(10, 14, 13, 0) 38%, rgba(10, 14, 13, 0.34) 100%);
          pointer-events: none;
        }
        .home-hero-inner {
          position: relative;
          z-index: 2;
          width: min(1180px, calc(100% - 48px));
          height: 100%;
          margin: 0 auto;
          display: grid;
          align-content: end;
          padding: 140px 0 62px;
        }
        .home-hero-kicker {
          width: fit-content;
          margin: 0 0 18px;
          padding: 8px 10px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.88);
          font-size: 13px;
          font-weight: 760;
          letter-spacing: 0;
        }
        .home-hero-title {
          max-width: 760px;
          margin: 0;
          color: #ffffff;
          font-size: 74px;
          font-weight: 860;
          letter-spacing: 0;
          line-height: 0.95;
          text-wrap: balance;
          text-shadow: 0 18px 54px rgba(0, 0, 0, 0.34);
        }
        .home-hero-copy {
          max-width: 600px;
          margin: 22px 0 0;
          color: rgba(255, 255, 255, 0.82);
          font-size: 18px;
          line-height: 1.7;
          text-wrap: pretty;
        }
        .home-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 30px;
        }
        .home-hero-action {
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 18px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.16);
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0;
          text-decoration: none;
          transition: background 0.18s ease, transform 0.18s ease;
        }
        .home-hero-action[data-primary="true"] {
          border-color: #ffffff;
          background: #ffffff;
          color: #0f1714;
        }
        .home-hero-action:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.24);
        }
        .home-hero-action[data-primary="true"]:hover {
          background: #f7faf8;
        }
        .home-hero-dots {
          position: absolute;
          z-index: 3;
          right: 24px;
          bottom: 22px;
          display: flex;
          gap: 7px;
        }
        .home-hero-dot {
          width: 8px;
          height: 8px;
          padding: 0;
          border: 0;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.44);
          cursor: pointer;
          transition: width 0.2s ease, background 0.2s ease;
        }
        .home-hero-dot[data-active="true"] {
          width: 30px;
          background: #ffffff;
        }
        @media (max-width: 760px) {
          .home-hero {
            height: 84svh;
          }
          .home-hero-inner {
            width: min(1180px, calc(100% - 36px));
            padding: 116px 0 44px;
          }
          .home-hero-title {
            font-size: 42px;
            line-height: 1;
            max-width: 8.2ch;
          }
          .home-hero-copy {
            font-size: 16px;
            line-height: 1.62;
          }
          .home-hero-actions {
            display: grid;
            grid-template-columns: 1fr;
            margin-top: 24px;
          }
          .home-hero-dots {
            left: 18px;
            right: auto;
            bottom: 18px;
          }
          .home-hero-slide img {
            object-position: 18% top;
          }
        }
        @media (max-width: 380px) {
          .home-hero-title {
            font-size: 39px;
          }
        }
      `}</style>

      <section className="home-hero" aria-label="Bay Area photography hero">
        {images.map((image, index) => (
          <div
            key={image.id}
            className="home-hero-slide"
            data-active={index === current}
            aria-hidden={index !== current}
          >
            <OptimizedPhoto
              src={image.image_url}
              alt={image.alt}
              sizes="100vw"
              priority={index === 0}
              quality={90}
            />
          </div>
        ))}

        <div className="home-hero-inner">
          <p className="home-hero-kicker">Bay Area graduation, couples &amp; family photographer</p>
          <h1 className="home-hero-title">
            Photos that feel real, not rehearsed.
          </h1>
          <p className="home-hero-copy">
            Couples, families, and grads, guided through calm, natural sessions that actually
            feel like you. No stiff posing, no awkward guessing, just photos you&rsquo;ll want to keep.
          </p>
          <div className="home-hero-actions">
            <Link href="/contact" className="home-hero-action" data-primary="true">
              Book a session
            </Link>
            <Link href="/pricing" className="home-hero-action">
              See session options
            </Link>
          </div>
        </div>

        {images.length > 1 && (
          <div className="home-hero-dots" aria-label="Hero slides">
            {images.map((image, index) => (
              <button
                key={image.id}
                className="home-hero-dot"
                data-active={index === current}
                aria-label={`Show slide ${index + 1}`}
                onClick={() => setCurrent(index)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
