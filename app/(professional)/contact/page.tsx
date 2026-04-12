"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const sessionTypes = [
  "Graduation Portrait",
  "Family Session",
  "Couples Session",
  "Individual Portrait",
  "Event Coverage",
  "Other",
];

const CSS = `
  .contact-input {
    width: 100%;
    padding: 14px 0;
    border: none;
    border-bottom: 1px solid rgba(0,0,0,0.12);
    background: transparent;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1rem;
    color: #1a1a1a;
    outline: none;
    transition: border-color 0.2s ease;
    box-sizing: border-box;
  }
  .contact-input:focus { border-bottom-color: #1a1a1a; }
  .contact-input::placeholder { color: #ccc; font-style: italic; }
  .contact-select {
    width: 100%;
    padding: 14px 0;
    border: none;
    border-bottom: 1px solid rgba(0,0,0,0.12);
    background: transparent;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1rem;
    color: #1a1a1a;
    outline: none;
    transition: border-color 0.2s ease;
    appearance: none;
    cursor: pointer;
  }
  .contact-select:focus { border-bottom-color: #1a1a1a; }
  .contact-textarea {
    width: 100%;
    padding: 14px 0;
    border: none;
    border-bottom: 1px solid rgba(0,0,0,0.12);
    background: transparent;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1rem;
    color: #1a1a1a;
    outline: none;
    resize: none;
    transition: border-color 0.2s ease;
    box-sizing: border-box;
    min-height: 120px;
  }
  .contact-textarea:focus { border-bottom-color: #1a1a1a; }
  .contact-textarea::placeholder { color: #ccc; font-style: italic; }
  .contact-label {
    font-family: var(--font-dm-sans), sans-serif;
    font-size: 0.65rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #bbb;
    display: block;
    margin-bottom: 2px;
  }
  .submit-btn {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 0.75rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #fff;
    background: #1a1a1a;
    border: none;
    padding: 16px 48px;
    cursor: pointer;
    transition: opacity 0.2s ease;
    display: inline-block;
  }
  .submit-btn:hover:not(:disabled) { opacity: 0.75; }
  .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  @media (max-width: 760px) {
    .contact-grid { grid-template-columns: 1fr !important; gap: 60px !important; }
    .form-row { grid-template-columns: 1fr !important; }
  }
`;

