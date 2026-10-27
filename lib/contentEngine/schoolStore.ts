// Server-side school lookups: the built-in registry plus rows from
// content_engine_schools. Every path that accepts or describes a session's
// school goes through here, so a custom school added once is valid everywhere.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BUILT_IN_SCHOOL_OPTIONS, CUSTOM_SCHOOLS_TABLE, builtInSchool, findDuplicateSchool, matchSchoolCandidate,
  schoolMatchKey, type SchoolCandidate, type SchoolMatch, type SchoolOption,
} from "@/lib/contentEngine/schools";
import { buildSessionFactsSnapshot, type SessionFactsSnapshot } from "@/lib/contentEngine/payloads";

const COLUMNS = "slug,name,short_name,aliases";

interface SchoolRow { slug: string; name: string; short_name: string | null; aliases: string[] | null }

const toOption = (row: SchoolRow): SchoolOption => ({
  slug: row.slug, name: row.name, shortName: row.short_name, aliases: row.aliases ?? [], builtIn: false,
});

/** Built-in schools first, then custom ones by name. */
export async function listSchools(client: SupabaseClient): Promise<SchoolOption[]> {
  const { data, error } = await client.from(CUSTOM_SCHOOLS_TABLE).select(COLUMNS).order("name");
  if (error) throw new Error(`could not load schools: ${error.message}`);
  // A custom school later promoted to a real /grads page keeps the built-in entry.
  const custom = ((data ?? []) as SchoolRow[]).map(toOption).filter((s) => !builtInSchool(s.slug));
  return [...BUILT_IN_SCHOOL_OPTIONS, ...custom];
}

export async function findSchool(client: SupabaseClient, slug: string): Promise<SchoolOption | null> {
  const builtIn = builtInSchool(slug);
  if (builtIn) return builtIn;
  const { data, error } = await client.from(CUSTOM_SCHOOLS_TABLE)
    .select(COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`could not look up school: ${error.message}`);
  return data ? toOption(data as SchoolRow) : null;
}

export type CreateSchoolResult =
  | { created: true; school: SchoolOption }
  | { created: false; existing: SchoolOption; match: SchoolMatch["kind"] };

export interface CreateSchoolOptions {
  /** The admin confirmed a look-alike (findSimilarSchool) is a different school. */
  allowSimilar?: boolean;
}

/**
 * Inserts a validated candidate unless it duplicates an existing school by
 * slug or normalized name/short name/alias (a hard block), or looks like one
 * (a suggestion the caller can override with allowSimilar). A unique violation
 * (double submit, two tabs) resolves to the row that won.
 */
export async function createCustomSchool(
  client: SupabaseClient, candidate: SchoolCandidate, options: CreateSchoolOptions = {},
): Promise<CreateSchoolResult> {
  const match = matchSchoolCandidate(candidate, await listSchools(client));
  if (match && (match.kind === "duplicate" || !options.allowSimilar)) {
    return { created: false, existing: match.school, match: match.kind };
  }

  const { data, error } = await client.from(CUSTOM_SCHOOLS_TABLE).insert({
    slug: candidate.slug,
    name: candidate.name,
    short_name: candidate.shortName,
    name_key: schoolMatchKey(candidate.name),
    aliases: candidate.aliases ?? [],
  }).select(COLUMNS).single();

  if (error?.code === "23505") {
    const winner = findDuplicateSchool(candidate, await listSchools(client));
    if (winner) return { created: false, existing: winner, match: "duplicate" };
  }
  if (error) throw new Error(`could not save school: ${error.message}`);
  return { created: true, school: toOption(data as SchoolRow) };
}

/**
 * The facts snapshot with the school's real name resolved, so the AI writes
 * "UC Law SF" instead of guessing from a slug.
 */
export async function loadSessionFactsSnapshot(
  client: SupabaseClient, session: Record<string, unknown>,
): Promise<SessionFactsSnapshot> {
  const slug = typeof session.school_slug === "string" ? session.school_slug : null;
  const school = slug ? await findSchool(client, slug) : null;
  return buildSessionFactsSnapshot(session, school);
}
