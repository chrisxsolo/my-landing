import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = cleanText(body.name);
    const email = cleanText(body.email);
    const phone = cleanText(body.phone);
    const sessionType = cleanText(body.sessionType);
    const date = cleanText(body.date);
    const message = cleanText(body.message);

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    // Save to Supabase
    const supabase = createSupabaseServerClient();
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
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("Failed to save inquiry to DB:", dbError);
      // Don't fail the request — still try to send email
    }

    let emailSent = false;

    // Send email notification when Resend is configured.
    try {
      const resendApiKey = process.env.RESEND_API_KEY;

      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const safeName = escapeHtml(name);
        const safeEmail = escapeHtml(email);
        const safePhone = escapeHtml(phone);
        const safeSessionType = escapeHtml(sessionType);
        const safeDate = escapeHtml(date);
        const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");
        const safeInquiryId = inquiry?.id ? escapeHtml(String(inquiry.id)) : "";
        const subject = `New inquiry from ${name}${sessionType ? ` - ${sessionType}` : ""}`.replace(/[\r\n]+/g, " ");

        const { error: resendError } = await resend.emails.send({
          from: "soloxsnaps contact <onboarding@resend.dev>",
          to: ["soloxsnaps@gmail.com"],
          replyTo: email,
          subject,
          html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 32px; background: #fff; color: #1a1a1a;">
            <p style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #bbb; margin-bottom: 24px;">
              New inquiry via soloxsnaps.com
            </p>
            <h1 style="font-size: 2rem; font-weight: 300; letter-spacing: 0.05em; color: #111; margin: 0 0 32px;">
              ${safeName}
            </h1>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 32px;">
              <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                <td style="padding: 12px 0; color: #bbb; width: 140px; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Email</td>
                <td style="padding: 12px 0; color: #444;"><a href="mailto:${safeEmail}" style="color: #111;">${safeEmail}</a></td>
              </tr>
              ${phone ? `
              <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                <td style="padding: 12px 0; color: #bbb; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Phone</td>
                <td style="padding: 12px 0; color: #444;">${safePhone}</td>
              </tr>` : ""}
              ${sessionType ? `
              <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                <td style="padding: 12px 0; color: #bbb; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Session</td>
                <td style="padding: 12px 0; color: #444;">${safeSessionType}</td>
              </tr>` : ""}
              ${date ? `
              <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                <td style="padding: 12px 0; color: #bbb; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Date in mind</td>
                <td style="padding: 12px 0; color: #444;">${safeDate}</td>
              </tr>` : ""}
              ${safeInquiryId ? `
              <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
                <td style="padding: 12px 0; color: #bbb; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Inquiry #</td>
                <td style="padding: 12px 0; color: #aaa;">${safeInquiryId}</td>
              </tr>` : ""}
            </table>
            <div style="background: #fafaf8; padding: 24px; border-left: 2px solid rgba(0,0,0,0.08); margin-bottom: 40px;">
              <p style="font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: #bbb; margin: 0 0 12px;">Message</p>
              <p style="font-size: 1rem; line-height: 1.8; color: #555; margin: 0; font-style: italic;">${safeMessage}</p>
            </div>
            <p style="font-size: 0.75rem; color: #ccc; border-top: 1px solid rgba(0,0,0,0.07); padding-top: 20px;">
              Reply directly to this email to respond to ${safeName}.
            </p>
          </div>
        `,
        });
        if (resendError) {
          throw new Error(resendError.message);
        }
        emailSent = true;
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
