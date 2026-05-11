import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { CLIENT_SESSION_TABLE, type ClientSessionRow } from "@/lib/clientSessions";

export const dynamic = "force-dynamic";

function icsDate(dateStr: string): string {
  // dateStr may be a full ISO timestamptz — extract just YYYY-MM-DD portion
  return dateStr.slice(0, 10).replace(/-/g, "");
}

function icsEscape(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export async function GET(req: NextRequest) {
  const secret = process.env.ICS_SECRET;
  const token = req.nextUrl.searchParams.get("token");

  if (!secret || token !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (e) {
    return new NextResponse(`Supabase init failed: ${e}`, { status: 500 });
  }

  const { data, error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .select("id, client_name, session_type, session_date, location")
    .not("session_date", "is", null)
    .order("session_date", { ascending: true });

  if (error) {
    return new NextResponse(`Failed to load sessions: ${error.message}`, { status: 500 });
  }

  const rows = (data ?? []) as Pick<ClientSessionRow, "id" | "client_name" | "session_type" | "session_date" | "location">[];

  const now = stamp();
  const events = rows.map(row => {
    const dateVal = icsDate(row.session_date!);
    // All-day event: DTEND is the next calendar day
    const datePart = row.session_date!.slice(0, 10);
    const d = new Date(datePart + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const nextDay = d.toISOString().slice(0, 10).replace(/-/g, "");

    const summary = [row.session_type, row.client_name].filter(Boolean).join(" — ");
    const location = row.location ?? "";

    return [
      "BEGIN:VEVENT",
      `UID:soloxsnaps-session-${row.id}@soloxsnaps.com`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dateVal}`,
      `DTEND;VALUE=DATE:${nextDay}`,
      `SUMMARY:${icsEscape(summary || "Photography Session")}`,
      location ? `LOCATION:${icsEscape(location)}` : null,
      "END:VEVENT",
    ].filter(Boolean).join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Solox Snaps//Sessions//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Solox Snaps Sessions",
    "X-WR-TIMEZONE:America/Los_Angeles",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
