import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { data as berkeley } from "@/app/(professional)/grads/uc-berkeley/data";
import { data as sjsu } from "@/app/(professional)/grads/sjsu/data";
import { data as csueb } from "@/app/(professional)/grads/csueb/data";
import { data as santaClara } from "@/app/(professional)/grads/santa-clara/data";
import { data as stanford } from "@/app/(professional)/grads/stanford/data";
import { data as sfState } from "@/app/(professional)/grads/sf-state/data";
import { data as usf } from "@/app/(professional)/grads/usf/data";

const SCHOOLS = [berkeley, sjsu, csueb, santaClara, stanford, sfState, usf];

describe("campus guides never list a travel fee", () => {
  it.each(SCHOOLS.map((s) => [s.school, s] as const))("%s guide has no travel-fee charge", (_name, school) => {
    const text = JSON.stringify(school);
    expect(text).not.toMatch(/\$\d[\d.,]*\s+travel fee/i);
    expect(text).not.toMatch(/may add a travel fee/i);
  });

  it("the shared school template has no travel-fee line", () => {
    for (const file of ["app/components/SchoolLandingTemplate.tsx", "app/components/SchoolLandingDetails.tsx"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/travelNote|TravelNote/);
    }
  });
});
