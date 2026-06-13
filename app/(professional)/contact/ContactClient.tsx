"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ContactFormFields from "./ContactFormFields";
import BookingIntentSummary from "./BookingIntentSummary";
import {
  parseBookingIntent,
  headcountToSelectValue,
  hasBookingIntent,
  formatBookingIntentSummary,
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
  return {
    ...INITIAL_FORM,
    sessionType: intent.sessionType ?? "",
    school: intent.school ?? "",
    people: intent.headcount ? headcountToSelectValue(intent.headcount) : "",
    date: intent.date ?? "",
    location: intent.location ?? "",
  };
}

async function sendInquiry(form: ContactFormValues, website: string, startedAt: number) {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...form, website, renderedAt: startedAt }),
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
  const [form, setForm] = useState(() => getInitialForm(intent));
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [website, setWebsite] = useState("");
  const [startedAt] = useState(() => Date.now());

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setErrorMsg("");

    try {
      // Fold the configured session details into the message so the add-ons,
      // duration, and estimated total reach the photographer — the inquiries
      // table has no dedicated columns for them.
      const summary = formatBookingIntentSummary(intent);
      const message = summary ? `${summary}\n\n${form.message}`.trim() : form.message;
      const payload = { ...form, message };

      await sendInquiry(payload, website, startedAt);
      sessionStorage.setItem("inquiry_submitted", JSON.stringify(payload));
      router.push("/contact/thanks");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {hasBookingIntent(intent) ? <BookingIntentSummary intent={intent} /> : null}
      <HoneypotField value={website} onChange={setWebsite} />
      <ContactFormFields form={form} onChange={handleChange} />

      {errorMsg ? <p className="contact-error" role="alert">{errorMsg}</p> : null}
      <button type="submit" disabled={status === "sending"} className="submit-btn">
        {status === "sending" ? "Sending..." : "Send inquiry"}
      </button>
      <p className="contact-sr-only" aria-live="polite">
        {status === "sending" ? "Sending your inquiry…" : ""}
      </p>
    </form>
  );
}
