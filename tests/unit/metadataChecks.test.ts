// Snippet-length advice for titles and descriptions: flags blanks, stubs, and
// copy that will certainly be cut, and stays quiet for ordinary long titles.
import { describe, expect, it } from "vitest";
import { metadataWarnings } from "@/lib/seo/metadataChecks";

describe("metadataWarnings", () => {
  it("accepts a normal title and description", () => {
    expect(metadataWarnings({
      title: "Golden Hour Couples Session at Shark Fin Cove",
      description: "A coastal couples session at Shark Fin Cove in Davenport, shot at golden hour with the sea stack behind them.",
    })).toEqual([]);
  });

  it("flags blank fields without blocking", () => {
    expect(metadataWarnings({ title: "", description: null })).toEqual([
      "Title is blank.",
      "Meta description is blank; the post body will be used as the snippet.",
    ]);
  });

  it("flags stubs and very long copy with the measured length", () => {
    const warnings = metadataWarnings({ title: "Grad photos", description: "x".repeat(240) });
    expect(warnings[0]).toMatch(/very short \(11 characters\)/);
    expect(warnings[1]).toMatch(/long \(240 characters\)/);
  });

  it("does not warn on a descriptive 68-character title", () => {
    const title = "Best University of San Francisco Graduation Photo Locations and Tips";
    expect(title).toHaveLength(68);
    expect(metadataWarnings({ title, description: "Where to shoot graduation portraits at USF, with the best light and timing for each spot." })).toEqual([]);
  });
});
