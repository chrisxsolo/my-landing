"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { label: "Home", href: "/" },
  { label: "Grads", href: "/portfolio?category=grads" },
  { label: "Families", href: "/portfolio?category=families" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "https://www.soloxsnaps.com/contact/" },
  { label: "Blog", href: "/blog" },
];

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return path === "/" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}

function NavLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active = href.startsWith("http") ? false : isActive(pathname, href);
  const className = `font-serif text-sm uppercase text-[#242424] transition-opacity hover:opacity-55 ${
    active ? "opacity-100" : "opacity-80"
  }`;

  if (href.startsWith("http")) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export default function ProNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="relative z-50 bg-[#fbfbfa] text-[#242424]">
      <nav className="mx-auto flex max-w-[1460px] items-center justify-between px-6 py-7 sm:px-10 lg:justify-center lg:gap-20">
        <Link href="/" className="font-serif text-xl lowercase text-[#242424] lg:hidden">
          soloxsnaps
        </Link>

        <div className="hidden w-full max-w-6xl items-center justify-between lg:flex">
          {links.map((link) => (
            <NavLink key={link.href} {...link} pathname={pathname} />
          ))}
        </div>

        <button
          type="button"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-10 w-10 items-center justify-center border border-black/20 lg:hidden"
        >
          <span className="relative h-4 w-5">
            <span
              className="absolute left-0 top-0 h-px w-5 bg-black transition-transform"
              style={{ transform: open ? "translateY(7px) rotate(45deg)" : "none" }}
            />
            <span
              className="absolute left-0 top-[7px] h-px w-5 bg-black transition-opacity"
              style={{ opacity: open ? 0 : 1 }}
            />
            <span
              className="absolute left-0 top-[14px] h-px w-5 bg-black transition-transform"
              style={{ transform: open ? "translateY(-7px) rotate(-45deg)" : "none" }}
            />
          </span>
        </button>
      </nav>

      {open ? (
        <div className="border-t border-black/10 px-6 py-6 lg:hidden">
          <div className="grid gap-5">
            {links.map((link) =>
              link.href.startsWith("http") ? (
                <a key={link.href} href={link.href} className="font-serif text-base uppercase text-[#242424]">
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className="font-serif text-base uppercase text-[#242424]">
                  {link.label}
                </Link>
              )
            )}
            <Link href="/home" className="pt-3 text-sm text-black/55">
              Fun site
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
