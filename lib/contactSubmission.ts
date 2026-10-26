// lib/contactSubmission.ts
// The order of operations for sending the contact form, kept apart from React
// so it can be tested: only the network request decides success. Remembering
// the submission for the thank-you page is optional and can never undo it.

export const INQUIRY_SUBMISSION_STORAGE_KEY = "inquiry_submitted";

const FALLBACK_ERROR = "Something went wrong. Please try again.";

export type InquirySubmissionSteps = {
  /** POSTs the inquiry. Throws when the request fails. */
  send: () => Promise<void>;
  /** Best-effort: keeps a copy for the thank-you page. */
  remember: () => void;
  /** Runs once the inquiry is sent, e.g. navigating to the thank-you page. */
  onSent: () => void;
};

export type InquirySubmissionResult = { ok: true } | { ok: false; error: string };

export async function runInquirySubmission(steps: InquirySubmissionSteps): Promise<InquirySubmissionResult> {
  try {
    await steps.send();
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.message ? error.message : FALLBACK_ERROR };
  }

  try {
    steps.remember();
  } catch (error) {
    // Log the error type only: the payload holds the client's contact details.
    console.error("Could not keep the inquiry summary for the thank-you page", error instanceof Error ? error.name : typeof error);
  }

  steps.onSent();
  return { ok: true };
}
