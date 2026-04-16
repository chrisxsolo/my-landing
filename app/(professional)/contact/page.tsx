// ─────────────────────────────────────────────────────────────────────────────
// CONTACT PAGE  →  soloxsnaps.com/contact
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Hero      — heading on left, photo on right
//   2. Form      — name, email, phone, session type, date, message
//   3. Sidebar   — response time, check dates link, Instagram link
//
// QUICK EDITS:
//   → Hero photo:     change contactImage URL below
//   → Session types:  edit the sessionTypes array below
//   → Hero heading:   find the h1 in the JSX
//   → Sidebar text:   find the contact-side-panel divs at the bottom of the JSX
//   → Form fields:    each field is a .contact-field div in the form
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ── SESSION TYPE DROPDOWN OPTIONS ─────────────────────────────────────────────
// These appear in the "Session type" select dropdown on the form.
// Add or remove strings to change the options.
const sessionTypes = [
  "Graduation Portrait",
  "Family Session",
  "Couples Session",
  "Individual Portrait",
  "Event Coverage",
  "Other",
];

// ── HERO IMAGE ────────────────────────────────────────────────────────────────
// The photo shown on the right side of the hero.
// To change: upload a new photo to Supabase Storage and paste the URL here.
const contactImage =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/champagne-popping.jpg";

// ── STYLES ────────────────────────────────────────────────────────────────────
// To change the hero image height: find min-height in .contact-hero-media
// To change the form panel width: find grid-template-columns in .contact-layout
// To change button color: find color: #4f6d67 in .submit-btn / .contact-link
const CSS = `
  .contact-page {
    padding-top: 98px;
    background: transparent;
    color: #101412;
  }
  .contact-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }
  .contact-hero {
    display: grid;
    grid-template-columns: minmax(0, 2fr) 360px;
    gap: 28px;
    align-items: end;
    padding: 70px 0 34px;
  }
  .contact-kicker,
  .contact-label,
  .contact-input,
  .contact-select,
  .contact-textarea,
  .submit-btn,
  .contact-link,
  .contact-chip {
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
  }
  .contact-kicker {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
  }
  .contact-title {
    max-width: 760px;
    margin: 0;
    color: #101412;
    font-size: 58px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.98;
    text-wrap: balance;
  }
  .contact-copy {
    max-width: 620px;
    margin: 22px 0 0;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.72;
    text-wrap: pretty;
  }
  .contact-hero-media {
    min-height: 360px;
    overflow: hidden;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: #dfe8e4;
    box-shadow: 0 24px 70px rgba(18, 24, 22, 0.12);
  }
  .contact-hero-media img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .contact-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 330px;
    gap: 18px;
    align-items: start;
    padding: 24px 0 110px;
  }
  .contact-form-panel,
  .contact-side-panel {
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 14px 34px rgba(18, 24, 22, 0.07);
  }
  .contact-form-panel {
    padding: 28px;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .contact-field {
    display: grid;
    gap: 8px;
    margin-bottom: 18px;
  }
  .contact-label {
    color: #667f79;
    font-size: 12px;
    font-weight: 820;
  }
  .contact-input,
  .contact-select,
  .contact-textarea {
    width: 100%;
    border: 1px solid rgba(18, 24, 22, 0.12);
    border-radius: 8px;
    background: rgba(247, 250, 248, 0.82);
    color: #101412;
    font-size: 16px;
    font-weight: 680;
    outline: none;
    transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  }
  .contact-input,
  .contact-select {
    min-height: 50px;
    padding: 0 14px;
  }
  .contact-textarea {
    min-height: 150px;
    padding: 14px;
    resize: vertical;
  }
  .contact-input:focus,
  .contact-select:focus,
  .contact-textarea:focus {
    border-color: rgba(112, 139, 133, 0.36);
    background: #ffffff;
    box-shadow: 0 0 0 4px rgba(112, 139, 133, 0.06);
  }
  .contact-input::placeholder,
  .contact-textarea::placeholder {
    color: #7b8984;
  }
  .submit-btn,
  .contact-link {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(112, 139, 133, 0.22);
    border-radius: 8px;
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
    box-shadow: 0 10px 24px rgba(112, 139, 133, 0.05);
    cursor: pointer;
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    transition: background 0.18s ease, transform 0.18s ease, opacity 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .submit-btn {
    width: 100%;
  }
  .submit-btn:hover:not(:disabled),
  .contact-link:hover {
    transform: translateY(-1px);
    border-color: rgba(112, 139, 133, 0.32);
    background: rgba(239, 246, 244, 0.98);
    box-shadow: 0 14px 28px rgba(112, 139, 133, 0.07);
  }
  .submit-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .contact-error {
    margin: 0 0 18px;
    color: #b3263a;
    font-size: 14px;
    font-weight: 760;
    line-height: 1.5;
  }
  .contact-sidebar {
    display: grid;
    gap: 14px;
  }
  .contact-side-panel {
    padding: 18px;
  }
  .contact-side-panel h2 {
    margin: 0 0 10px;
    color: #101412;
    font-size: 23px;
    font-weight: 860;
    letter-spacing: 0;
    line-height: 1.1;
  }
  .contact-side-panel p,
  .contact-side-panel a {
    margin: 0;
    color: #56635e;
    font-size: 15px;
    line-height: 1.65;
  }
  .contact-side-panel a {
    color: #101412;
    font-weight: 780;
    text-decoration: none;
  }
  .contact-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
  .contact-chip {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    padding: 0 11px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.72);
    color: #26312d;
    font-size: 13px;
    font-weight: 760;
  }
  @media (max-width: 920px) {
    .contact-hero,
    .contact-layout {
      grid-template-columns: 1fr;
    }
    .contact-hero-media {
      min-height: 420px;
      order: -1;
    }
  }
  @media (max-width: 760px) {
    .contact-page {
      padding-top: 78px;
    }
    .contact-shell {
      width: min(1180px, calc(100% - 36px));
    }
    .contact-hero {
      padding-top: 48px;
    }
    .contact-title {
      font-size: 40px;
      line-height: 1;
    }
    .contact-copy {
      font-size: 16px;
    }
    .contact-hero-media {
      min-height: 340px;
    }
    .contact-layout {
      padding-bottom: 78px;
    }
    .contact-form-panel {
      padding: 18px;
    }
    .form-row {
      grid-template-columns: 1fr;
      gap: 0;
    }
  }
`;

