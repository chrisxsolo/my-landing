// Shared HTTP mapping for the scheduling routes: one place decides which
// status a service outcome becomes, so every route answers the same way.
import { NextResponse } from "next/server";
import type { ScheduleMutationResult } from "@/lib/contentPublishing/scheduleService";
import type { ScheduleInput } from "@/lib/contentPublishing/localTime";

export function scheduleResultResponse(result: ScheduleMutationResult): NextResponse {
  switch (result.outcome) {
    case "ok": return NextResponse.json({ schedule: result.schedule });
    case "invalid": return NextResponse.json({ error: result.message, code: result.code ?? null }, { status: 400 });
    case "not_found": return NextResponse.json({ error: "not found" }, { status: 404 });
    case "not_ready": return NextResponse.json({ error: result.message, code: "not_ready" }, { status: 422 });
    case "conflict": return NextResponse.json({ error: result.message, code: "conflict", schedule: result.schedule ?? null }, { status: 409 });
    case "already_published":
      return NextResponse.json({ error: "Already published", code: "already_published", schedule: result.schedule }, { status: 409 });
  }
}

/** The client's time fields, untyped: the resolver validates them. */
export function scheduleInputFrom(body: Record<string, unknown>): ScheduleInput {
  return { localWallTime: body.localWallTime, timeZone: body.timeZone, disambiguation: body.disambiguation };
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function versionFrom(body: Record<string, unknown>): number | null {
  return typeof body.scheduleVersion === "number" && Number.isInteger(body.scheduleVersion) && body.scheduleVersion >= 1
    ? body.scheduleVersion : null;
}
