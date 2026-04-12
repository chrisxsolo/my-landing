import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const body = await req.json();
    const { name, email, phone, sessionType, date, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    await resend.emails.send({
      from: "soloxsnaps contact <onboarding@resend.dev>",
      to: ["chris@soloxsnaps.com"],
      replyTo: email,
      subject: `New inquiry from ${name}${sessionType ? ` — ${sessionType}` : ""}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 32px; background: #fff; color: #1a1a1a;">
          <p style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #bbb; margin-bottom: 24px;">
            New inquiry via soloxsnaps.com
          </p>
          <h1 style="font-size: 2rem; font-weight: 300; letter-spacing: 0.05em; color: #111; margin: 0 0 32px;">
            ${name}
          </h1>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 32px;">
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
              <td style="padding: 12px 0; color: #bbb; width: 140px; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Email</td>
              <td style="padding: 12px 0; color: #444;"><a href="mailto:${email}" style="color: #111;">${email}</a></td>
            </tr>
            ${phone ? `
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
              <td style="padding: 12px 0; color: #bbb; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Phone</td>
              <td style="padding: 12px 0; color: #444;">${phone}</td>
            </tr>` : ""}
            ${sessionType ? `
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
              <td style="padding: 12px 0; color: #bbb; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Session</td>
              <td style="padding: 12px 0; color: #444;">${sessionType}</td>
            </tr>` : ""}
            ${date ? `
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.07);">
              <td style="padding: 12px 0; color: #bbb; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;">Date in mind</td>
              <td style="padding: 12px 0; color: #444;">${date}</td>
            </tr>` : ""}
          </table>
          <div style="background: #fafaf8; padding: 24px; border-left: 2px solid rgba(0,0,0,0.08); margin-bottom: 40px;">
            <p style="font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: #bbb; margin: 0 0 12px;">Message</p>
            <p style="font-size: 1rem; line-height: 1.8; color: #555; margin: 0; font-style: italic;">${message.replace(/\n/g, "<br>")}</p>
          </div>
          <p style="font-size: 0.75rem; color: #ccc; border-top: 1px solid rgba(0,0,0,0.07); padding-top: 20px;">
            Reply directly to this email to respond to ${name}.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
  }
}
