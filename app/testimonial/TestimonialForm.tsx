"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/colors";
import type { TestimonialDisplayPreference } from "@/lib/testimonialValidation";

type Props = {
  source: string;
  galleryId: string;
  sessionType: string;
};

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  message: string;
  consent_to_marketing: boolean;
  display_name_preference: TestimonialDisplayPreference;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  message: "",
  consent_to_marketing: false,
  display_name_preference: "first_name_last_initial",
};

const DISPLAY_OPTIONS: Array<{ value: TestimonialDisplayPreference; label: string }> = [
  { value: "first_name_last_initial", label: "First name and last initial" },
  { value: "full_name", label: "Full name" },
  { value: "first_name_only", label: "First name only" },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_CLASS = "w-full rounded-lg px-4 py-3 text-[15px] outline-none transition focus:ring-2";
const FIELD_RING = { "--tw-ring-color": C.proAccentSoft } as React.CSSProperties;

function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.first_name.trim()) errors.first_name = "Please enter your first name";
  if (!form.last_name.trim()) errors.last_name = "Please enter your last name";
  if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = "Please enter a valid email address";
  }
  const messageLength = form.message.trim().length;
  if (messageLength < 20) errors.message = "Please share at least 20 characters about your experience";
  if (messageLength > 2000) errors.message = "Your testimonial must be 2,000 characters or fewer";
  if (!form.consent_to_marketing) {
    errors.consent_to_marketing = "Please confirm that soloxsnaps may use your testimonial";
  }
  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="mt-1.5 text-sm" style={{ color: C.danger }}>{message}</p>;
}

