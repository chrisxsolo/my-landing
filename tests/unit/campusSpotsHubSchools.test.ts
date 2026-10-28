// /grad-guide/campus-spots must reach every campus that has a /grads/<slug>
// page: schools with spot guides get their sections, the rest are listed as
// "coming soon" with a link to their campus page.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CampusSpotsContent from "@/app/(professional)/grad-guide/campus-spots/CampusSpotsContent";
import { guideCampusSpots } from "@/app/(professional)/grad-guide/campus-spots/guideSpots";
import { data as usf } from "@/app/(professional)/grads/usf/data";
import type { LocationSpot } from "@/lib/gradGuideData";
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

describe("campus spots hub: USF cards come from the consolidated guide", () => {
  const row = (id: number, name: string, image_url: string): LocationSpot => ({
    id, school_id: "usf", school_name: "University of San Francisco", school_short: "USF", name,
    description: "", tip: "", icon: "🏫", image_url, order: id,
  });
  const rows = [
    row(16, "Gleeson Library", "https://x/gleeson.jpg"), row(21, "Lone Mountain", "https://x/palms.jpg"),
    row(20, "In Front of Church", "https://x/church.jpg"), row(22, "Glass Hallway", "https://x/hall.jpg"),
  ];
  const spots = guideCampusSpots("usf", "usf", usf, rows, null);
  const html = renderToStaticMarkup(createElement(CampusSpotsContent, { spots }));
  const usfSection = html.split('id="usf"')[1] ?? "";
  const cardTitles = [...usfSection.matchAll(/<h3 class="gg-pose-title">([^<]+)<\/h3>/g)].map((m) => m[1]);

  it("renders exactly four USF cards, in the guide's order, with no standalone wolf or stairs card", () => {
    expect(cardTitles).toEqual([
      "St. Ignatius Church", "Gleeson Library &amp; Los Lobos de Loyola", "USF Glass Hallway", "Lone Mountain Palm Trees &amp; Main Building",
    ]);
    expect(usfSection).not.toContain("Lone Mountain Stairs");
    expect(usfSection).not.toContain("Wolf Sculpture");
  });

  it("leaves no USF placeholder behind: every card has its chosen photo", () => {
    expect(usfSection).not.toContain("Photo via Supabase");
    expect(spots.every((s) => s.image_url)).toBe(true);
  });
});