export default function ContactPage() {
  return (
    <Suspense>
      <ContactForm />
    </Suspense>
  );
}

function ContactForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    sessionType: "",
    date: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Pre-fill date from ?date= param (set by the availability calendar)
  useEffect(() => {
    const d = searchParams.get("date");
    if (d) setForm((prev) => ({ ...prev, date: d }));
  }, [searchParams]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((value) => ({ ...value, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send.");
      sessionStorage.setItem("inquiry_submitted", JSON.stringify(form));
      router.push("/contact/thanks");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <main className="contact-page">
      <style>{CSS}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────────
           Left: heading, copy, chips. Right: contactImage photo.
           To change the heading: edit the h1 text.
           To change chips (tags): find the contact-chip spans below. */}
      <section className="contact-shell contact-hero">
        <div>
          <p className="contact-kicker">Start the booking note</p>
          <h1 className="contact-title">Tell me the date, location, and what this is for.</h1>
          <p className="contact-copy">
            Send the basics and I will reply within 24 to 48 hours with availability, next steps, and anything useful for your session.
          </p>
          <div className="contact-chip-row">
            <span className="contact-chip">Graduation</span>
            <span className="contact-chip">Family</span>
            <span className="contact-chip">Bay Area</span>
          </div>
        </div>
        <div className="contact-hero-media">
          <img src={contactImage} alt="Chris Solorzano photography portrait" decoding="async" />
        </div>
      </section>

      <section className="contact-shell contact-layout">
        <div className="contact-form-panel">
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className="contact-field">
                <label htmlFor="name" className="contact-label">Name *</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Your name"
                  className="contact-input"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>
              <div className="contact-field">
                <label htmlFor="email" className="contact-label">Email *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@email.com"
                  className="contact-input"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="contact-field">
                <label htmlFor="phone" className="contact-label">Phone</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Optional"
                  className="contact-input"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
              <div className="contact-field">
                <label htmlFor="sessionType" className="contact-label">Session type</label>
                <select
                  id="sessionType"
                  name="sessionType"
                  className="contact-select"
                  value={form.sessionType}
                  onChange={handleChange}
                >
                  <option value="">Select one</option>
                  {sessionTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="contact-field">
              <label htmlFor="date" className="contact-label">Date in mind</label>
              <input
                id="date"
                name="date"
                type="text"
                placeholder="May 15, flexible, or a few options"
                className="contact-input"
                value={form.date}
                onChange={handleChange}
              />
            </div>

            <div className="contact-field">
              <label htmlFor="message" className="contact-label">Message *</label>
              <textarea
                id="message"
                name="message"
                required
                placeholder="Tell me the campus or location, how many people, and the vibe you want."
                className="contact-textarea"
                value={form.message}
                onChange={handleChange}
              />
            </div>

            {errorMsg && <p className="contact-error">{errorMsg}</p>}

            <button type="submit" disabled={status === "sending"} className="submit-btn">
              {status === "sending" ? "Sending..." : "Send inquiry"}
            </button>
          </form>
        </div>

        {/* ── SIDEBAR ─────────────────────────────────────────────────────────
             Three info panels to the right of the form.
             To change text: edit the h2 and p content in each panel.
             To add a panel: copy one of the contact-side-panel divs. */}
        <aside className="contact-sidebar" aria-label="Booking details">
          <div className="contact-side-panel">
            <p className="contact-kicker">Response time</p>
            <h2>24 to 48 hours.</h2>
            <p>You will also get a copy of your responses and the graduation guide after submitting.</p>
          </div>

          <div className="contact-side-panel">
            <p className="contact-kicker">Check dates</p>
            <h2>Already have a window?</h2>
            <p>
              <Link href="/availability">View availability</Link> before sending your inquiry.
            </p>
          </div>

          <div className="contact-side-panel">
            <p className="contact-kicker">Instagram</p>
            <h2>@soloxsnaps</h2>
            {/* To change the Instagram handle/link: update both the URL and display text */}
            <p>
              <a href="https://www.instagram.com/soloxsnaps" target="_blank" rel="noopener noreferrer">See recent work</a>
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
