"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ContactFormFields from "./ContactFormFields";
import BookingIntentSummary from "./BookingIntentSummary";
import { getVisitorId, trackEvent } from "@/lib/analytics/visitor";
import { INQUIRY_SUBMISSION_STORAGE_KEY, runInquirySubmission } from "@/lib/contactSubmission";
import {
  parseBookingIntent,
  hasBookingIntent,
  formatBookingIntentSummary,
  intentPrefill,
  mergeIntentPrefill,
  type BookingIntent,
} from "@/lib/bookingIntent";

export type ContactFormValues = {
  name: string;
  email: string;
  phone: string;
  instagram: string;
  sessionType: string;
  school: string;
  people: string;
  date: string;
  preferredTime: string;
  location: string;
  message: string;
};

const INITIAL_FORM: ContactFormValues = {
  name: "",
  email: "",
  phone: "",
  instagram: "",
  sessionType: "",
  school: "",
  people: "",
  date: "",
  preferredTime: "",
  location: "",
  message: "",
};

function getInitialForm(intent: BookingIntent): ContactFormValues {
  return { ...INITIAL_FORM, ...intentPrefill(intent) };
}

// The thank-you page reads this back. Storage can be full or blocked (private
// browsing); runInquirySubmission makes sure that never fails a sent inquiry.
function rememberSubmission(payload: ContactFormValues) {
  sessionStorage.setItem(INQUIRY_SUBMISSION_STORAGE_KEY, JSON.stringify(payload));
}

async function sendInquiry(form: ContactFormValues, website: string, startedAt: number) {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // anonymousSessionId is the stitch: it ties this inquiry back to the visitor
    // session (landing page, referrer, UTM) that first brought them in.
    body: JSON.stringify({ ...form, website, renderedAt: startedAt, anonymousSessionId: getVisitorId() }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
}

function HoneypotField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div aria-hidden="true" className="contact-honeypot">
      <label htmlFor="website">Website</label>
      <input
        id="website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export default function ContactClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = useMemo(() => parseBookingIntent(searchParams), [searchParams]);
  const intentKey = searchParams.toString();
  const [form, setForm] = useState(() => getInitialForm(intent));
  const [editedFields, setEditedFields] = useState<ReadonlySet<string>>(() => new Set());
  const [prefilledFor, setPrefilledFor] = useState(intentKey);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [website, setWebsite] = useState("");
  const [startedAt] = useState(() => Date.now());
  const inquiryStartedRef = useRef(false);

  // A client-side hop to another prefilled /contact link keeps this component
  // mounted, so re-apply the prefill here (React's "adjust state on prop
  // change" pattern) — leaving anything the visitor typed alone.
  if (prefilledFor !== intentKey) {
    setPrefilledFor(intentKey);
    setForm((current) => mergeIntentPrefill(current, intent, editedFields));
  }

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    if (!inquiryStartedRef.current) {
      inquiryStartedRef.current = true;
      trackEvent({ event: "inquiry_start", path: "/contact" });
    }
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setEditedFields((current) => (current.has(name) ? current : new Set(current).add(name)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending" || status === "sent") return;

    setStatus("sending");
    setErrorMsg("");

    // Fold the configured session details into the message so the add-ons,
    // duration, and estimated total reach the photographer — the inquiries
    // table has no dedicated columns for them.
    const summary = formatBookingIntentSummary(intent);
    const message = summary ? `${summary}\n\n${form.message}`.trim() : form.message;
    const payload = { ...form, message };

    const result = await runInquirySubmission({
      send: () => sendInquiry(payload, website, startedAt),
      remember: () => rememberSubmission(payload),
      onSent: () => {
        // Sent: keep the button disabled so the inquiry can't go twice.
        setStatus("sent");
        router.push("/contact/thanks");
      },
    });
    if (!result.ok) {
      setErrorMsg(result.error);
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {hasBookingIntent(intent) ? <BookingIntentSummary intent={intent} /> : null}
      <HoneypotField value={website} onChange={setWebsite} />
      <ContactFormFields form={form} onChange={handleChange} />

      {errorMsg ? <p className="contact-error" role="alert">{errorMsg}</p> : null}
      <button type="submit" disabled={status === "sending" || status === "sent"} className="submit-btn">
        {status === "sending" ? "Sending..." : status === "sent" ? "Sent" : "Send Inquiry"}
      </button>
      <p className="contact-sr-only" aria-live="polite">
        {status === "sending" ? "Sending your inquiry…" : status === "sent" ? "Inquiry sent." : ""}
      </p>
    </form>
  );
}
