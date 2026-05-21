import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { CLIENT_SESSION_TABLE, type ClientSessionRow } from "@/lib/clientSessions";

export const dynamic = "force-dynamic";

function icsDate(dateStr: string): string {
  return dateStr.slice(0, 10).replace(/-/g, "");
}

function icsEscape(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function nextDayStr(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

type CalEvent = {
  uid: string;
  summary: string;
  dateStr: string;
  location: string | null;
  preferredTime: string | null;
};

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

  // Pull from both tables in parallel
  const [portalRes, inquiryRes] = await Promise.all([
    supabase
      .from(CLIENT_SESSION_TABLE)
      .select("id, client_name, session_type, session_date, location, meeting_point")
      .not("session_date", "is", null)
      .order("session_date", { ascending: true }),
    supabase
      .from("inquiries")
      .select("id, name, session_type, session_date, location, preferred_time")
      .eq("booking_confirmed", true)
      .not("session_date", "is", null)
      .order("session_date", { ascending: true }),
  ]);

  if (portalRes.error) {
    return new NextResponse(`Failed to load sessions: ${portalRes.error.message}`, { status: 500 });
  }
  if (inquiryRes.error) {
    return new NextResponse(`Failed to load inquiries: ${inquiryRes.error.message}`, { status: 500 });
  }

  const events: CalEvent[] = [];

  // Portal sessions (client_sessions table)
  const portalRows = (portalRes.data ?? []) as Pick<ClientSessionRow, "id" | "client_name" | "session_type" | "session_date" | "location">[];
  for (const row of portalRows) {
    const summary = [row.session_type, row.client_name].filter(Boolean).join(" — ");
    events.push({
      uid: `soloxsnaps-session-${row.id}@soloxsnaps.com`,
      summary: summary || "Photography Session",
      dateStr: row.session_date!,
      location: row.location ?? null,
      preferredTime: null,
    });
  }

  // Inquiry-based sessions — only add if not already covered by a portal session
  // (portal sessions are the source of truth when both exist for same client/date)
  const portalDates = new Set(portalRows.map(r => r.session_date!.slice(0, 10)));
  const inquiryRows = inquiryRes.data ?? [];
  for (const row of inquiryRows) {
    const dateKey = row.session_date.slice(0, 10);
    // Skip if a portal session already exists on the same date (avoids duplicates)
    if (portalDates.has(dateKey)) continue;
    const summary = [row.session_type, row.name].filter(Boolean).join(" — ");
    events.push({
      uid: `soloxsnaps-inquiry-${row.id}@soloxsnaps.com`,
      summary: summary || "Photography Session",
      dateStr: row.session_date,
      location: row.location ?? null,
      preferredTime: row.preferred_time ?? null,
    });
  }

  // Sort merged list by date
  events.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  const now = stamp();
  const icsEvents = events.map(ev => {
    const dateVal = icsDate(ev.dateStr);
    const nextDay = nextDayStr(ev.dateStr);
    const summaryWithTime = ev.preferredTime ? `${ev.summary} @ ${ev.preferredTime}` : ev.summary;

    return [
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dateVal}`,
      `DTEND;VALUE=DATE:${nextDay}`,
      `SUMMARY:${icsEscape(summaryWithTime)}`,
      ev.location ? `LOCATION:${icsEscape(ev.location)}` : null,
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
    // 15 minutes — the minimum Apple Calendar will poll
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
    ...icsEvents,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // No caching so every fetch gets the latest data
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
