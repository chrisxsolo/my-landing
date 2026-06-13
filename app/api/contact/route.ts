import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";
import { normalizeVisitorId } from "@/lib/contentEngine/trackEventRules";
import { recordContentEvent } from "@/lib/contentEngine/recordEvent";

const DEFAULT_CONTACT_EMAIL_TO = "chrisxsolo2@gmail.com";
const DEFAULT_CONTACT_EMAIL_FROM = "soloxsnaps contact <onboarding@resend.dev>";
const DEFAULT_SITE_URL = "https://soloxsnaps.com";

// ── Abuse protection knobs ───────────────────────────────────────────────────
// Per-field max lengths. Anything over these is almost certainly junk/bot data.
const MAX_LENGTHS: Record<string, number> = {
  name: 100,
  email: 254,
  phone: 30,
  instagram: 100,
  sessionType: 100,
  school: 150,
  people: 100,
  date: 100,
  preferredTime: 100,
  location: 200,
  message: 3000,
};
const MAX_BODY_BYTES = 16 * 1024;        // reject oversized payloads before parsing
const MIN_FILL_MS = 2_500;               // humans take longer than this to fill the form
const IP_LIMIT = 5;                      // max submissions per IP …
const IP_WINDOW_MS = 10 * 60 * 1000;     // … per 10 minutes
const EMAIL_COOLDOWN_MS = 45 * 1000;     // min gap between submissions from one email
const EMAIL_HOURLY_LIMIT = 5;            // max submissions per email per hour

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// Pull the client IP from Vercel/proxy headers (NextRequest has no .ip in v16).
function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function getContactRecipients() {
  const recipients = (process.env.CONTACT_EMAIL_TO ?? DEFAULT_CONTACT_EMAIL_TO)
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  return recipients.length ? recipients : [DEFAULT_CONTACT_EMAIL_TO];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
}

// Retry a Resend send up to `attempts` times with exponential back-off.
// Resend occasionally drops sends with a transient 5xx — this catches that
// without slowing down the happy path (first attempt is immediate).
async function sendWithRetry(
  fn: () => Promise<{ data: unknown; error: unknown }>,
  attempts = 3,
  baseDelayMs = 600,
): Promise<{ error: unknown }> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    const { error } = await fn();
    if (!error) return { error: null };
    lastError = error;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i)); // 600ms, 1200ms
    }
  }
  return { error: lastError };
}

function renderInquiryRow(label: string, value: string) {
  return `
    <tr style="border-bottom: 1px solid rgba(17,21,19,0.09);">
      <td style="padding: 13px 0; color: #6a716f; width: 140px; font-size: 12px; font-weight: 700; text-transform: uppercase;">${label}</td>
      <td style="padding: 13px 0; color: #1b201f; font-size: 15px; line-height: 1.55;">${value}</td>
    </tr>
  `;
}

