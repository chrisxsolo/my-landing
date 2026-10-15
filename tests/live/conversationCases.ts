// ─────────────────────────────────────────────────────────────────────────────
// Multi-turn conversations, reconstructed point-in-time.
//
// These are two real threads from the business inbox, reduced to the facts the
// evaluation needs. Names are changed, addresses and phone numbers removed,
// and the client prose is paraphrased. What is kept verbatim in spirit is the
// SHAPE: what was known when, and what Chris actually wrote next.
//
// The point of the exercise is leakage. Each case carries only the messages
// that existed BEFORE Chris's reply, so a draft cannot know a location the
// client confirmed two emails later. `chrisActuallyWrote` is the reply he sent
// at that moment, for comparison — never fed to the model.
// ─────────────────────────────────────────────────────────────────────────────

import type { ThreadMessage } from "../../lib/ai/threadDigest";
import type { InquiryInput, AvailabilitySnapshot } from "../../lib/ai/buildEmailContext";

export type ConversationCase = {
  id: string;
  /** What this turn is testing. */
  stage: string;
  inquiry: InquiryInput;
  /** Thread as it stood before Chris replied. Oldest first. */
  history: ThreadMessage[];
  /** The client email being answered. */
  latestClientMessage: string;
  /** Availability as it was, so dates are judged against what he had open. */
  availability: AvailabilitySnapshot;
  /** Chris's real reply. Reference only. */
  chrisActuallyWrote: string;
  /** Deterministic expectations for this turn. */
  expect: {
    /** Substrings that must NOT appear: settled facts he would not restate. */
    mustNotRepeat?: string[];
    /** Prices that must not be stated at this point. */
    forbiddenPrices?: string[];
    /** Must address these, loosely, by keyword. */
    shouldAddress?: string[];
    maxWords?: number;
  };
};

function at(iso: string, fromMe: boolean, body: string): ThreadMessage {
  return { timestamp: iso, fromMe, body };
}

function availability(dates: string[], booked: string[] = []): AvailabilitySnapshot {
  const entry = (date: string) => ({
    date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short", month: "long", day: "numeric", year: "numeric",
    }),
    note: null,
  });
  return {
    asOf: dates[0] ?? "2026-09-16",
    available: dates.map(entry),
    onHold: [],
    booked: booked.map(entry),
  };
}

// ── Thread A: a family session, four turns ───────────────────────────────────
// Tests the behaviour that matters most across a conversation: by turn three
// the date, time, location and price are settled, and the reply must stop
// re-selling them.

const FAMILY_INQUIRY: InquiryInput = {
  name: "Ana Reyes",
  email: "client-a@example.com",
  sessionType: "Family Session",
  message: "We're a family of 3 and a dog. We're hoping for a natural vibe, ASAP if possible",
  dateInMind: "ASAP",
  preferredTime: null,
  location: null,
  school: null,
  people: "3",
};

const A1 = at("2026-09-16T15:39:00Z", true,
  "Thank you so much for reaching out! A natural family session with the three of you and your dog sounds really sweet. To recommend the best date and location, could you tell me what area you're hoping to shoot in, what kind of vibe you want, what dates you're available, and whether you want a 30 or 60 minute session? For the best lighting I usually recommend shooting about an hour before sunset. Once we decide on the date, time and location I can send over the invoice and contract to secure the session");

const A2 = at("2026-09-16T16:18:00Z", false,
  "We are hoping to shoot in San Francisco, areas like Stern Grove, Crissy Field, Baker Beach or the SF Botanical Garden. I prefer something simple and scenic. If it's a weekday we're available Tuesday to Friday after 5pm. We're pretty flexible on the weekend except Sunday, we're only available from 11 onwards. We are interested in the 60 minute session");

const A3 = at("2026-09-16T21:49:00Z", true,
  "I'm available September 17 to 21, 24 to 25, or 29 to 30. For the location I think Crissy Field would be perfect for the family shoot, especially for a natural vibe with the grassy area, beach, and Golden Gate Bridge in the background. A good starting time would be around 5:45 pm so we can get softer lighting closer to sunset. Once we pick the date I can send over the invoice and contract to secure the session");

const A4 = at("2026-09-16T21:54:00Z", false, "Do you have the weekend of October 3rd available?");

const A5 = at("2026-09-17T15:17:00Z", true,
  "Unfortunately, I don't have any availability during the October 3rd weekend. I am available October 1st to 2nd, 5th to 7th, or the 9th around the same time. Let me know if any of those dates work for you!");

const A6 = at("2026-09-18T17:45:00Z", false, "Can we take October 9 please?");

const A7 = at("2026-09-19T22:47:00Z", true,
  "I just sent over the invoice and contract for October 9th at 5 pm at Crissy Field. We can meet at the picnic tables on the grass to start off the session. If you have any questions, feel free to let me know!");

const A8 = at("2026-10-06T12:43:00Z", false,
  "Good morning. We just realized that Fleet Week is happening. We have our session scheduled on the 9th. Would that still be a good day for us to do the session? Any tips for us in preparing for the session?");

