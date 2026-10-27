// The family journal archive renders noindex while it has no posts, so the
// family hub and location pages link to it only once a post exists; the hub's
// location grid shows an empty note instead of nothing when no guide is published.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FamilyGuideContent from "@/app/(professional)/family-guide/FamilyGuideContent";
import FamilyLocationTemplate from "@/app/(professional)/family-guide/locations/[slug]/FamilyLocationTemplate";
import { getFamilyLocation, getFamilyLocationSummaries } from "@/lib/familyGuide/locations";
import { FAMILY_JOURNAL_PATH } from "@/lib/familyGuide/journal";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/(professional)/family-guide/FamilyJournalStrip", () => ({ default: () => null }));
vi.mock("@/app/components/ContentEventBeacon", () => ({ default: () => null }));

const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);

describe("family hub journal card", () => {
  const render = (journalHasPosts: boolean) => renderToStaticMarkup(
    createElement(FamilyGuideContent, { locations: getFamilyLocationSummaries(), galleryImages: [], journalHasPosts }),
  );

  it("links the journal archive once it has posts", () => {
    expect(hrefs(render(true))).toContain(FAMILY_JOURNAL_PATH);
  });

  it("drops the journal card while the archive is empty", () => {
    const html = render(false);
    expect(hrefs(html)).not.toContain(FAMILY_JOURNAL_PATH);
    expect(hrefs(html)).toContain("/family-guide/locations");
  });

  it("shows an empty note instead of a bare grid when no family guide is published", () => {
    const html = renderToStaticMarkup(
      createElement(FamilyGuideContent, { locations: [], galleryImages: [], journalHasPosts: false }),
    );
    expect(html).toContain("fg-empty");
  });
});

describe("family location page journal link", () => {
  const data = getFamilyLocation("palace-of-fine-arts")!;
  const render = (journalHasPosts: boolean) => renderToStaticMarkup(
    createElement(FamilyLocationTemplate, { data, photos: [], journalHasPosts }),
  );

  it("links the journal archive once it has posts", () => {
    expect(hrefs(render(true))).toContain(FAMILY_JOURNAL_PATH);
  });

  it("omits the journal link while the archive is empty, keeping the other related links", () => {
    const links = hrefs(render(false));
    expect(links).not.toContain(FAMILY_JOURNAL_PATH);
    expect(links).toContain("/family-guide/faq");
  });
});
