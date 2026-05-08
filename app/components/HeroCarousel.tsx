"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    const id = window.setInterval(() => {
      setCurrent((index) => (index + 1) % images.length);
    }, 5200);
    return () => window.clearInterval(id);
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
          background-size: cover;
          background-position: center;
        }
        .home-hero::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(90deg, rgba(10, 14, 13, 0.72) 0%, rgba(10, 14, 13, 0.28) 46%, rgba(10, 14, 13, 0.1) 100%),
            linear-gradient(180deg, rgba(10, 14, 13, 0.34) 0%, rgba(10, 14, 13, 0.04) 42%, rgba(10, 14, 13, 0.42) 100%);
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
            font-size: 46px;
            line-height: 1;
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
        }
        @media (max-width: 380px) {
          .home-hero-title {
            font-size: 39px;
          }
        }
      `}</style>

      <section className="home-hero" aria-label="Bay Area photography hero">
        <div
          className="home-hero-slide"
          role="img"
          aria-label={images[current].alt}
          style={{ backgroundImage: `url(${images[current].image_url})` }}
        />

        <div className="home-hero-inner">
          <p className="home-hero-kicker">Bay Area graduation photography</p>
          <h1 className="home-hero-title">
            Graduation photos that feel natural, not awkward.
          </h1>
          <p className="home-hero-copy">
            Most clients tell me they feel awkward in front of the camera. That&rsquo;s completely normal.
            I guide the entire session so you feel confident, natural, and actually enjoy the day.
          </p>
          <div className="home-hero-actions">
            <Link href="/contact" className="home-hero-action" data-primary="true">
              Book a session
            </Link>
            <Link href="/pricing/grads" className="home-hero-action">
              See grad rates
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
