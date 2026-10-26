// Prompt + response parsing for a location's AI profile (description, best
// light, best for, pro tip, environments). Evidence only: the verified place,
// what the photographer's own sessions there show (session types, recorded
// lighting and start times) and the engine's per-photo analysis. The model is
// told to leave a field empty rather than invent parking, permits, hours,
// access rules or precise lighting claims.
import { z } from "zod";
import { extractJsonObject } from "@/lib/contentEngine/analysisResponse";
import type { BuiltPrompt } from "@/lib/contentEngine/prompts";
import type { KnownPlace } from "@/lib/locations/places";
import {
  ENVIRONMENTS, isEnvironment, sessionKindLabel, sortEnvironments, type Environment,
} from "@/lib/locationLibrary/taxonomy";

export const PROFILE_PROMPT_VERSION = "2026-10-26.1";
const MAX_TEXT = 420;
const MAX_PHOTOS = 24;

export interface ProfileSessionEvidence {
  kinds: string[];
  lightingCondition: string | null;
  startTime: string | null;
  vibe: string | null;
}

export interface ProfilePhotoEvidence {
  title: string | null;
  description: string | null;
  tags: string[];
}

export interface ProfileInput {
  place: KnownPlace;
  sessions: ProfileSessionEvidence[];
  photos: ProfilePhotoEvidence[];
  /** Fields the photographer wrote — context the model must agree with, never rewrite. */
  lockedContext: Record<string, string>;
}

export interface LocationProfile {
  description: string;
  best_for: string;
  best_time: string;
  tip: string;
  environments: Environment[];
}

function sessionLines(sessions: ProfileSessionEvidence[]): string {
  if (sessions.length === 0) return "- (no sessions yet)";
  return sessions.map((s) => {
    const kinds = s.kinds.map(sessionKindLabel).join(" + ") || "session";
    const light = [s.lightingCondition, s.startTime ? `started ${s.startTime.slice(0, 5)}` : null]
      .filter(Boolean).join(", ");
    return `- ${kinds}${light ? ` — recorded light: ${light}` : ""}${s.vibe ? ` — vibe: ${s.vibe}` : ""}`;
  }).join("\n");
}

function photoLines(photos: ProfilePhotoEvidence[]): string {
  if (photos.length === 0) return "- (no analyzed photos)";
  return photos.slice(0, MAX_PHOTOS).map((p) => {
    const text = [p.title, p.description].filter(Boolean).join(": ").slice(0, 300);
    return `- ${text}${p.tags.length ? ` [${p.tags.slice(0, 8).join(", ")}]` : ""}`;
  }).join("\n");
}

export function buildLocationProfilePrompt(input: ProfileInput): BuiltPrompt {
  const { place } = input;
  const facts = place.verifiedFacts.length ? place.verifiedFacts.map((f) => `- ${f}`).join("\n") : "- (none)";
  const locked = Object.entries(input.lockedContext).filter(([, v]) => v.trim());
  const envList = ENVIRONMENTS.map((e) => `${e.value} (${e.label})`).join(", ");
  return {
    system:
      "You write for soloxsnaps, Chris Solorzano's Bay Area photography site, in Chris's voice: a working " +
      "photographer telling a client what a spot is like to shoot. Warm, specific, plain — no marketing " +
      "superlatives, no keyword stuffing, no filler like 'nestled' or 'breathtaking'. Never invent facts. " +
      "Only state what the evidence below supports: the verified place, the sessions Chris actually shot " +
      "there, and the photo analysis. Do NOT state parking, permits, fees, hours, access rules, crowd " +
      "levels or precise sun angles unless they appear in the verified facts. If the evidence does not " +
      "support a field, return an empty string for it — an empty field goes to Chris for review.",
    userText:
      `Place: ${place.name} — ${place.city}, ${place.county}, ${place.state}.\n` +
      `Photographer-verified facts (the only practical facts you may state):\n${facts}\n\n` +
      `Sessions Chris shot here:\n${sessionLines(input.sessions)}\n\n` +
      `What the photos show (engine analysis):\n${photoLines(input.photos)}\n\n` +
      (locked.length
        ? `Already written by Chris (agree with it, do not repeat it word for word):\n${locked.map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\n`
        : "") +
      "Return ONLY a JSON object with:\n" +
      "\"description\": 1-3 sentences on what the location looks like and why it photographs well;\n" +
      "\"best_time\": the light that works, based on the recorded session light and what the photos show — " +
      "general (\"golden hour\", \"soft overcast light\"), never a clock time you were not given;\n" +
      "\"best_for\": a short comma-separated list of session types it suits, led by the ones actually shot here;\n" +
      "\"tip\": one practical shooting/composition tip grounded in what the photos show (framing, where to stand, " +
      "what to use as a backdrop) — no logistics claims;\n" +
      `"environments": 1-4 values from this closed list that the photos clearly show: ${envList}.`,
  };
}

const clamp = (v: string) => {
  const t = v.trim().replace(/\s+/g, " ");
  if (t.length <= MAX_TEXT) return t;
  const cut = t.slice(0, MAX_TEXT);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), MAX_TEXT - 40)).trim()}…`;
};

const responseSchema = z.object({
  description: z.string().default(""),
  best_for: z.string().default(""),
  best_time: z.string().default(""),
  tip: z.string().default(""),
  environments: z.array(z.string()).default([]),
});

/** Throws when the model returned no usable JSON object; unknown environments are dropped. */
export function parseLocationProfile(text: string): LocationProfile {
  const parsed = responseSchema.safeParse(extractJsonObject(text));
  if (!parsed.success) throw new Error("the model did not return a location profile");
  const p = parsed.data;
  return {
    description: clamp(p.description),
    best_for: clamp(p.best_for),
    best_time: clamp(p.best_time),
    tip: clamp(p.tip),
    environments: sortEnvironments(p.environments.filter(isEnvironment)).slice(0, 4),
  };
}