export async function POST(req: NextRequest) {
  try {
    // Reject oversized payloads before reading/parsing the body.
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request too large." }, { status: 413 });
    }

    const body = await req.json();

    // Honeypot: a hidden field real users never see. If it's filled, it's a bot.
    // Return a fake success so the bot can't tell it was blocked.
    if (cleanText(body.website)) {
      return NextResponse.json({ ok: true });
    }

    // Timing check: bots submit near-instantly. The client stamps form render
    // time in `renderedAt`; reject (silently) anything faster than a human.
    const renderedAt = Number(body.renderedAt);
    if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < MIN_FILL_MS) {
      return NextResponse.json({ ok: true });
    }

    const name = cleanText(body.name);
    const email = cleanText(body.email);
    const phone = cleanText(body.phone);
    const sessionType = cleanText(body.sessionType);
    const date = cleanText(body.date);
    const message = cleanText(body.message);
    const instagram = cleanText(body.instagram);
    const school = cleanText(body.school);
    const preferredTime = cleanText(body.preferredTime);
    const people = cleanText(body.people);
    const location = cleanText(body.location);
    const visitorId = normalizeVisitorId(body.anonymousSessionId);

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }

    // Per-field length limits — block giant payloads and obvious junk.
    const fields: Record<string, string> = {
      name, email, phone, sessionType, date, message, instagram, school, preferredTime, people, location,
    };
    for (const [key, value] of Object.entries(fields)) {
      if (value.length > (MAX_LENGTHS[key] ?? 200)) {
        return NextResponse.json({ error: "One of your fields is too long. Please shorten it and try again." }, { status: 400 });
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    // IP-based rate limit (in-memory, per instance — catches rapid bursts).
    const ip = getClientIp(req);
    const ipLimit = rateLimit(`contact:${ip}`, IP_LIMIT, IP_WINDOW_MS);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } },
      );
    }

    // Save to Supabase
    const supabase = createSupabaseServerClient();

    // Email cooldown (durable, cross-instance): block rapid repeats and floods
    // from the same address using the inquiries already on record.
    const emailNormalized = email.toLowerCase();
    const { data: recent } = await supabase
      .from("inquiries")
      .select("created_at")
      .ilike("email", emailNormalized)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });
    if (recent && recent.length > 0) {
      const lastMs = Date.now() - new Date(recent[0].created_at).getTime();
      if (lastMs < EMAIL_COOLDOWN_MS || recent.length >= EMAIL_HOURLY_LIMIT) {
        return NextResponse.json(
          { error: "We already received a message from you recently. Please give it a little time before sending another." },
          { status: 429 },
        );
      }
    }
    const { data: inquiry, error: dbError } = await supabase
      .from("inquiries")
      .insert({
        name,
        email,
        phone: phone || null,
        session_type: sessionType || null,
        date_in_mind: date || null,
        message,
        status: "new",
        instagram: instagram || null,
        school: school || null,
        preferred_time: preferredTime || null,
        people: people || null,
        location: location || null,
        anonymous_session_id: visitorId,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("Failed to save inquiry to DB:", dbError);
      // Don't fail the request — still try to send email
    }

    // Funnel event: inquiry_submit. Emitted server-side so it can't be lost to
    // the client's post-submit redirect. recordContentEvent shares the same
    // service-role client and is fail-soft (logs, never throws).
    if (!dbError) {
      try {
        await recordContentEvent(supabase, {
          event: "inquiry_submit",
          path: "/contact",
          contentType: "page",
          contentId: null,
          referrer: req.headers.get("referer") ?? "",
          target: null,
          anonymousSessionId: visitorId,
          meta: sessionType ? { sessionType } : null,
        });
      } catch (eventError) {
        console.error("Failed to record inquiry_submit event:", eventError);
      }
    }

    let emailSent = false;

    // Send email notification when Resend is configured.
    try {
      const resendApiKey = process.env.RESEND_API_KEY;

      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const emailFrom = process.env.CONTACT_EMAIL_FROM ?? process.env.RESEND_FROM ?? DEFAULT_CONTACT_EMAIL_FROM;
        const emailTo = getContactRecipients();
        const siteUrl = getSiteUrl();
        const guideUrl = `${siteUrl}/grad-guide`;
        const contactUrl = `${siteUrl}/contact`;
        const safeGuideUrl = escapeHtml(guideUrl);
        const safeContactUrl = escapeHtml(contactUrl);
        const safeName = escapeHtml(name);
        const safeEmail = escapeHtml(email);
        const safePhone = escapeHtml(phone);
        const safeSessionType = escapeHtml(sessionType);
        const safeDate = escapeHtml(date);
        const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");
        const safeInstagram = escapeHtml(instagram);
        const safeSchool = escapeHtml(school);
        const safePreferredTime = escapeHtml(preferredTime);
        const safePeople = escapeHtml(people);
        const safeLocation = escapeHtml(location);
        const safeInquiryId = inquiry?.id ? escapeHtml(String(inquiry.id)) : "";
        const isGradInquiry = /grad/i.test(sessionType);
        const subject = `New inquiry from ${name}${sessionType ? ` - ${sessionType}` : ""}`.replace(/[\r\n]+/g, " ");
        const confirmationSubject = "Your soloxsnaps inquiry and next steps";
        const responseRows = [
          renderInquiryRow("Name", safeName),
          renderInquiryRow("Email", `<a href="mailto:${safeEmail}" style="color: #111513;">${safeEmail}</a>`),
          ...(safePhone         ? [renderInquiryRow("Phone", safePhone)] : []),
          ...(safeInstagram     ? [renderInquiryRow("Instagram", `@${safeInstagram.replace(/^@/, "")}`)] : []),
          ...(safeSessionType   ? [renderInquiryRow("Session", safeSessionType)] : []),
          ...(safeSchool        ? [renderInquiryRow("School / Location", safeSchool)] : []),
          ...(safePeople        ? [renderInquiryRow("# of people", safePeople)] : []),
          ...(safeDate          ? [renderInquiryRow("Date in mind", safeDate)] : []),
          ...(safePreferredTime ? [renderInquiryRow("Preferred time", safePreferredTime)] : []),
          ...(safeLocation      ? [renderInquiryRow("Desired location", safeLocation)] : []),
        ].join("");

        // Send both emails in parallel — cuts total email time roughly in half.
        const [{ error: resendError }, { error: confirmationError }] = await Promise.all([
          sendWithRetry(() => resend.emails.send({
            from: emailFrom,
            to: emailTo,
            replyTo: email,
            subject,
            html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 32px; background: #fff; color: #1a1a1a;">
              <p style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #555; margin-bottom: 24px;">
                New inquiry via soloxsnaps.com
              </p>
              <h1 style="font-size: 2rem; font-weight: 300; letter-spacing: 0.05em; color: #111; margin: 0 0 32px;">
                ${safeName}
              </h1>
              <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 32px;">
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                  <td style="padding: 12px 0; color: #555; width: 140px; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Email</td>
                  <td style="padding: 12px 0; color: #444;"><a href="mailto:${safeEmail}" style="color: #111;">${safeEmail}</a></td>
                </tr>
                ${phone ? `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                  <td style="padding: 12px 0; color: #555; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Phone</td>
                  <td style="padding: 12px 0; color: #444;">${safePhone}</td>
                </tr>` : ""}
                ${sessionType ? `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                  <td style="padding: 12px 0; color: #555; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Session</td>
                  <td style="padding: 12px 0; color: #444;">${safeSessionType}</td>
                </tr>` : ""}
                ${school ? `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                  <td style="padding: 12px 0; color: #555; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">School</td>
                  <td style="padding: 12px 0; color: #444;">${safeSchool}</td>
                </tr>` : ""}
                ${people ? `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                  <td style="padding: 12px 0; color: #555; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">People</td>
                  <td style="padding: 12px 0; color: #444;">${safePeople}</td>
                </tr>` : ""}
                ${date ? `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                  <td style="padding: 12px 0; color: #555; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Date in mind</td>
                  <td style="padding: 12px 0; color: #444;">${safeDate}</td>
                </tr>` : ""}
                ${preferredTime ? `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                  <td style="padding: 12px 0; color: #555; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Preferred time</td>
                  <td style="padding: 12px 0; color: #444;">${safePreferredTime}</td>
                </tr>` : ""}
                ${location ? `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                  <td style="padding: 12px 0; color: #555; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Location</td>
                  <td style="padding: 12px 0; color: #444;">${safeLocation}</td>
                </tr>` : ""}
                ${instagram ? `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                  <td style="padding: 12px 0; color: #555; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Instagram</td>
                  <td style="padding: 12px 0; color: #444;">@${escapeHtml(instagram.replace(/^@/, ""))}</td>
                </tr>` : ""}
                ${safeInquiryId ? `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                  <td style="padding: 12px 0; color: #555; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Inquiry #</td>
                  <td style="padding: 12px 0; color: #555;">${safeInquiryId}</td>
                </tr>` : ""}
              </table>
              <div style="background: #fafaf8; padding: 24px; border-left: 2px solid rgba(0,0,0,0.08); margin-bottom: 40px;">
                <p style="font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: #555; margin: 0 0 12px;">Message</p>
                <p style="font-size: 1rem; line-height: 1.8; color: #555; margin: 0; font-style: italic;">${safeMessage}</p>
              </div>
              <p style="font-size: 0.75rem; color: #555; border-top: 1px solid rgba(0,0,0,0.07); padding-top: 20px;">
                Reply directly to this email to respond to ${safeName}.
              </p>
            </div>
          `,
          })),
          sendWithRetry(() => resend.emails.send({
            from: emailFrom,
            to: email,
            replyTo: emailTo[0] ?? DEFAULT_CONTACT_EMAIL_TO,
            subject: confirmationSubject,
            text: [
              `Hi ${name},`,
              "",
              "Thanks for reaching out to soloxsnaps. I received your inquiry and will get back to you within 24 hours.",
              ...(isGradInquiry ? [
                "",
                "While you wait, you can check out my graduation guide to prepare for your shoot and learn more about how grad sessions work:",
                guideUrl,
              ] : []),
              "",
              "Your responses:",
              `Name: ${name}`,
              `Email: ${email}`,
              ...(phone         ? [`Phone: ${phone}`] : []),
              ...(instagram     ? [`Instagram: @${instagram.replace(/^@/, "")}`] : []),
              ...(sessionType   ? [`Session: ${sessionType}`] : []),
              ...(school        ? [`School / Location: ${school}`] : []),
              ...(people        ? [`Number of people: ${people}`] : []),
              ...(date          ? [`Date in mind: ${date}`] : []),
              ...(preferredTime ? [`Preferred time: ${preferredTime}`] : []),
              ...(location      ? [`Desired location: ${location}`] : []),
              "Message:",
              message,
              "",
              `You can also revisit the contact page here: ${contactUrl}`,
            ].join("\n"),
            html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; padding: 40px 28px; background: #ffffff; color: #111513;">
              <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #6a716f; margin: 0 0 18px;">
                soloxsnaps inquiry received
              </p>
              <h1 style="font-size: 32px; line-height: 1.08; color: #111513; margin: 0 0 18px; font-weight: 700;">
                Thanks for reaching out, ${safeName}.
              </h1>
              <p style="font-size: 16px; line-height: 1.7; color: #303635; margin: 0 0 24px;">
                I received your inquiry and will get back to you within <strong>24 hours</strong>. Your responses are copied below so you have everything in one place.
              </p>

              ${isGradInquiry ? `
              <div style="border: 1px solid rgba(17,21,19,0.1); border-radius: 8px; padding: 22px; background: #f7f8f5; margin: 0 0 26px;">
                <p style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #111513; margin: 0 0 10px;">
                  Before your shoot
                </p>
                <p style="font-size: 15px; line-height: 1.65; color: #303635; margin: 0 0 18px;">
                  My graduation guide walks through posing, outfit ideas, timing, and how to feel prepared before shoot day.
                </p>
                <a href="${safeGuideUrl}" style="display: inline-block; background: #141716; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 12px 18px; font-size: 13px; font-weight: 700;">
                  Open the graduation guide
                </a>
              </div>` : ""}

              <div style="margin: 0 0 28px;">
                <p style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #111513; margin: 0 0 10px;">
                  Your inquiry
                </p>
                <table style="width: 100%; border-collapse: collapse;">
                  ${responseRows}
                </table>
                <div style="padding-top: 16px;">
                  <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #6a716f; margin: 0 0 8px;">Message</p>
                  <p style="font-size: 15px; line-height: 1.7; color: #303635; margin: 0;">${safeMessage}</p>
                </div>
              </div>

              <p style="font-size: 13px; line-height: 1.6; color: #6a716f; border-top: 1px solid rgba(17,21,19,0.1); padding-top: 18px; margin: 0;">
                If you need to add anything, you can reply to this email or send another note through <a href="${safeContactUrl}" style="color: #111513;">the contact page</a>.
              </p>
            </div>
          `,
          })),
        ]);
        if (resendError) {
          console.error("Resend contact email failed after retries:", resendError);
        } else {
          emailSent = true;
        }
        if (confirmationError) {
          console.error("Resend contact confirmation email failed after retries:", confirmationError);
        }
      } else {
        console.warn("Skipping contact email notification: RESEND_API_KEY is not configured.");
      }
    } catch (emailErr) {
      console.error("Email send failed:", emailErr);
      // Don't fail — inquiry is already saved
    }

    if (dbError && !emailSent) {
      return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
  }
}
