"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Submission = {
  name: string;
  email: string;
  phone: string;
  sessionType: string;
  date: string;
  message: string;
};

const CSS = `
  @keyframes thanksFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .thanks-page {
    min-height: 100vh;
    padding-top: 98px;
    background: transparent;
    color: #101412;
  }
  .thanks-shell {
    width: min(980px, calc(100% - 48px));
    margin: 0 auto;
    padding: 70px 0 110px;
  }
  .thanks-panel {
    padding: 12px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 14px 34px rgba(18, 24, 22, 0.07);
    animation: thanksFadeUp 0.5s ease both;
  }
  .thanks-inner {
    padding: 38px;
  }
  .thanks-kicker,
  .thanks-link,
  .detail-label {
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
  }
  .thanks-kicker {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
  }
  .thanks-title {
    max-width: 720px;
    margin: 0;
    color: #101412;
    font-size: 58px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.98;
    text-wrap: balance;
  }
  .thanks-copy {
    max-width: 620px;
    margin: 22px 0 0;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.72;
    text-wrap: pretty;
  }
  .thanks-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 28px;
  }
  .thanks-link {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 18px;
    border: 1px solid rgba(112, 139, 133, 0.22);
    border-radius: 8px;
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
    box-shadow: 0 10px 24px rgba(112, 139, 133, 0.05);
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .thanks-link[data-variant="ghost"] {
    border-color: rgba(18, 24, 22, 0.11);
    background: rgba(247, 250, 248, 0.88);
    color: #101412;
    box-shadow: none;
  }
  .thanks-link:hover {
    transform: translateY(-1px);
    border-color: rgba(112, 139, 133, 0.32);
    background: rgba(239, 246, 244, 0.98);
    box-shadow: 0 14px 28px rgba(112, 139, 133, 0.07);
  }
  .thanks-link[data-variant="ghost"]:hover {
    background: #ffffff;
    box-shadow: 0 10px 22px rgba(18, 24, 22, 0.06);
  }
  .thanks-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 28px;
  }
  .thanks-card {
    padding: 18px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(247, 250, 248, 0.82);
  }
  .thanks-portal-card {
    padding: 20px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(247, 250, 248, 0.82);
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .thanks-portal-icon {
    flex-shrink: 0;
    width: 36px; height: 36px;
    border-radius: 8px;
    background: rgba(112, 139, 133, 0.16);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .thanks-portal-body h2 {
    margin: 0 0 5px;
    color: #101412;
    font-size: 16px;
    font-weight: 860;
    line-height: 1.2;
  }
  .thanks-portal-body p {
    margin: 0 0 12px;
    color: #55635e;
    font-size: 14px;
    line-height: 1.6;
  }
  .thanks-portal-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 14px;
    border-radius: 6px;
    border: 1px solid rgba(112, 139, 133, 0.22);
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
    font-size: 13px;
    font-weight: 820;
    text-decoration: none;
    box-shadow: 0 10px 24px rgba(112, 139, 133, 0.05);
    transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .thanks-portal-btn:hover {
    transform: translateY(-1px);
    border-color: rgba(112, 139, 133, 0.32);
    background: rgba(239, 246, 244, 0.98);
    box-shadow: 0 14px 28px rgba(112, 139, 133, 0.07);
  }
  .thanks-card h2 {
    margin: 0 0 10px;
    color: #101412;
    font-size: 21px;
    font-weight: 860;
    letter-spacing: 0;
    line-height: 1.12;
  }
  .thanks-card p {
    margin: 0;
    color: #55635e;
    font-size: 15px;
    line-height: 1.62;
  }
  .detail-list {
    display: grid;
    gap: 0;
    margin-top: 18px;
  }
  .detail-row {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 16px;
    padding: 14px 0;
    border-bottom: 1px solid rgba(18, 24, 22, 0.09);
  }
  .detail-label {
    color: #667f79;
    font-size: 12px;
    font-weight: 820;
  }
  .detail-value {
    color: #33403b;
    font-size: 15px;
    line-height: 1.62;
    word-break: break-word;
  }
  @media (max-width: 760px) {
    .thanks-page {
      padding-top: 78px;
    }
    .thanks-shell {
      width: min(980px, calc(100% - 36px));
      padding: 48px 0 78px;
    }
    .thanks-inner {
      padding: 20px 8px 8px;
    }
    .thanks-title {
      font-size: 40px;
      line-height: 1;
    }
    .thanks-copy {
      font-size: 16px;
    }
    .thanks-grid {
      grid-template-columns: 1fr;
    }
    .detail-row {
      grid-template-columns: 1fr;
      gap: 6px;
    }
    .thanks-actions {
      display: grid;
      grid-template-columns: 1fr;
    }
  }
`;

