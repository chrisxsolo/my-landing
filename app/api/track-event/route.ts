// Public, FAIL-CLOSED analytics intake (spec §10): production-only, bot-UA
// filter, admin-cookie skip, rate-limited, 2KB body cap, allowlist-validated,
// server timestamps. Always 202 — the beacon never learns why a hit dropped.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { isLikelyBot } from "@/lib/contentEngine/trackEventRules";
import { recordContentEvent } from "@/lib/contentEngine/recordEvent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCEPTED = NextResponse.json({ ok: true }, { status: 202 });
const MAX_BODY_BYTES = 2048;

export async function POST(req: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return ACCEPTED;          // fail closed off-prod
  if (isLikelyBot(req.headers.get("user-agent"))) return ACCEPTED;       // bots dropped
  if (req.cookies.get("admin_session")?.value) return ACCEPTED;          // admin visits skipped

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`track:${ip}`, 30, 60_000).ok) return ACCEPTED;

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return ACCEPTED;
  }
  if (raw.length === 0 || raw.length > MAX_BODY_BYTES) return ACCEPTED;

  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    await recordContentEvent(createSupabaseAdminClient(), {
      event: typeof body.event === "string" ? body.event : "",
      path: typeof body.path === "string" ? body.path : "",
      contentType: typeof body.contentType === "string" ? body.contentType : null,
      contentId: typeof body.contentId === "string" ? body.contentId : null,
      referrer: typeof body.referrer === "string" ? body.referrer : "",
      target:
        body.target && typeof body.target === "object"
          && typeof (body.target as Record<string, unknown>).type === "string"
          && typeof (body.target as Record<string, unknown>).id === "string"
          ? { type: (body.target as Record<string, string>).type, id: (body.target as Record<string, string>).id }
          : null,
      anonymousSessionId: typeof body.anonymousSessionId === "string" ? body.anonymousSessionId : null,
      meta: body.meta && typeof body.meta === "object" ? (body.meta as Record<string, unknown>) : null,
    });
  } catch (err) {
    console.error("track-event failed", err);
  }
  return ACCEPTED;
}
