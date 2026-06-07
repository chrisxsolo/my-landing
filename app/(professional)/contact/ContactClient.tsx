"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ContactFormFields from "./ContactFormFields";

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

function getInitialForm(searchParams: ReturnType<typeof useSearchParams>): ContactFormValues {
  const graduates = searchParams.get("graduates");
  return {
    ...INITIAL_FORM,
    date: searchParams.get("date") ?? "",
    school: searchParams.get("school") ?? "",
    people: graduates ? (graduates === "1" ? "Just me" : `${graduates} people`) : "",
    sessionType: searchParams.get("sessionType") ?? "",
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
  const [form, setForm] = useState(() => getInitialForm(searchParams));
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
      await sendInquiry(form, website, startedAt);
      sessionStorage.setItem("inquiry_submitted", JSON.stringify(form));
      router.push("/contact/thanks");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
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