export default function ThanksPage() {
  const [data, setData] = useState<Submission | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("inquiry_submitted");
      if (raw) {
        setData(JSON.parse(raw));
        sessionStorage.removeItem("inquiry_submitted");
      }
    } catch {
      // Ignore missing or malformed session data.
    }
    setLoaded(true);
  }, []);

  const fields = data
    ? [
        data.name && { label: "Name", value: data.name },
        data.email && { label: "Email", value: data.email },
        data.phone && { label: "Phone", value: data.phone },
        data.sessionType && { label: "Session type", value: data.sessionType },
        data.date && { label: "Date in mind", value: data.date },
        data.message && { label: "Message", value: data.message },
      ].filter(Boolean) as { label: string; value: string }[]
    : [];

  if (!loaded) return null;

  return (
    <main className="thanks-page">
      <style>{CSS}</style>

      <section className="thanks-shell">
        <div className="thanks-panel">
          <div className="thanks-inner">
            <p className="thanks-kicker">Inquiry received</p>
            <h1 className="thanks-title">
              {data?.name ? `Thank you, ${data.name.split(" ")[0]}.` : "Thank you."}
            </h1>
            <p className="thanks-copy">
              Your note is in. I will reply within 24 to 48 hours, and a copy of your responses is on the way to your inbox.
            </p>

            <div className="thanks-actions">
              <Link href="/grad-guide" className="thanks-link">
                Open the graduation guide
              </Link>
              <Link href="/availability" className="thanks-link" data-variant="ghost">
                Check dates
              </Link>
              <Link href="/" className="thanks-link" data-variant="ghost">
                Back to home
              </Link>
            </div>

            <div className="thanks-grid">
              <div className="thanks-card">
                <p className="thanks-kicker">Next</p>
                <h2>I review the details.</h2>
                <p>I will check the date, session type, location notes, and reply with the clean next step.</p>
              </div>
              <div className="thanks-card">
                <p className="thanks-kicker">Then</p>
                <h2>We lock the session.</h2>
                <p>Once the date works, I send the contract, retainer step, and any prep notes you need.</p>
              </div>
            </div>

            <div className="thanks-portal-card" style={{ marginTop: 12 }}>
              <div className="thanks-portal-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M2.25 5.25A1.5 1.5 0 013.75 3.75h10.5A1.5 1.5 0 0115.75 5.25v7.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5v-7.5z" stroke="#4f6d67" strokeWidth="1.25"/>
                  <path d="M2.25 5.25l6.75 5.25 6.75-5.25" stroke="#4f6d67" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="thanks-portal-body">
                <h2>Track your shoot from booking to gallery.</h2>
                <p>
                  Once you&apos;re booked, sign in with this same Gmail account to get a private client dashboard — see your session status, milestones, and gallery delivery all in one place.
                </p>
                <Link href="/login" className="thanks-portal-btn">
                  Set up your account <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            {fields.length > 0 && (
              <div className="thanks-card" style={{ marginTop: 12 }}>
                <p className="thanks-kicker">What you submitted</p>
                <div className="detail-list">
                  {fields.map((field) => (
                    <div key={field.label} className="detail-row">
                      <span className="detail-label">{field.label}</span>
                      <span className="detail-value">{field.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
