import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession } from "./helpers";
import { runEmailFactExtraction, checkForNewMessages } from "@/lib/contentEngine/emailFacts/run";
import { groupIntoThreads, type ConversationMessage } from "@/lib/contentEngine/emailFacts/conversation";
import { planFactMerge, isDefaultAccepted } from "@/lib/contentEngine/emailFacts/merge";
import { updateSessionFacts } from "@/lib/contentEngine/createSession";
import type { ModelCallResult } from "@/lib/contentEngine/aiClient";
import type { EmailFactField } from "@/lib/contentEngine/emailFacts/fields";

beforeAll(() => resetDb());

const CLIENT_EMAIL = "dana.whitfield@example.com";
const CONNECTED = ["chris@soloxsnaps.com"];

// The spec's worked example, as real messages.
const COUPLES_THREAD: ConversationMessage[] = [
  {
    gmailMessageId: "c1", threadId: "couples", at: "2026-10-01T17:00:00.000Z",
    direction: "client", subject: "Couples photos",
    body: "Hi Chris! We're thinking about doing our photoshoot at Baker Beach.",
  },
  {
    gmailMessageId: "c2", threadId: "couples", at: "2026-10-05T17:00:00.000Z",
    direction: "client", subject: "Couples photos",
    body: "Actually, could we do Palace of Fine Arts instead?",
  },
  {
    gmailMessageId: "c3", threadId: "couples", at: "2026-10-08T17:00:00.000Z",
    direction: "photographer", subject: "Couples photos",
    body: "Palace of Fine Arts works perfectly!",
  },
  {
    gmailMessageId: "c4", threadId: "couples", at: "2026-10-10T17:00:00.000Z",
    direction: "client", subject: "Couples photos",
    body: "Let's confirm October 25th at 5:30 pm. We're planning neutral colors, "
      + "and I'll change into a white dress. We've been dating three years.",
  },
];

const GRAD_THREAD: ConversationMessage[] = [
  {
    gmailMessageId: "g1", threadId: "grad", at: "2026-04-02T17:00:00.000Z",
    direction: "client", subject: "Graduation photos",
    body: "I graduate from UC Berkeley in May and want cap and gown photos.",
  },
  {
    gmailMessageId: "g2", threadId: "grad", at: "2026-04-03T17:00:00.000Z",
    direction: "photographer", subject: "Graduation photos",
    body: "Congratulations! Memorial Glade on May 14 works for me.",
  },
];

const field = (over: Record<string, unknown> = {}) => ({
  value: null, confidence: "low", status: "unknown", source_message: null, evidence: null, ...over,
});

/** What a well-behaved model returns for the couples thread. */
const COUPLES_FIELDS = {
  public_display_name: field({ value: "Dana", confidence: "high", status: "confirmed", source_message: 4, evidence: "Let's confirm October 25th at 5:30 pm" }),
  internal_client_name: field({ value: "Dana Whitfield", confidence: "medium", status: "confirmed", source_message: 1, evidence: "Hi Chris!" }),
  service_type: field({ value: "couples", confidence: "high", status: "confirmed", source_message: 1, evidence: "doing our photoshoot at Baker Beach" }),
  primary_location: field({ value: "Palace of Fine Arts", confidence: "high", status: "confirmed", source_message: 3, evidence: "Palace of Fine Arts works perfectly!" }),
  session_date: field({ value: "2026-10-25", confidence: "high", status: "confirmed", source_message: 4, evidence: "Let's confirm October 25th" }),
  start_time: field({ value: "17:30", confidence: "high", status: "confirmed", source_message: 4, evidence: "October 25th at 5:30 pm" }),
  lighting_condition: field({ value: "golden_hour", confidence: "medium", status: "planned", source_message: 4, evidence: "October 25th at 5:30 pm" }),
  relationship_type: field({ value: "couple", confidence: "high", status: "confirmed", source_message: 4, evidence: "We've been dating three years" }),
  outfit_styling: field({ value: "Neutral-colored outfits with a second look featuring a white dress", confidence: "high", status: "confirmed", source_message: 4, evidence: "planning neutral colors, and I'll change into a white dress" }),
  public_session_summary: field({ value: "A couples session at the Palace of Fine Arts in San Francisco, planned around golden hour with neutral-toned outfits and a white-dress second look.", confidence: "medium", status: "planned" }),
  internal_notes: field({ value: "Second outfit change on site — allow time for it.", confidence: "medium", status: "confirmed" }),
  // Nothing in the thread supports these.
  vibe: field(),
  best_moment: field(),
  secondary_locations: field({ value: [] }),
  school_slug: field(),
};

