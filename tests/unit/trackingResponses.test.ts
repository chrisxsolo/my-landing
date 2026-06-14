import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as trackEvent } from "@/app/api/track-event/route";
import { POST as trackVisitor } from "@/app/api/track-visitor/route";

const originalVercelEnv = process.env.VERCEL_ENV;

function request(path: string) {
  return new NextRequest(`http://localhost${path}`, { method: "POST" });
}

beforeEach(() => {
  process.env.VERCEL_ENV = "development";
});

afterEach(() => {
  if (originalVercelEnv === undefined) {
    delete process.env.VERCEL_ENV;
    return;
  }
  process.env.VERCEL_ENV = originalVercelEnv;
});

describe.each([
  ["/api/track-event", trackEvent],
  ["/api/track-visitor", trackVisitor],
] as const)("%s", (path, handler) => {
  it("returns a fresh readable response for every request", async () => {
    const first = await handler(request(path));
    const second = await handler(request(path));

    expect(first).not.toBe(second);
    await expect(first.json()).resolves.toEqual({ ok: true });
    await expect(second.json()).resolves.toEqual({ ok: true });
  });
});
