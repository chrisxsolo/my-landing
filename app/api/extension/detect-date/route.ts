import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveRushPreview } from "@/lib/extension/rushPreview";
import { sessionFactsForInquiry } from "@/lib/extension/sessionFacts";
import { resolveSession } from "@/lib/invoiceDraft/session";
import { invoiceDraftRequestSchema } from "@/lib/invoiceDraft/types";

const EXTENSION_SECRET = process.env.CRON_SECRET ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-extension-secret, content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-extension-secret");
  if (!token || token !== EXTENSION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  const body = invoiceDraftRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "inquiry_id must be a positive integer" }, { status: 400, headers: CORS });

  const supabase = createSupabaseServerClient();
  const { data: inq, error } = await supabase
    .from("inquiries")
    .select("name, email, date_in_mind, message, session_type, school, people")
    .eq("id", body.data.inquiry_id)
    .maybeSingle();

  if (error) {
    console.error("Extension detect-date inquiry fetch error:", error);
    return NextResponse.json({ error: "Failed to load inquiry" }, { status: 500, headers: CORS });
  }
  if (!inq) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });

  try {
    const facts = await sessionFactsForInquiry(inq);
    // The Rush preview add-on is priced here, from the catalog, so the
    // browser never carries a price of its own. Contract previews for the
    // couples services carry no travel line, hence travelCents 0.
    const session = resolveSession(inq, facts.session_type);
    const rush_preview_charge = resolveRushPreview(facts, { serviceKey: session.serviceKey, baseCents: session.baseCents, travelCents: 0 });
    return NextResponse.json({ ...facts, rush_preview_charge }, { headers: CORS });
  } catch (err) {
    console.error("Extension detect-date extraction error:", err);
    return NextResponse.json({ error: "Could not read the email thread" }, { status: 502, headers: CORS });
  }
}