export const CONVERSATION_CASES: ConversationCase[] = [
  {
    id: "A-turn2",
    stage: "Client answers the intake questions. Reply must offer real dates and pick one location.",
    inquiry: FAMILY_INQUIRY,
    history: [A1, A2],
    latestClientMessage: A2.body,
    availability: availability([
      "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21",
      "2026-09-24", "2026-09-25", "2026-09-29", "2026-09-30",
    ]),
    chrisActuallyWrote: A3.body,
    expect: {
      shouldAddress: ["crissy", "september"],
      // He has not asked for money yet and does not volunteer the retainer.
      mustNotRepeat: ["retainer", "non-refundable"],
      maxWords: 140,
    },
  },
  {
    id: "A-turn3",
    stage: "A one-line availability question after the location and time are settled.",
    inquiry: FAMILY_INQUIRY,
    history: [A1, A2, A3, A4],
    latestClientMessage: A4.body,
    availability: availability(
      ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-09"],
      ["2026-10-03", "2026-10-04"],
    ),
    chrisActuallyWrote: A5.body,
    expect: {
      shouldAddress: ["october"],
      // Crissy Field, 5:45 pm and the invoice step are all settled. His real
      // reply is 40 words and restates none of them.
      mustNotRepeat: ["Crissy Field", "5:45", "invoice", "contract", "$350", "$500"],
      maxWords: 110,
    },
  },
  {
    id: "A-turn5",
    stage: "A logistics question weeks after the booking is paid and confirmed.",
    inquiry: FAMILY_INQUIRY,
    history: [A1, A2, A3, A4, A5, A6, A7, A8],
    latestClientMessage: A8.body,
    availability: availability(["2026-10-09", "2026-10-12", "2026-10-13"]),
    chrisActuallyWrote:
      "Thank you so much for catching that! It looks like we should still be good for our session at 5 pm at Crissy Field on October 9th. Most of the major Fleet Week events take place over the weekend and are concentrated more toward the piers and northeastern side of the city, so Crissy Field should still work well for us. I would recommend arriving a little earlier than usual and keeping an eye on traffic and travel times that day. Giving yourself some extra time for parking would be helpful as well",
    expect: {
      shouldAddress: ["fleet"],
      // The session is booked and paid. Nothing about price or booking.
      forbiddenPrices: ["$350", "$500"],
      mustNotRepeat: ["retainer", "deposit", "secure the session", "send over the invoice"],
      maxWords: 160,
    },
  },

  // ── Thread B: a graduation that changes location mid-conversation ──────────
  // The travel fee is the thing being tested. The shoot moves off campus, so
  // the campus fee stops applying and the new one is not in the rate card.
  {
    id: "B-turn2",
    stage: "Client moves the shoot off campus and asks whether the look is doable.",
    inquiry: {
      name: "Grace Perryman",
      email: "client-b@example.com",
      sessionType: "Graduation Portrait",
      message: "Graduating from Santa Clara, looking for grad portraits for two of us",
      dateInMind: "late May or June",
      preferredTime: "golden hour",
      // What the client has now told him, and all he knows at this point.
      location: "Filoli Gardens in Woodside",
      school: "Santa Clara University",
      people: "2",
    },
    history: [
      at("2026-05-21T20:33:00Z", true,
        "Congratulations on graduating from SCU with three majors! That's incredible! I'd love to shoot your grad portraits. For two people, sessions are $300 per person, and there's a $75 travel fee for Santa Clara. I have May 26, May 27, and May 28 open at golden hour if you want to knock it out before the end of the month, or plenty of June dates work too"),
      at("2026-05-21T21:16:00Z", false,
        "Thank you so much for the quick reply! I am going to double check with my friend to make sure she is free and okay with the price quote. I am definitely interested. A little more information about the shoot I am hoping to plan: I would like to shoot at Filoli Gardens in Woodside, which is about 30 to 40 minutes closer to SF than Santa Clara. The vibe would be more ethereal and golden. I've put together some pose inspiration in an album for reference. Is this something you would feel comfortable re-creating?"),
    ],
    latestClientMessage:
      "Thank you so much for the quick reply! I am going to double check with my friend to make sure she is free and okay with the price quote. I am definitely interested. A little more information about the shoot I am hoping to plan: I would like to shoot at Filoli Gardens in Woodside, which is about 30 to 40 minutes closer to SF than Santa Clara. The vibe would be more ethereal and golden. I've put together some pose inspiration in an album for reference. Is this something you would feel comfortable re-creating?",
    availability: availability(["2026-05-26", "2026-05-27", "2026-05-28", "2026-06-05", "2026-06-06", "2026-06-12"]),
    chrisActuallyWrote:
      "Perfect, thanks for the additional details! Filoli would definitely be doable! Since the location would be changing from Santa Clara University to Filoli, the travel fee would be updated accordingly. The travel fee will be $30. One thing I did want to mention though: Filoli closes at 5 pm, and the dreamy golden look from your inspiration photos is typically best achieved closer to actual golden hour, which right now is around 6:45 pm. So if we shoot there, we'd likely need to start around 3:30 to 4:00 pm, which is totally workable, but just know the lighting will be different from true golden hour",
    expect: {
      shouldAddress: ["filoli"],
      // $75 was the Santa Clara fee. Naming it to say it no longer applies is
      // correct and is what the draft does, so only an assertion that Filoli
      // costs $75 is a failure.
      mustNotRepeat: ["travel fee for Filoli is $75", "$75 travel fee for Filoli", "$300 per person"],
      maxWords: 170,
    },
  },
];
