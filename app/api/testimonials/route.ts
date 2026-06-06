import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { preparePublicTestimonialInsert } from "@/lib/testimonialValidation";

const TESTIMONIALS_TABLE = "testimonials";
const MAX_BODY_BYTES = 12 * 1024;
const IP_LIMIT = 4;
const IP_WINDOW_MS = 15 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const GENERIC_ERROR = "Something went wrong while submitting your testimonial. Please try again";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
}

async function readBody(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 413 });
  }

  const input = preparePublicTestimonialInsert(await readBody(req));
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const limit = rateLimit(`testimonial:${getClientIp(req)}`, IP_LIMIT, IP_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many testimonial submissions. Please try again in a few minutes" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    const { data: duplicate, error: duplicateError } = await supabase
      .from(TESTIMONIALS_TABLE)
      .select("id")
      .eq("first_name", input.data.first_name)
      .eq("last_name", input.data.last_name)
      .eq("message", input.data.message)
      .gte("submitted_at", duplicateSince)
      .limit(1)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return NextResponse.json(
        { error: "We already received this testimonial. Thank you for sharing your experience" },
        { status: 409 },
      );
    }

    const { error } = await supabase.from(TESTIMONIALS_TABLE).insert(input.data);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[testimonials] POST failed:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
