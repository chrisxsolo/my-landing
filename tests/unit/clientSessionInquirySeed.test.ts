import { describe, expect, it } from "vitest";
import {
  buildClientSessionDateTime,
  buildClientSessionSyncFields,
} from "@/lib/clientSessionInquirySeed";

describe("client session inquiry synchronization", () => {
  it("converts the inquiry date and preferred time to the correct Pacific instant", () => {
    expect(buildClientSessionDateTime("2026-06-20", null, "7:00 PM"))
      .toBe("2026-06-21T02:00:00.000Z");
    expect(buildClientSessionDateTime("2026-06-20", null, null))
      .toBe("2026-06-20");
  });

  it("mirrors client inquiry details into portal fields", () => {
    expect(buildClientSessionSyncFields({
      id: 31,
      name: "Anna Babchanik",
      email: "babchanik31@gmail.com",
      session_type: "Graduation Portrait",
      session_date: "2026-06-20",
      date_in_mind: null,
      preferred_time: "7 pm",
      location: null,
      school: "Stanford",
      booking_confirmed: true,
      created_at: "2026-04-24T06:42:38.311894+00:00",
    })).toEqual({
      client_name: "Anna Babchanik",
      session_type: "Graduation Portrait",
      session_date: "2026-06-21T02:00:00.000Z",
      location: "Stanford",
    });
  });
});
