"use client";

import Link from "next/link";
import { C } from "@/lib/colors";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Links", href: "/links" },
  { label: "Grad Guide", href: "/grad-guide" },
  { label: "Location Guide", href: "/location-guide" },
  { label: "Booking Process", href: "/booking-process" },
  { label: "Availability", href: "/availability" },
  { label: "Blog", href: "/blog" },
];

export default function Nav() {
  return (
    <>
      <style>{`
        .nav-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .nav-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b px-4 py-3 sm:px-6"
        style={{
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderColor: "rgba(0,0,0,0.06)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link
            href="/"
            className="shrink-0 text-xl font-black tracking-tight"
            style={{ color: C.p1 }}
          >
            Chris.
          </Link>

          <div className="nav-scroll flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-full px-3 py-2 text-sm font-bold text-slate-600 transition-opacity hover:opacity-70"
                style={{
                  background: `linear-gradient(135deg, ${C.p1_06}, ${C.p2_04})`,
                }}
              >
                {link.label}
              </Link>
            ))}

            <a
              href="https://www.instagram.com/soloxsnaps"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full px-3 py-2 text-sm font-bold transition-opacity hover:opacity-70"
              style={{
                color: C.p2,
                background: `linear-gradient(135deg, ${C.p2_06}, ${C.p3_08})`,
              }}
            >
              Instagram
            </a>
          </div>
        </div>
      </nav>

      <div style={{ height: "72px" }} />
    </>
  );
}