export default function ContactPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", email: "", phone: "", sessionType: "", date: "", message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
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
    <main style={{ background: "#fff", color: "#1a1a1a", paddingTop: 80 }}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <section style={{ padding: "80px 60px 80px", textAlign: "center" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.7rem",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "#bbb",
          marginBottom: 20,
        }}>
          Contact
        </p>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(2rem, 5.5vw, 5rem)",
          fontWeight: 300,
          letterSpacing: "0.06em",
          color: "#111",
          lineHeight: 1.1,
          margin: "0 auto 28px",
          maxWidth: 640,
        }}>
          Let&rsquo;s work together.
        </h1>
        <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.12)", margin: "0 auto 28px" }} />
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontSize: "1rem",
          color: "#aaa",
          maxWidth: 480,
          margin: "0 auto",
          lineHeight: 1.7,
        }}>
          Grad season books up fast. Reach out early and we&rsquo;ll make it happen.
        </p>
      </section>

      {/* ── BODY — form left, info right ── */}
      <section style={{ padding: "0 60px 120px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="contact-grid" style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 0.6fr",
          gap: "100px",
          alignItems: "start",
        }}>

          {/* ── FORM ── */}
          <div>
            <form onSubmit={handleSubmit} noValidate>
                {/* Row 1: Name + Email */}
                <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginBottom: 36 }}>
                  <div>
                    <label htmlFor="name" className="contact-label">Name *</label>
                    <input
                      id="name" name="name" type="text" required
                      placeholder="Your name"
                      className="contact-input"
                      value={form.name} onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="contact-label">Email *</label>
                    <input
                      id="email" name="email" type="email" required
                      placeholder="your@email.com"
                      className="contact-input"
                      value={form.email} onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Row 2: Phone + Session type */}
                <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginBottom: 36 }}>
                  <div>
                    <label htmlFor="phone" className="contact-label">Phone (optional)</label>
                    <input
                      id="phone" name="phone" type="tel"
                      placeholder="(415) 000-0000"
                      className="contact-input"
                      value={form.phone} onChange={handleChange}
                    />
                  </div>
                  <div style={{ position: "relative" }}>
                    <label htmlFor="sessionType" className="contact-label">Session type</label>
                    <select
                      id="sessionType" name="sessionType"
                      className="contact-select"
                      value={form.sessionType} onChange={handleChange}
                    >
                      <option value="">Select one…</option>
                      {sessionTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <span style={{
                      position: "absolute", right: 0, bottom: 16,
                      color: "#ccc", pointerEvents: "none", fontSize: "0.8rem",
                    }}>↓</span>
                  </div>
                </div>

                {/* Row 3: Date */}
                <div style={{ marginBottom: 36 }}>
                  <label htmlFor="date" className="contact-label">Date in mind</label>
                  <input
                    id="date" name="date" type="text"
                    placeholder="e.g. May 15, or flexible"
                    className="contact-input"
                    value={form.date} onChange={handleChange}
                  />
                </div>

                {/* Row 4: Message */}
                <div style={{ marginBottom: 48 }}>
                  <label htmlFor="message" className="contact-label">Message *</label>
                  <textarea
                    id="message" name="message" required
                    placeholder="Tell me about your session — location ideas, vibe, what matters most to you…"
                    className="contact-textarea"
                    value={form.message} onChange={handleChange}
                  />
                </div>

                {errorMsg && (
                  <p style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontStyle: "italic",
                    fontSize: "0.88rem",
                    color: "#c0392b",
                    marginBottom: 20,
                  }}>
                    {errorMsg}
                  </p>
                )}

                <button type="submit" disabled={status === "sending"} className="submit-btn">
                  {status === "sending" ? "Sending…" : "Send inquiry"}
                </button>
              </form>
          </div>

          {/* ── SIDEBAR INFO ── */}
          <div style={{ paddingTop: 8 }}>
            <div style={{ marginBottom: 48 }}>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.65rem",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#ccc",
                marginBottom: 16,
              }}>
                Response time
              </p>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontStyle: "italic",
                fontSize: "1rem",
                lineHeight: 1.75,
                color: "#888",
              }}>
                I reply within 24–48 hours and will confirm availability for your preferred date.
              </p>
            </div>

            <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 36, marginBottom: 48 }}>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.65rem",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#ccc",
                marginBottom: 16,
              }}>
                Location
              </p>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontStyle: "italic",
                fontSize: "1rem",
                lineHeight: 1.75,
                color: "#888",
              }}>
                Based in San Francisco. Available throughout the Bay Area — SF, Berkeley, Stanford, SJSU, Peninsula, South Bay, and beyond.
              </p>
            </div>

            <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 36, marginBottom: 48 }}>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.65rem",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#ccc",
                marginBottom: 16,
              }}>
                Elsewhere
              </p>
              <a href="https://www.instagram.com/soloxsnaps" target="_blank" rel="noopener noreferrer" style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontStyle: "italic",
                fontSize: "0.95rem",
                color: "#888",
                textDecoration: "none",
                borderBottom: "1px solid rgba(0,0,0,0.1)",
                paddingBottom: 1,
                display: "inline-block",
                marginBottom: 10,
              }}>
                @soloxsnaps on Instagram
              </a>
            </div>

            <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 36 }}>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.65rem",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#ccc",
                marginBottom: 16,
              }}>
                Check dates
              </p>
              <Link href="/availability" style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontStyle: "italic",
                fontSize: "0.95rem",
                color: "#888",
                textDecoration: "none",
                borderBottom: "1px solid rgba(0,0,0,0.1)",
                paddingBottom: 1,
                display: "inline-block",
              }}>
                View availability calendar →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
