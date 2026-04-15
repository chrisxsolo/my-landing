// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inquiry-digest
//
// Sends a daily digest email of all "new" inquiries submitted in the last 48h.
// Called by Vercel Cron (see vercel.json) every morning at 8am PT.
// Also accepts a secret header so you can trigger it manually anytime.
//
// Skips silently if there are no new inquiries — no noise on quiet days.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const DEFAULT_TO   = "chrisxsolo2@gmail.com";
const DEFAULT_FROM = "soloxsnaps contact <onboarding@resend.dev>";
const CRON_SECRET  = process.env.CRON_SECRET ?? "";

function escapeHtml(v: string) {
  return v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
  });
}

export async function GET(req: NextRequest) {
  // Verify cron secret so random people can't trigger it
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const supabase = createSupabaseServerClient();

  // Fetch all "new" inquiries from the last 48 hours
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: inquiries, error } = await supabase
    .from("inquiries")
    .select("*")
    .eq("status", "new")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Digest: failed to fetch inquiries", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!inquiries || inquiries.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "No new inquiries" });
  }

  const to  = (process.env.CONTACT_EMAIL_TO ?? DEFAULT_TO).split(",").map(s => s.trim()).filter(Boolean);
  const from = process.env.CONTACT_EMAIL_FROM ?? DEFAULT_FROM;

  const rows = inquiries.map((inq: {
    name: string; email: string; phone?: string | null;
    session_type?: string | null; date_in_mind?: string | null;
    message: string; created_at: string;
  }) => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:16px 0;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111;">${escapeHtml(inq.name)}</p>
        <p style="margin:0 0 2px;font-size:13px;color:#555;">
          <a href="mailto:${escapeHtml(inq.email)}" style="color:#3d6b5e;">${escapeHtml(inq.email)}</a>
          ${inq.phone ? ` · ${escapeHtml(inq.phone)}` : ""}
        </p>
        ${inq.session_type ? `<p style="margin:0 0 2px;font-size:12px;color:#888;">${escapeHtml(inq.session_type)}${inq.date_in_mind ? ` · ${escapeHtml(inq.date_in_mind)}` : ""}</p>` : ""}
        <p style="margin:6px 0 0;font-size:13px;color:#444;line-height:1.5;font-style:italic;">"${escapeHtml(inq.message.slice(0, 180))}${inq.message.length > 180 ? "…" : ""}"</p>
        <p style="margin:4px 0 0;font-size:11px;color:#aaa;">${formatDate(inq.created_at)} PT</p>
      </td>
    </tr>
  `).join("");

  const plural = inquiries.length === 1 ? "inquiry" : "inquiries";
  const subject = `${inquiries.length} unread ${plural} — soloxsnaps`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fff;color:#111;">
      <p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#888;margin:0 0 20px;">
        soloxsnaps · daily digest
      </p>
      <h1 style="font-size:24px;font-weight:800;margin:0 0 6px;">
        ${inquiries.length} unread ${plural}
      </h1>
      <p style="font-size:14px;color:#666;margin:0 0 28px;">
        These haven't been marked as responded yet. Reply directly from your email — just hit reply or click the address below each name.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f0f0f0;">
        <a href="https://soloxsnaps.com/admin" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;">
          Open admin dashboard →
        </a>
      </div>
      <p style="font-size:11px;color:#ccc;margin-top:20px;">
        Sent automatically each morning · only appears when there are unread inquiries
      </p>
    </div>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error: sendError } = await resend.emails.send({ from, to, subject, html });
    if (sendError) {
      console.error("Digest send failed:", sendError);
      return NextResponse.json({ error: "Email send failed", detail: sendError }, { status: 500 });
    }
    console.log(`Digest sent: ${inquiries.length} inquiries`);
    return NextResponse.json({ ok: true, sent: true, count: inquiries.length });
  } catch (err) {
    console.error("Digest error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
