import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { CLIENT_SESSION_TABLE, type ClientSessionRow } from "@/lib/clientSessions";

export const dynamic = "force-dynamic";

function icsDate(dateStr: string): string {
  // dateStr is "YYYY-MM-DD" — emit as all-day DATE value
  return dateStr.replace(/-/g, "");
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

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .select("id, client_name, session_type, session_date, location")
    .not("session_date", "is", null)
    .order("session_date", { ascending: true });

  if (error) {
    return new NextResponse("Failed to load sessions", { status: 500 });
  }

  const rows = (data ?? []) as Pick<ClientSessionRow, "id" | "client_name" | "session_type" | "session_date" | "location">[];

  const now = stamp();
  const events = rows.map(row => {
    const dateVal = icsDate(row.session_date!);
    // All-day event: DTEND is the next day
    const d = new Date(row.session_date! + "T00:00:00");
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
      "Content-Disposition": 'attachment; filename="sessions.ics"',
      "Cache-Control": "no-store",
    },
  });
}
