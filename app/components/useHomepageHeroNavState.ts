"use client";

import { useEffect, useState } from "react";

export function useHomepageHeroNavState(pathname: string) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (pathname !== "/") return;

    const updateScrollState = () => setScrolled(window.scrollY > 36);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, [pathname]);

  return pathname === "/" && !scrolled;
}
