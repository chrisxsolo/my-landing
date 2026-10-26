// POST { action, ... } for one location:
//   regenerate                         AI profile for unlocked fields
//   photo      { photoId, mode }       mode include | hide | null (automatic)
//   exclude_session / attach_session   { sessionId }
//   move_session { sessionId, targetId }
//   merge      { sourceId }            merge another location INTO this one
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { loadAdminDetail } from "@/lib/locationLibrary/adminView";
import { generateLocationProfile } from "@/lib/locationLibrary/profile";
import {
  attachSession, excludeSession, mergeLocations, moveSession, parseSessionId, setPhotoOverride,
} from "@/lib/locationLibrary/adminLinks";
import { LocationEditError } from "@/lib/locationLibrary/editRules";
import type { SupabaseClient } from "@supabase/supabase-js";
import { errorResponse, parseLocationId, readJson } from "../../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

function otherId(value: unknown): number {
  const id = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new LocationEditError("pick a location");
  return id;
}

async function regenerate(client: SupabaseClient, id: number) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new LocationEditError("ANTHROPIC_API_KEY is not configured");
  const result = await generateLocationProfile(client, createAnthropicCaller(apiKey), id);
  if (result.status === "failed") throw new Error(result.message);
  return result.message;
}

async function run(client: SupabaseClient, id: number, body: Record<string, unknown>): Promise<string | null> {
  switch (body.action) {
    case "regenerate": return regenerate(client, id);
    case "photo": await setPhotoOverride(client, id, body.photoId, body.mode ?? null); return null;
    case "exclude_session": await excludeSession(client, id, parseSessionId(body.sessionId)); return null;
    case "attach_session": await attachSession(client, id, parseSessionId(body.sessionId)); return null;
    case "move_session":
      await moveSession(client, id, parseSessionId(body.sessionId), otherId(body.targetId));
      return null;
    case "merge": await mergeLocations(client, id, otherId(body.sourceId)); return null;
    default: throw new LocationEditError("unknown action");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const id = parseLocationId((await params).id);
  if (!id) return NextResponse.json({ error: "invalid location id" }, { status: 400 });
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  try {
    const client = createSupabaseAdminClient();
    const message = await run(client, id, body);
    revalidatePublicContent();
    return NextResponse.json({ message, detail: await loadAdminDetail(client, id) });
  } catch (err) {
    return errorResponse(err, "location action failed");
  }
}
