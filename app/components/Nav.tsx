"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { C } from "@/lib/colors";

const navLinks = [
  { label: "Home", href: "/home" },
  { label: "Me", href: "/me" },
  { label: "Graduation Guide", href: "/grad-guide" },
  { label: "Locations", href: "/bay-area-locations" },
  { label: "Availability", href: "/booking" },
  { label: "Journal", href: "/journal" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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
          background: C.surfaceStrong,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderColor: C.borderSubtle,
          boxShadow: C.shadowWarmSm,
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link
            href="/home"
            className="shrink-0 text-xl font-black tracking-tight"
            style={{ color: C.p1 }}
          >
            Chris.
          </Link>

          <div className="nav-scroll hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-full px-3 py-2 text-sm font-bold text-slate-600 transition-all hover:opacity-70"
                style={{
                  background: isActivePath(pathname, link.href)
                      ? C.grad12
                      : C.surfaceWarm,
                  color: isActivePath(pathname, link.href) ? "#fff" : undefined,
                  boxShadow:
                    isActivePath(pathname, link.href)
                      ? C.shadowWarmSm
                      : "none",
                  border: isActivePath(pathname, link.href)
                    ? "none"
                    : `1px solid ${C.borderSubtle}`,
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileOpen((open) => !open)}
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border md:hidden"
            style={{
              borderColor: C.borderSubtle,
              background: mobileOpen
                ? C.grad12
                : C.surfaceWarmAlt,
              boxShadow: mobileOpen ? C.shadowWarmSm : "none",
            }}
          >
            <span className="relative h-4 w-5">
              <span
                className="absolute left-0 top-0 h-0.5 w-5 rounded-full transition-all"
                style={{
                  background: mobileOpen ? "#fff" : "#111827",
                  transform: mobileOpen ? "translateY(7px) rotate(45deg)" : "none",
                }}
              />
              <span
                className="absolute left-0 top-[7px] h-0.5 w-5 rounded-full transition-all"
                style={{
                  background: mobileOpen ? "#fff" : "#111827",
                  opacity: mobileOpen ? 0 : 1,
                }}
              />
              <span
                className="absolute left-0 top-[14px] h-0.5 w-5 rounded-full transition-all"
                style={{
                  background: mobileOpen ? "#fff" : "#111827",
                  transform: mobileOpen ? "translateY(-7px) rotate(-45deg)" : "none",
                }}
              />
            </span>
          </button>
        </div>
      </nav>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="absolute left-4 right-4 top-[76px] rounded-[28px] border p-4 shadow-2xl"
            style={{
              background: C.surfaceStrong,
              borderColor: C.borderSubtle,
              boxShadow: C.shadowWarmLg,
            }}
          >
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl px-4 py-3 text-base font-bold text-slate-700 transition-all"
                  style={{
                    background: isActivePath(pathname, link.href)
                        ? C.grad12
                        : C.surfaceWarm,
                    color: isActivePath(pathname, link.href) ? "#fff" : undefined,
                    boxShadow:
                      isActivePath(pathname, link.href)
                        ? C.shadowWarmSm
                        : "none",
                    border: isActivePath(pathname, link.href)
                      ? "none"
                      : `1px solid ${C.borderSubtle}`,
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ height: "72px" }} />
    </>
  );
}
