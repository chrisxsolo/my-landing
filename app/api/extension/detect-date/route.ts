// What the client's thread settled, for the Pixieset contract preview. The
// flat fields are what every extension build reads; `resolved` is the same
// draft /api/extension/invoice-draft returns for this booking, so a build
// that reads it shows the contract and the invoice one decision.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { BOOKING_INQUIRY_COLUMNS, INQUIRIES_TABLE, resolveBooking } from "@/lib/extension/bookingResolution";
import { resolveRushPreview } from "@/lib/extension/rushPreview";
import { sessionEvidenceFrom } from "@/lib/invoiceDraft/build";
import { resolveSession } from "@/lib/invoiceDraft/session";
import { invoiceDraftRequestSchema, type InvoiceInquiry, type SessionFacts } from "@/lib/invoiceDraft/types";

const EXTENSION_SECRET = process.env.CRON_SECRET ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-extension-secret, content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
}

/**
 * The overall confidence older extension builds print as "✓ Confirmed in
 * email". They cannot read date_status, so a date that was only requested
 * must not reach them under that label: anything short of a confirmed date
 * is capped at "medium" ("~ Likely from email").
 */
function legacyConfidence(facts: SessionFacts): SessionFacts["confidence"] {
  return facts.confidence === "high" && facts.date !== null && facts.date_status !== "confirmed" ? "medium" : facts.confidence;
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
    console.error("Extension detect-date inquiry fetch error:", error);
    return NextResponse.json({ error: "Failed to load inquiry" }, { status: 500, headers: CORS });
  }
  if (!inq) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });

  try {
    const booking = await resolveBooking(supabase, inq);
    if (!booking.ok) {
      console.error("Extension detect-date produced an invalid draft:", booking.error);
      return NextResponse.json({ error: `Booking resolution failed validation (${booking.error})` }, { status: 500, headers: CORS });
    }
    const { facts, draft } = booking;
    // Older extension builds price the contract in the browser and add this
    // charge themselves. It is priced here, from the catalog, with no travel
    // line (travelCents 0). Builds that read `resolved` ignore it: the
    // resolved total already contains the add-on.
    const session = resolveSession(inq, facts.session_type, facts.package, sessionEvidenceFrom(facts));
    const rush_preview_charge = resolveRushPreview(facts, { serviceKey: session.serviceKey, baseCents: session.baseCents, travelCents: 0 });
    return NextResponse.json({ ...facts, confidence: legacyConfidence(facts), rush_preview_charge, resolved: draft }, { headers: CORS });
  } catch (err) {
    console.error("Extension detect-date extraction error:", err);
    return NextResponse.json({ error: "Could not read the email thread" }, { status: 502, headers: CORS });
  }
}