export default function TestimonialForm({ source, galleryId, sessionType }: Props) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (status === "success") successHeadingRef.current?.focus();
  }, [status]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }

    setStatus("submitting");
    setServerError("");
    try {
      const response = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          website,
          source: source || "direct_link",
          gallery_id: galleryId,
          session_type: sessionType,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error);
      setStatus("success");
    } catch (error) {
      setServerError(
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong while submitting your testimonial. Please try again",
      );
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <main className="min-h-screen px-5 py-16 sm:py-24" style={{ background: C.proPage }}>
        <section
          className="mx-auto max-w-xl rounded-xl p-8 text-center sm:p-12"
          style={{ background: C.white, border: `1px solid ${C.proBorder}`, boxShadow: C.proShadow }}
        >
          <div
            className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full text-xl"
            style={{ background: C.proAccentSoft, color: C.proAccent }}
          >
            ✓
          </div>
          <h1 ref={successHeadingRef} tabIndex={-1} className="text-3xl font-black tracking-tight outline-none" style={{ color: C.ink }}>
            Thank you
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7" style={{ color: C.muted }}>
            Your testimonial was submitted. I appreciate you taking the time to share your experience.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-lg px-6 py-3 text-sm font-black transition hover:-translate-y-0.5"
            style={{ background: C.proAccent, color: C.white }}
          >
            Return to soloxsnaps
          </Link>
        </section>
      </main>
    );
  }

  const messageCount = form.message.length;
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 sm:py-16" style={{ background: C.proPage }}>
      <div className="mx-auto max-w-2xl">
        <header className="mb-9">
          <Link href="/" className="text-[17px] font-black tracking-tight" style={{ color: C.ink }}>
            soloxsnaps
          </Link>
          <div className="mt-9 h-px w-12" style={{ background: C.proAccent }} />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.16em]" style={{ color: C.proAccent }}>A note from Chris</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl" style={{ color: C.ink }}>
            Share Your Experience
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7" style={{ color: C.muted }}>
            Thank you for choosing soloxsnaps. I&apos;d love to hear about your experience. Your feedback helps me improve and may be featured on the website or in future marketing materials.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-xl p-5 sm:p-8"
          style={{ background: C.white, border: `1px solid ${C.proBorder}`, boxShadow: C.proShadow }}
        >
          <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField id="first_name" label="First Name" autoComplete="given-name" maxLength={100} value={form.first_name} error={errors.first_name} onChange={(value) => updateField("first_name", value)} />
            <TextField id="last_name" label="Last Name" autoComplete="family-name" maxLength={100} value={form.last_name} error={errors.last_name} onChange={(value) => updateField("last_name", value)} />
          </div>

          <div className="mt-5">
            <TextField id="email" label="Email Address" type="email" autoComplete="email" maxLength={254} value={form.email} error={errors.email} onChange={(value) => updateField("email", value)} />
            <p id="email-helper" className="mt-1.5 text-xs" style={{ color: C.mutedSoft }}>Optional. Your email will not be displayed publicly</p>
          </div>

          <div className="mt-5">
            <label htmlFor="message" className="mb-2 block text-sm font-black" style={{ color: C.inkSoft }}>
              Tell me about your photoshoot experience
            </label>
            <textarea
              id="message"
              rows={7}
              maxLength={2000}
              value={form.message}
              onChange={(event) => updateField("message", event.target.value)}
              placeholder="What did you enjoy about your session, and how did you feel about the final photos?"
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? "message-error message-count" : "message-count"}
              className={`${INPUT_CLASS} resize-y`}
              style={{ ...FIELD_RING, color: C.ink, background: C.white, border: `1px solid ${errors.message ? C.danger : C.proBorder}` }}
            />
            <div className="mt-1.5 flex items-start justify-between gap-4">
              <FieldError id="message-error" message={errors.message} />
              <span id="message-count" className="ml-auto text-xs" style={{ color: messageCount > 1900 ? C.danger : C.mutedSoft }}>
                {messageCount.toLocaleString()} / 2,000
              </span>
            </div>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-black" style={{ color: C.inkSoft }}>How may your name appear with your testimonial?</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {DISPLAY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition"
                  style={{
                    color: C.inkSoft,
                    background: form.display_name_preference === option.value ? C.proAccentSoft : C.white,
                    border: `1px solid ${form.display_name_preference === option.value ? C.proAccentBorder : C.proBorder}`,
                  }}
                >
                  <input
                    type="radio"
                    name="display_name_preference"
                    value={option.value}
                    checked={form.display_name_preference === option.value}
                    onChange={() => updateField("display_name_preference", option.value)}
                    style={{ accentColor: C.proAccent }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 rounded-lg p-4" style={{ background: C.proAccentSoft, border: `1px solid ${errors.consent_to_marketing ? C.danger : C.proAccentBorder}` }}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                id="consent_to_marketing"
                type="checkbox"
                checked={form.consent_to_marketing}
                onChange={(event) => updateField("consent_to_marketing", event.target.checked)}
                aria-invalid={Boolean(errors.consent_to_marketing)}
                aria-describedby="consent-clarification consent-error"
                className="mt-1 h-4 w-4 shrink-0"
                style={{ accentColor: C.proAccent }}
              />
              <span className="text-sm font-bold leading-6" style={{ color: C.inkSoft }}>
                I give soloxsnaps permission to use my testimonial on its website, social media, and other marketing materials.
              </span>
            </label>
            <p id="consent-clarification" className="ml-7 mt-2 text-xs leading-5" style={{ color: C.muted }}>
              Your testimonial may be edited slightly for spelling, grammar, or length without changing its meaning
            </p>
            <FieldError id="consent-error" message={errors.consent_to_marketing} />
          </div>

          {serverError && <p role="alert" className="mt-5 rounded-lg px-4 py-3 text-sm" style={{ color: C.danger, background: C.pageAlt }}>{serverError}</p>}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="mt-6 w-full rounded-lg px-6 py-3.5 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: C.proAccent, color: C.white }}
          >
            {status === "submitting" ? "Submitting..." : "Submit Testimonial"}
          </button>
        </form>
      </div>
    </main>
  );
}

type TextFieldProps = {
  id: "first_name" | "last_name" | "email";
  label: string;
  type?: string;
  autoComplete: string;
  maxLength: number;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

function TextField({ id, label, type = "text", autoComplete, maxLength, value, error, onChange }: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-black" style={{ color: C.inkSoft }}>{label}</label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : id === "email" ? "email-helper" : undefined}
        className={INPUT_CLASS}
        style={{ ...FIELD_RING, color: C.ink, background: C.white, border: `1px solid ${error ? C.danger : C.proBorder}` }}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}
