// Prompt + response handling for AI vision tag suggestions. Pure.
//
// Vision runs only when a photo is missing an important field that no
// existing record can supply. The model may only choose from CLOSED lists
// (built-in schools, that school's campus spots, verified places) and must
// cite something visible that identifies the place — readable signage or a
// unique landmark. Scenery is never evidence: beaches, cliffs, gardens, lawns
// and generic buildings must come back null. Whatever it says, a vision
// suggestion is capped at MEDIUM confidence, so it always waits for the
// photographer's approval and is never applied in bulk.
import { BUILT_IN_SCHOOLS } from "@/lib/contentEngine/schools";
import { isSchoolSlug, SCHOOL_SLUGS } from "@/lib/contentEngine/taxonomy";
import type { KnownPlace } from "@/lib/locations/places";
import { spotsForSchool } from "@/lib/schoolSpots";
import type { TagField, TagSuggestion } from "@/lib/photoTagging/types";

export const VISION_PROMPT_VERSION = "2026-10-26.1";

export interface VisionRequest {
  category: string | null;
  /** Effective school, when the photo already has one. */
  school: string | null;
  /** Fields still missing with no high-confidence answer. */
  missing: readonly TagField[];
}

const SYSTEM = `You identify WHERE a professional portrait photo was taken, for a photographer's photo library.
Rules:
- Choose only from the lists provided. Never invent a name.
- Name a school, spot or place ONLY when something visible identifies it: readable signage or lettering, or a landmark that exists in exactly one place (for example Sather Gate's arch, the Palace of Fine Arts rotunda).
- Scenery is NOT evidence. Beaches, cliffs, ocean, forests, gardens, lawns, trees, stairs, brick or columned buildings that could be anywhere: answer null.
- Graduation gowns, stoles or colors alone do not identify a school unless school lettering is readable.
- When unsure, answer null. A wrong answer is far worse than null.
Reply with JSON only.`;

function schoolList(): string {
  return SCHOOL_SLUGS.map((slug) => `${slug}: ${BUILT_IN_SCHOOLS[slug].name}`).join("\n");
}

function spotList(school: string | null): string {
  const schools = school && isSchoolSlug(school) ? [school] : [...SCHOOL_SLUGS];
  return schools.flatMap((slug) => spotsForSchool(slug).map((s) => `${slug}/${s.key}: ${s.name}`)).join("\n");
}

export function buildVisionPrompt(req: VisionRequest, places: readonly KnownPlace[]): { system: string; text: string } {
  const grads = req.category === "grads";
  const ask = {
    school: grads && req.missing.includes("school"),
    spot: grads && (req.missing.includes("spot") || req.missing.includes("location") || req.missing.includes("school")),
    place: req.missing.includes("location"),
  };
  const sections = [
    `Photo category: ${req.category ?? "unknown"}.${req.school && isSchoolSlug(req.school) ? ` School: ${BUILT_IN_SCHOOLS[req.school].name}.` : ""}`,
    ask.school ? `SCHOOLS (answer the slug):\n${schoolList()}` : "",
    ask.spot ? `CAMPUS SPOTS (answer "school/spot"):\n${spotList(req.school)}` : "",
    ask.place ? `PLACES (answer the key):\n${places.map((p) => `${p.key}: ${p.name}`).join("\n")}` : "",
    `Answer: {"school": A|null, "spot": A|null, "place": A|null} where A = {"value": "<from the list>", "confidence": "high"|"medium"|"low", "evidence": "<what is visible that identifies it>"}.`
      + `${ask.school ? "" : " school must be null."}${ask.spot ? "" : " spot must be null."}${ask.place ? "" : " place must be null."}`,
  ];
  return { system: SYSTEM, text: sections.filter(Boolean).join("\n\n") };
}

interface Answer { value: string; confidence: string; evidence: string }

function answer(raw: unknown): Answer | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const value = typeof a.value === "string" ? a.value.trim() : "";
  const evidence = typeof a.evidence === "string" ? a.evidence.trim().slice(0, 200) : "";
  const confidence = typeof a.confidence === "string" ? a.confidence : "low";
  // Low confidence or no stated evidence → leave the field for manual review.
  if (!value || !evidence || (confidence !== "high" && confidence !== "medium")) return null;
  return { value, confidence, evidence };
}

function suggestion(field: TagField, value: string, label: string, evidence: string): TagSuggestion {
  return {
    id: `${field}:${value}`, field, value, label, confidence: "medium", origin: "vision",
    reason: `AI vision: ${evidence}`, appliesTo: "photo",
  };
}

/** Validated suggestions from the model's reply; anything off-list is dropped. */
export function parseVisionReply(
  parsed: unknown, req: VisionRequest, places: readonly KnownPlace[],
): TagSuggestion[] {
  if (!parsed || typeof parsed !== "object") return [];
  const reply = parsed as Record<string, unknown>;
  const out: TagSuggestion[] = [];
  const school = answer(reply.school);
  if (school && req.category === "grads" && isSchoolSlug(school.value)) {
    out.push(suggestion("school", school.value, BUILT_IN_SCHOOLS[school.value].shortName, school.evidence));
  }
  const spot = answer(reply.spot);
  const [spotSchool, spotKey] = spot ? spot.value.split("/") : [];
  const spotDef = spotSchool && isSchoolSlug(spotSchool) ? spotsForSchool(spotSchool).find((s) => s.key === spotKey) : undefined;
  const spotFits = !req.school || req.school === spotSchool;
  if (spot && spotDef && spotFits && req.category === "grads") {
    out.push(suggestion("spot", spotDef.key, spotDef.name, spot.evidence));
  }
  const place = answer(reply.place);
  const known = place ? places.find((p) => p.key === place.value) : undefined;
  if (place && known && req.missing.includes("location")) {
    out.push(suggestion("location", known.name, known.name, place.evidence));
  }
  return out;
}
