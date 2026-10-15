import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/record-final-payment/route";

const db = vi.hoisted(() => ({ insert: vi.fn(), lookup: vi.fn() }));
vi.mock("@/lib/requireAdmin", () => ({ requireAdmin: () => null }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClient: () => ({ from: () => ({
    insert: db.insert,
    select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: db.lookup }) }) }) }),
  }) }),
}));

function request(body: unknown) {
  return new NextRequest("http://localhost/api/admin/record-final-payment", {
    method: "POST", body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.lookup.mockResolvedValue({ data: null, error: null });
  db.insert.mockResolvedValue({ error: null });
});

describe("final payment validation", () => {
  it.each(["abc", "-150", "0", "1e3", "12.345", "1,23", "", " ", 150, null])(
    "rejects invalid amount %j without a database write", async amount => {
      const res = await POST(request({ inquiry_id: 1, amount }));
      expect(res.status).toBe(400);
      expect(db.insert).not.toHaveBeenCalled();
    },
  );
  it.each([null, [], { inquiry_id: -1, amount: "150" }, { inquiry_id: "1", amount: "150" }])(
    "rejects malformed bodies %j", async body => {
      expect((await POST(request(body))).status).toBe(400);
      expect(db.insert).not.toHaveBeenCalled();
    },
  );
  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/admin/record-final-payment", { method: "POST", body: "{" });
    expect((await POST(req)).status).toBe(400);
  });
  it.each([["150", 15000], [" $1,234.56 ", 123456], ["0.01", 1]])(
    "records valid amount %s in cents", async (amount, cents) => {
      expect((await POST(request({ inquiry_id: 1, amount }))).status).toBe(200);
      expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ amount_cents: cents, payment_type: "deposit_2" }));
    },
  );
  it("does not insert again when a final payment already exists", async () => {
    db.lookup.mockResolvedValue({ data: { id: 7 }, error: null });
    const res = await POST(request({ inquiry_id: 1, amount: "150" }));
    expect(await res.json()).toEqual({ ok: true, skipped: true });
    expect(db.insert).not.toHaveBeenCalled();
  });
});
