// Shared fixtures for the email-assistant regression suite.
//
// Every test here runs against a fake model caller. No test in this file makes
// a paid API call, which is why the suite can run on every commit.

import type { EmailModelCaller, EmailCallResult, EmailCallRequest } from "@/lib/ai/emailModel";
import type { AvailabilitySnapshot, InquiryInput } from "@/lib/ai/buildEmailContext";
import type { ThreadMessage } from "@/lib/ai/threadDigest";

export const NOW = new Date("2026-10-14T12:00:00Z");

function entry(date: string, note: string | null = null) {
  return {
    date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short", month: "long", day: "numeric", year: "numeric",
    }),
    note,
  };
}

/** Oct 26 / 28 / 30 open, Oct 18 booked, Oct 24 on hold. */
export const AVAILABILITY: AvailabilitySnapshot = {
  asOf: "2026-10-14",
  available: [entry("2026-10-26"), entry("2026-10-28"), entry("2026-10-30")],
  onHold: [entry("2026-10-24")],
  booked: [entry("2026-10-18"), entry("2026-10-17")],
};

export const NO_AVAILABILITY: AvailabilitySnapshot = {
  asOf: "2026-10-14", available: [], onHold: [], booked: [entry("2026-10-18")],
};

export function inquiry(overrides: Partial<InquiryInput> = {}): InquiryInput {
  return {
    name: "Sarah Chen",
    email: "sarah@example.com",
    message: "Hi! I'd love to book graduation photos.",
    sessionType: "Graduation",
    ...overrides,
  };
}

export function message(body: string, fromMe: boolean, daysAgo = 1): ThreadMessage {
  return { body, fromMe, timestamp: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString() };
}

export type CapturedCall = { system: { stable: string; volatile: string }; userPrompt: string };

/**
 * A model caller that returns a canned draft and records what it was asked.
 *
 * `calls` is how the suite asserts the single-request requirement: one draft
 * must produce exactly one entry.
 */
export function fakeCaller(
  reply: string | ((req: EmailCallRequest) => string),
  options: { stopReason?: string | null } = {},
): EmailModelCaller & { calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];

  const caller = async (req: EmailCallRequest): Promise<EmailCallResult> => {
    calls.push({ system: req.system, userPrompt: req.userPrompt });
    return {
      text: typeof reply === "function" ? reply(req) : reply,
      model: "claude-sonnet-5-5",
      usage: {
        input_tokens: 1200,
        output_tokens: 180,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 800,
      },
      stopReason: options.stopReason ?? "end_turn",
      durationMs: 1400,
    };
  };

  return Object.assign(caller, { calls });
}

/** A clean draft that satisfies every permanent rule. */
export const GOOD_DRAFT = `Hi Sarah,

Thank you so much for reaching out! I'd love to take your graduation photos!

I'm available October 26th, 28th, or 30th during golden hour, which would be a beautiful time for photos!

Let me know which date works best for you!

Looking forward to hearing back from you!`;
