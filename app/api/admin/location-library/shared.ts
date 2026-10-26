// Shared plumbing for the location library admin routes.
import { NextResponse } from "next/server";
import { LocationEditError } from "@/lib/locationLibrary/editRules";

export function parseLocationId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Edit errors carry their own status; anything else is logged and becomes a 500. */
export function errorResponse(err: unknown, fallback: string) {
  if (err instanceof LocationEditError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[admin/location-library] ${fallback}`, err);
  return NextResponse.json({ error: err instanceof Error ? err.message : fallback }, { status: 500 });
}