function modelReturning(fields: Record<string, unknown>) {
  return async (): Promise<ModelCallResult> => ({
    text: JSON.stringify({ fields }),
    usage: { input_tokens: 2400, output_tokens: 420 },
    model: "claude-sonnet-4-6",
  });
}

const threadFetcher = (messages: ConversationMessage[]) => async () => groupIntoThreads(messages);

async function seedSession(opts: {
  messages?: ConversationMessage[];
  facts?: Record<string, unknown>;
} = {}) {
  const { data: cs, error } = await service.from("client_sessions").insert({
    client_email: CLIENT_EMAIL, client_name: "Dana Whitfield",
    session_type: "Couples Session", current_status: "booked",
  }).select("id").single();
  if (error) throw error;

  const sessionId = await createTestSession({
    service_type: "couples", public_display_name: null, client_session_id: cs.id,
  });
  if (opts.facts) {
    await updateSessionFacts({ client: service, sessionId, facts: opts.facts });
  }
  return sessionId;
}

const run = (sessionId: string, over: Record<string, unknown> = {}) =>
  runEmailFactExtraction({
    client: service,
    callModel: modelReturning(COUPLES_FIELDS),
    auth: "Bearer test",
    connectedEmails: CONNECTED,
    sessionId,
    fetchThreads: threadFetcher(COUPLES_THREAD),
    now: new Date("2026-10-12T12:00:00.000Z"),
    ...over,
  });

describe("Scenario A — extract, review and save an empty session", () => {
  it("runs the whole workflow and commits only what was accepted", async () => {
    const sessionId = await seedSession();

    // 1. extract
    const result = await run(sessionId);
    expect(result.outcome).toBe("extracted");
    if (result.outcome !== "extracted") return;
    expect(result.contact.email).toBe(CLIENT_EMAIL);
    expect(result.messageCount).toBe(4);
    expect(result.threads.map((t) => t.threadId)).toEqual(["couples"]);

    // 2. review — every suggestion is a fill on an empty session
    const suggestions = planFactMerge(result.facts, {});
    expect(suggestions.every((s) => s.action === "fill")).toBe(true);
    expect(suggestions.map((s) => s.field)).toContain("primary_location");
    expect(suggestions.find((s) => s.field === "primary_location")!.proposedValue)
      .toBe("Palace of Fine Arts");
    // Baker Beach was proposed and then dropped: it may still appear inside a
    // verbatim evidence quote, but never as a value being suggested.
    expect(suggestions.map((s) => s.proposedValue)).not.toContain("Baker Beach");
    expect(suggestions.filter((s) => s.field === "secondary_locations")).toEqual([]);

    // 3. save the accepted values through the real facts path
    const accepted: Record<string, unknown> = {};
    for (const suggestion of suggestions.filter(isDefaultAccepted)) {
      accepted[suggestion.field] = suggestion.field === "secondary_locations"
        ? suggestion.proposedValue.split(",").map((s) => s.trim()).filter(Boolean)
        : suggestion.proposedValue;
    }
    await updateSessionFacts({ client: service, sessionId, facts: accepted });

    const { data: row } = await service.from("photography_sessions")
      .select("*").eq("id", sessionId).single();
    expect(row!.public_display_name).toBe("Dana");
    expect(row!.internal_client_name).toBe("Dana Whitfield");
    expect(row!.service_type).toBe("couples");
    expect(row!.primary_location).toBe("Palace of Fine Arts");
    expect(row!.session_date).toBe("2026-10-25");
    expect(row!.start_time).toBe("17:30:00");
    expect(row!.lighting_condition).toBe("golden_hour");
    expect(row!.relationship_type).toBe("couple");
    expect(row!.outfit_styling).toMatch(/white dress/);
    expect(row!.public_session_summary).toMatch(/Palace of Fine Arts/);
    expect(row!.internal_notes).toMatch(/outfit change/);
    // Unsupported fields stayed empty rather than being invented.
    expect(row!.vibe).toBeNull();
    expect(row!.best_moment).toBeNull();
    expect(row!.school_slug).toBeNull();
  });

  it("records what it read so the next look has a baseline", async () => {
    const sessionId = await seedSession();
    await run(sessionId);
    const { data: row } = await service.from("photography_sessions")
      .select("email_facts_thread_ids,email_facts_last_message_id,email_facts_last_message_at,email_facts_extracted_at")
      .eq("id", sessionId).single();
    expect(row!.email_facts_thread_ids).toEqual(["couples"]);
    expect(row!.email_facts_last_message_id).toBe("c4");
    expect(Date.parse(row!.email_facts_last_message_at as string))
      .toBe(Date.parse("2026-10-10T17:00:00.000Z"));
    expect(row!.email_facts_extracted_at).toBeTruthy();
  });
});

