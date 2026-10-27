// /grad-guide/campus-spots must reach every campus that has a /grads/<slug>
// page: schools with spot guides get their sections, the rest are listed as
// "coming soon" with a link to their campus page.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CampusSpotsContent from "@/app/(professional)/grad-guide/campus-spots/CampusSpotsContent";
import { GRAD_SCHOOL_LINKS } from "@/lib/portfolioCategoryContent";

vi.mock("next/image", () => ({ default: () => null }));

const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);

describe("campus spots hub school coverage", () => {
  const html = renderToStaticMarkup(createElement(CampusSpotsContent, { spots: [] }));
  const links = hrefs(html);

  it("links every grad school page exactly once", () => {
    for (const school of GRAD_SCHOOL_LINKS) {
      expect(links.filter((href) => href === school.href)).toHaveLength(1);
    }
  });

  it("lists schools without a spot guide as coming soon", () => {
    const comingSoon = html.split("Spot guides coming soon")[1] ?? "";
    expect(hrefs(comingSoon)).toEqual(expect.arrayContaining(["/grads/stanford", "/grads/santa-clara"]));
    expect(hrefs(comingSoon)).not.toContain("/grads/sjsu");
  });
});
