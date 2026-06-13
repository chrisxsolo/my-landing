// Public, FAIL-CLOSED visitor-session intake (mirrors /api/track-event §10):
// production-only, bot-UA filter, admin-cookie skip, rate-limited, small body
// cap, allowlist-normalized. Always 202 — the beacon never learns why it dropped.
//
// Upsert semantics keep FIRST-TOUCH attribution: landing_page, first_referrer,
// and utm_* are written once (insert) and never overwritten; only latest_referrer
// and last_seen_at refresh on return visits.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import {
  isLikelyBot, normalizeVisitorId, normalizeEventPath, normalizeReferrer,
} from "@/lib/contentEngine/trackEventRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCEPTED = NextResponse.json({ ok: true }, { status: 202 });
const MAX_BODY_BYTES = 1024;

function utm(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, 120);
}

export async function POST(req: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return ACCEPTED;          // fail closed off-prod
  if (isLikelyBot(req.headers.get("user-agent"))) return ACCEPTED;       // bots dropped
  if (req.cookies.get("admin_session")?.value) return ACCEPTED;          // admin visits skipped

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`visitor:${ip}`, 30, 60_000).ok) return ACCEPTED;

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return ACCEPTED;
  }
  if (raw.length === 0 || raw.length > MAX_BODY_BYTES) return ACCEPTED;

  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    const id = normalizeVisitorId(body.id);
    if (!id) return ACCEPTED; // no valid visitor key → nothing to upsert

    const referrer = normalizeReferrer(typeof body.referrer === "string" ? body.referrer : "");
    const landingPage = normalizeEventPath(typeof body.landingPage === "string" ? body.landingPage : "");
    const client = createSupabaseAdminClient();

    // Insert-if-new (first touch). on-conflict-do-nothing preserves the original
    // landing page, first referrer, and campaign tags.
    await client
      .from("visitor_sessions")
      .upsert(
        {
          anonymous_session_id: id,
          landing_page: landingPage,
          first_referrer: referrer,
          latest_referrer: referrer,
          utm_source: utm(body.utmSource),
          utm_medium: utm(body.utmMedium),
          utm_campaign: utm(body.utmCampaign),
          utm_content: utm(body.utmContent),
        },
        { onConflict: "anonymous_session_id", ignoreDuplicates: true },
      );

    // Refresh recency + most-recent referrer on every visit (new or returning).
    await client
      .from("visitor_sessions")
      .update({ latest_referrer: referrer, last_seen_at: new Date().toISOString() })
      .eq("anonymous_session_id", id);
  } catch (err) {
    console.error("track-visitor failed", err);
  }
  return ACCEPTED;
}