describe("Scenario E — existing manual edits are protected", () => {
  it("flags a disagreement and leaves the saved value alone until accepted", async () => {
    const sessionId = await seedSession({
      facts: { primary_location: "Baker Beach", session_date: "2026-10-25" },
    });
    const result = await run(sessionId);
    if (result.outcome !== "extracted") throw new Error("expected an extraction");

    const { data: before } = await service.from("photography_sessions")
      .select("primary_location").eq("id", sessionId).single();
    expect(before!.primary_location).toBe("Baker Beach"); // extraction wrote nothing

    const current = { primary_location: "Baker Beach", session_date: "2026-10-25" };
    const suggestions = planFactMerge(result.facts, current);
    const location = suggestions.find((s) => s.field === "primary_location")!;
    expect(location.action).toBe("conflict");
    expect(location.currentValue).toBe("Baker Beach");
    expect(location.proposedValue).toBe("Palace of Fine Arts");
    expect(location.evidence).toBe("Palace of Fine Arts works perfectly!");
    expect(isDefaultAccepted(location)).toBe(false);

    // The already-correct date is reported as matching, not as a change.
    expect(suggestions.find((s) => s.field === "session_date")!.action).toBe("unchanged");
  });
});

describe("Scenario C — an unconfirmed change does not move a confirmed date", () => {
  it("keeps the saved date when the newest message only asks about another one", async () => {
    const sessionId = await seedSession({ facts: { session_date: "2026-10-25" } });
    const asked = [...COUPLES_THREAD, {
      gmailMessageId: "c5", threadId: "couples", at: "2026-10-11T17:00:00.000Z",
      direction: "client" as const, subject: "Couples photos",
      body: "Quick question — would October 27th be available instead?",
    }];

    // A correct model reports the still-standing 25th, not the question.
    const result = await runEmailFactExtraction({
      client: service,
      callModel: modelReturning({
        ...COUPLES_FIELDS,
        session_date: field({
          value: "2026-10-25", confidence: "high", status: "confirmed",
          source_message: 4, evidence: "Let's confirm October 25th",
        }),
      }),
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId,
      fetchThreads: threadFetcher(asked),
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
    if (result.outcome !== "extracted") throw new Error("expected an extraction");
    expect(result.messageCount).toBe(5);

    const suggestions = planFactMerge(result.facts, { session_date: "2026-10-25" });
    expect(suggestions.find((s) => s.field === "session_date")!.action).toBe("unchanged");
    expect(JSON.stringify(suggestions)).not.toContain("2026-10-27");
  });
});

describe("Scenario F — two bookings for the same client", () => {
  it("tells a graduation thread from a couples thread by the service alone", async () => {
    const sessionId = await seedSession(); // service_type couples, no date or location yet
    const result = await runEmailFactExtraction({
      client: service, callModel: modelReturning(COUPLES_FIELDS),
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId,
      fetchThreads: threadFetcher([...COUPLES_THREAD, ...GRAD_THREAD]),
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
    expect(result.outcome).toBe("extracted");
    if (result.outcome !== "extracted") return;
    expect(result.threads.map((t) => t.threadId)).toEqual(["couples"]);
    expect(result.messageCount).toBe(4); // the grad thread was not mixed in
  });

  it("asks rather than guesses when both conversations are the same service", async () => {
    // An anniversary session last spring and an engagement session now: both
    // threads read as couples work and the booking has nothing saved yet to
    // tell them apart, so guessing could pull the wrong photoshoot's details.
    const sessionId = await seedSession();
    const anniversary: ConversationMessage[] = [{
      gmailMessageId: "a1", threadId: "anniversary", at: "2026-03-02T17:00:00.000Z",
      direction: "client", subject: "Anniversary couples photos",
      body: "We'd love couples photos for our anniversary at Lands End.",
    }];
    const result = await runEmailFactExtraction({
      client: service, callModel: modelReturning(COUPLES_FIELDS),
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId,
      fetchThreads: threadFetcher([...COUPLES_THREAD, ...anniversary]),
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
    expect(result.outcome).toBe("ambiguous");
    if (result.outcome !== "ambiguous") return;
    expect(result.threads.map((t) => t.threadId).sort()).toEqual(["anniversary", "couples"]);

    // Nothing was read and nothing was marked — the photographer decides first.
    const { data: row } = await service.from("photography_sessions")
      .select("email_facts_extracted_at").eq("id", sessionId).single();
    expect(row!.email_facts_extracted_at).toBeNull();
  });

  it("uses only the conversation the photographer picked", async () => {
    const sessionId = await seedSession();
    const result = await runEmailFactExtraction({
      client: service, callModel: modelReturning(COUPLES_FIELDS),
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId, threadId: "couples",
      fetchThreads: threadFetcher([...COUPLES_THREAD, ...GRAD_THREAD]),
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
    if (result.outcome !== "extracted") throw new Error("expected an extraction");
    expect(result.messageCount).toBe(4); // the couples thread only
    const { data: row } = await service.from("photography_sessions")
      .select("email_facts_thread_ids").eq("id", sessionId).single();
    expect(row!.email_facts_thread_ids).toEqual(["couples"]);
  });

  it("resolves the right thread on its own once the booking has facts", async () => {
    const sessionId = await seedSession({
      facts: { session_date: "2026-10-25", primary_location: "Palace of Fine Arts" },
    });
    const result = await runEmailFactExtraction({
      client: service, callModel: modelReturning(COUPLES_FIELDS),
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId,
      fetchThreads: threadFetcher([...COUPLES_THREAD, ...GRAD_THREAD]),
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
    expect(result.outcome).toBe("extracted");
    if (result.outcome !== "extracted") return;
    expect(result.threads.map((t) => t.threadId)).toEqual(["couples"]);
  });
});

describe("Scenario G — a later look sees the newest message", () => {
  it("re-reads the conversation and reports the new confirmation", async () => {
    const sessionId = await seedSession();
    await run(sessionId);

    const moved = [...COUPLES_THREAD, {
      gmailMessageId: "c6", threadId: "couples", at: "2026-10-20T17:00:00.000Z",
      direction: "photographer" as const, subject: "Couples photos",
      body: "Confirming the switch to Crissy Field on the 25th.",
    }];
    const second = await runEmailFactExtraction({
      client: service,
      callModel: modelReturning({
        ...COUPLES_FIELDS,
        primary_location: field({
          value: "Crissy Field", confidence: "high", status: "confirmed",
          source_message: 5, evidence: "Confirming the switch to Crissy Field",
        }),
      }),
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId,
      fetchThreads: threadFetcher(moved),
      now: new Date("2026-10-21T12:00:00.000Z"),
    });
    if (second.outcome !== "extracted") throw new Error("expected an extraction");
    expect(second.messageCount).toBe(5);
    expect(second.facts.find((f) => f.field === "primary_location")?.value).toBe("Crissy Field");

    const { data: row } = await service.from("photography_sessions")
      .select("email_facts_last_message_id").eq("id", sessionId).single();
    expect(row!.email_facts_last_message_id).toBe("c6");
  });
});

describe("Scenario J — Gmail or the model is unavailable", () => {
  it("fails without touching saved facts when the model fails", async () => {
    const sessionId = await seedSession({ facts: { primary_location: "Baker Beach" } });
    await expect(runEmailFactExtraction({
      client: service,
      callModel: async () => { throw new Error("529 overloaded"); },
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId,
      fetchThreads: threadFetcher(COUPLES_THREAD),
    })).rejects.toThrow(/529/);

    const { data: row } = await service.from("photography_sessions")
      .select("primary_location,email_facts_extracted_at").eq("id", sessionId).single();
    expect(row!.primary_location).toBe("Baker Beach");
    expect(row!.email_facts_extracted_at).toBeNull();
  });

  it("fails without touching saved facts when Gmail fails", async () => {
    const sessionId = await seedSession({ facts: { primary_location: "Baker Beach" } });
    await expect(runEmailFactExtraction({
      client: service, callModel: modelReturning(COUPLES_FIELDS),
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId,
      fetchThreads: async () => { throw new Error("Gmail search failed (401)"); },
    })).rejects.toThrow(/Gmail search failed/);

    const { data: row } = await service.from("photography_sessions")
      .select("primary_location").eq("id", sessionId).single();
    expect(row!.primary_location).toBe("Baker Beach");
  });

  it("reports no conversation instead of inventing facts", async () => {
    const sessionId = await seedSession();
    const result = await runEmailFactExtraction({
      client: service, callModel: modelReturning(COUPLES_FIELDS),
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId,
      fetchThreads: async () => [],
    });
    expect(result.outcome).toBe("no_conversation");
  });

  it("reports no linked client when the session has no contact", async () => {
    const sessionId = await createTestSession({ service_type: "couples", client_session_id: null });
    const result = await runEmailFactExtraction({
      client: service, callModel: modelReturning(COUPLES_FIELDS),
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId,
      fetchThreads: threadFetcher(COUPLES_THREAD),
    });
    expect(result.outcome).toBe("no_contact");
  });
});

describe("permissions", () => {
  it("refuses to send a client's correspondence to the model without AI permission", async () => {
    const sessionId = await createTestSession({
      service_type: "couples", ai_processing_allowed: false,
    });
    await expect(runEmailFactExtraction({
      client: service, callModel: modelReturning(COUPLES_FIELDS),
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId,
      fetchThreads: threadFetcher(COUPLES_THREAD),
    })).rejects.toThrow(/ai processing is not allowed/i);
  });
});

describe("linked inquiry threads", () => {
  it("prefers the thread already linked to the booking's inquiry", async () => {
    const { data: inquiry, error } = await service.from("inquiries").insert({
      name: "Dana Whitfield", email: CLIENT_EMAIL, message: "Couples photos please",
      session_type: "Couples Session", gmail_thread_ids: ["grad"],
    }).select("id").single();
    if (error) throw error;

    const sessionId = await createTestSession({ service_type: "couples" });
    await service.from("photography_sessions").update({ inquiry_id: inquiry.id }).eq("id", sessionId);

    const result = await runEmailFactExtraction({
      client: service,
      callModel: modelReturning({
        ...COUPLES_FIELDS,
        primary_location: field({
          value: "Memorial Glade", confidence: "high", status: "confirmed",
          source_message: 2, evidence: "Memorial Glade on May 14 works for me",
        }),
      }),
      auth: "Bearer test", connectedEmails: CONNECTED, sessionId,
      fetchThreads: threadFetcher([...COUPLES_THREAD, ...GRAD_THREAD]),
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
    if (result.outcome !== "extracted") throw new Error("expected an extraction");
    expect(result.threads.map((t) => t.threadId)).toEqual(["grad"]);
    expect(result.messageCount).toBe(2);
  });
});

describe("freshness check", () => {
  it("reports never_extracted before the first run, so no Gmail work happens", async () => {
    const sessionId = await seedSession();
    const freshness = await checkForNewMessages({
      client: service, auth: "Bearer test", sessionId,
    });
    expect(freshness.outcome).toBe("never_extracted");
  });
});

describe("field validation at the save boundary", () => {
  it("refuses a lighting value outside the taxonomy", async () => {
    const sessionId = await seedSession();
    await expect(updateSessionFacts({
      client: service, sessionId, facts: { lighting_condition: "dappled twilight" },
    })).rejects.toThrow(/invalid lighting condition/i);
  });

  it("refuses a malformed session time and clears an empty one", async () => {
    const sessionId = await seedSession({ facts: { start_time: "17:30" } });
    await expect(updateSessionFacts({
      client: service, sessionId, facts: { start_time: "5:30 pm" },
    })).rejects.toThrow(/invalid start time/i);

    await updateSessionFacts({ client: service, sessionId, facts: { start_time: null } });
    const { data: row } = await service.from("photography_sessions")
      .select("start_time").eq("id", sessionId).single();
    expect(row!.start_time).toBeNull();
  });
});

describe("accepting only some suggestions", () => {
  it("writes the accepted field and leaves the rejected one as it was", async () => {
    const sessionId = await seedSession({ facts: { primary_location: "Baker Beach" } });
    const result = await run(sessionId);
    if (result.outcome !== "extracted") throw new Error("expected an extraction");

    const suggestions = planFactMerge(result.facts, { primary_location: "Baker Beach" });
    const accepted: Partial<Record<EmailFactField, string>> = {};
    for (const suggestion of suggestions) {
      // accept the date, decline the location conflict
      if (suggestion.field === "session_date") accepted[suggestion.field] = suggestion.proposedValue;
    }
    await updateSessionFacts({ client: service, sessionId, facts: accepted });

    const { data: row } = await service.from("photography_sessions")
      .select("primary_location,session_date").eq("id", sessionId).single();
    expect(row!.primary_location).toBe("Baker Beach");
    expect(row!.session_date).toBe("2026-10-25");
  });
});
