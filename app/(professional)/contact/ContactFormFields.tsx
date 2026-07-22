import Link from "next/link";
import type { ContactFormValues } from "./ContactClient";

const SESSION_TYPES = [
  "Graduation Portrait",
  "Family Session",
  "Couples Session",
  "Individual Portrait",
  "Event Coverage",
  "Other",
];

type ContactFormFieldsProps = {
  form: ContactFormValues;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
};

type FieldGroupProps = ContactFormFieldsProps;

function IdentityFields({ form, onChange }: FieldGroupProps) {
  return (
    <>
      <div className="form-row">
        <div className="contact-field">
          <label htmlFor="name" className="contact-label">Name *</label>
          <input id="name" name="name" type="text" required autoComplete="name" placeholder="Your name"
            className="contact-input" value={form.name} onChange={onChange} />
        </div>
        <div className="contact-field">
          <label htmlFor="email" className="contact-label">Email *</label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@email.com"
            className="contact-input" value={form.email} onChange={onChange} />
        </div>
      </div>
      <div className="form-row">
        <div className="contact-field">
          <label htmlFor="phone" className="contact-label">Phone</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="Optional"
            className="contact-input" value={form.phone} onChange={onChange} />
        </div>
        <div className="contact-field">
          <label htmlFor="instagram" className="contact-label">Instagram</label>
          <input id="instagram" name="instagram" type="text" placeholder="@handle (optional)"
            className="contact-input" value={form.instagram} onChange={onChange} />
        </div>
      </div>
    </>
  );
}

function SessionFields({ form, onChange }: FieldGroupProps) {
  // School field is prefilled via ?school= from campus landing pages, so it
  // must stay visible even when no session type has been chosen yet.
  const showSchoolField = form.sessionType === "Graduation Portrait" || Boolean(form.school);

  return (
    <>
      <div className={showSchoolField ? "form-row" : undefined}>
        <div className="contact-field">
          <label htmlFor="sessionType" className="contact-label">Session type</label>
          <select id="sessionType" name="sessionType" className="contact-select"
            value={form.sessionType} onChange={onChange}>
            <option value="">Select one</option>
            {SESSION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        {showSchoolField ? (
          <div className="contact-field contact-field-pop">
            <label htmlFor="school" className="contact-label">School / Campus</label>
            <input id="school" name="school" type="text" placeholder="UC Berkeley, SF State, etc."
              className="contact-input" value={form.school} onChange={onChange} />
          </div>
        ) : null}
      </div>
      {showSchoolField ? (
        <p className="contact-field-hint contact-field-pop">
          The <Link href="/grad-guide">graduation photo guide</Link> covers outfits, posing, and
          the best campus spots.
        </p>
      ) : null}
      <div className="form-row">
        <div className="contact-field">
          <label htmlFor="people" className="contact-label">Number of people</label>
          <select id="people" name="people" className="contact-select" value={form.people} onChange={onChange}>
            <option value="">Select</option>
            <option value="1">Just me</option>
            <option value="2">2 people</option>
            <option value="3">3 people</option>
            <option value="4">4 people</option>
            <option value="5+">5 or more</option>
          </select>
        </div>
        <div className="contact-field">
          <label htmlFor="date" className="contact-label">Date in mind</label>
          <input id="date" name="date" type="text" placeholder="May 15, flexible, or a few options"
            className="contact-input" value={form.date} onChange={onChange} />
        </div>
      </div>
    </>
  );
}

function ScheduleFields({ form, onChange }: FieldGroupProps) {
  return (
    <div className="form-row">
      <div className="contact-field">
        <label htmlFor="preferredTime" className="contact-label">Preferred time</label>
        <select id="preferredTime" name="preferredTime" className="contact-select"
          value={form.preferredTime} onChange={onChange}>
          <option value="">No preference</option>
          <option value="Early morning (golden hour)">Early morning (golden hour)</option>
          <option value="Morning">Morning</option>
          <option value="Midday">Midday</option>
          <option value="Afternoon">Afternoon</option>
          <option value="Late afternoon / golden hour">Late afternoon / golden hour</option>
        </select>
      </div>
      <div className="contact-field">
        <label htmlFor="location" className="contact-label">Desired location</label>
        <input id="location" name="location" type="text" placeholder="Specific spot, or leave blank"
          className="contact-input" value={form.location} onChange={onChange} />
      </div>
    </div>
  );
}

export default function ContactFormFields(props: ContactFormFieldsProps) {
  return (
    <>
      <IdentityFields {...props} />
      <SessionFields {...props} />
      <ScheduleFields {...props} />
      <div className="contact-field">
        <label htmlFor="message" className="contact-label">Message *</label>
        <textarea id="message" name="message" required
          placeholder="Anything else — vibe you want, questions, or whatever's on your mind."
          className="contact-textarea" value={props.form.message} onChange={props.onChange} />
      </div>
    </>
  );
}
