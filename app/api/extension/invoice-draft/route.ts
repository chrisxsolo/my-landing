// The invoice the Pixieset extension fills, priced here so the browser never
// works out travel on its own.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { BOOKING_INQUIRY_COLUMNS, INQUIRIES_TABLE, resolveBooking } from "@/lib/extension/bookingResolution";
import { invoiceDraftRequestSchema, type InvoiceInquiry } from "@/lib/invoiceDraft/types";

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
    .from(INQUIRIES_TABLE)
    .select(BOOKING_INQUIRY_COLUMNS)
    .eq("id", body.data.inquiry_id)
    .maybeSingle<InvoiceInquiry>();

  if (error) {
    console.error("Extension invoice-draft inquiry fetch error:", error);
    return NextResponse.json({ error: "Failed to load inquiry" }, { status: 500, headers: CORS });
  }
  if (!inq) return NextResponse.json({ error: "Inquiry not found" }, { status: 404, headers: CORS });

  let resolved;
  try {
    resolved = await resolveBooking(supabase, inq);
  } catch (err) {
    console.error("Extension invoice-draft extraction error:", err);
    return NextResponse.json({ error: "Could not read the email thread" }, { status: 502, headers: CORS });
  }
  if (!resolved.ok) {
    console.error("Extension invoice-draft produced an invalid draft:", resolved.error);
    return NextResponse.json({ error: `Invoice draft failed validation (${resolved.error})` }, { status: 500, headers: CORS });
  }
  return NextResponse.json({ draft: resolved.draft, facts: resolved.facts }, { headers: CORS });
}
