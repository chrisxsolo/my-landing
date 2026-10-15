import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as route from "@/app/api/admin/login/route";
import * as auth from "@/lib/adminAuth";

type SessionAuth = typeof auth & { refreshAdminSession: () => Promise<boolean>; subscribeAdminAuth: (cb: () => void) => () => void };
const sessionAuth = auth as SessionAuth;
const values = new Map<string, string>();
beforeEach(() => {
  vi.stubEnv("ADMIN_SESSION_SECRET", "test-session-secret");
  values.clear();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function status(cookie?: string) {
  const handler = (route as typeof route & { GET?: (req: NextRequest) => Response }).GET;
  expect(handler).toBeTypeOf("function");
  return handler!(new NextRequest("http://localhost/api/admin/login", { headers: cookie ? { cookie } : {} }));
}

describe("admin session status", () => {
  it("rejects missing cookies even if the browser has a remembered login", async () => {
    expect((await status()).status).toBe(401);
  });
  it("accepts a valid server cookie without exposing its value", async () => {
    const res = await status("admin_session=test-session-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: true });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

describe("browser session verification", () => {
  it("clears a stale local login and notifies mounted consumers", async () => {
    values.set("chris_admin_authed", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    expect(sessionAuth.refreshAdminSession).toBeTypeOf("function");
    const listener = vi.fn();
    const cleanup = sessionAuth.subscribeAdminAuth(listener);
    expect(await sessionAuth.refreshAdminSession()).toBe(false);
    expect(auth.checkAuth()).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
    cleanup();
  });
  it("restores the UI flag from a valid server session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ authenticated: true })));
    expect(sessionAuth.refreshAdminSession).toBeTypeOf("function");
    expect(await sessionAuth.refreshAdminSession()).toBe(true);
    expect(auth.checkAuth()).toBe(true);
  });
  it("does not log out the user on a transient network or server failure", async () => {
    values.set("chris_admin_authed", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    expect(sessionAuth.refreshAdminSession).toBeTypeOf("function");
    await expect(sessionAuth.refreshAdminSession()).rejects.toThrow();
    expect(auth.checkAuth()).toBe(true);
  });
});

describe("session races", () => {
  it("does not let an old unauthorized check undo a successful login", async () => {
    let resolveCheck!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => { resolveCheck = resolve; }))
      .mockResolvedValueOnce(Response.json({ ok: true })));
    const pending = sessionAuth.refreshAdminSession();
    await auth.login("test-password");
    resolveCheck(new Response(null, { status: 401 }));
    expect(await pending).toBe(true);
    expect(auth.checkAuth()).toBe(true);
  });
  it("stays logged out when verification overlaps logout", async () => {
    values.set("chris_admin_authed", "true");
    let resolveLogout!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => { resolveLogout = resolve; }))
      .mockResolvedValue(Response.json({ authenticated: true })));
    const pending = auth.logout();
    await sessionAuth.refreshAdminSession();
    resolveLogout(Response.json({ ok: true }));
    await pending;
    expect(auth.checkAuth()).toBe(false);
  });
  it("reports a rejected logout and keeps the real signed-in state", async () => {
    values.set("chris_admin_authed", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(auth.logout()).rejects.toThrow();
    expect(auth.checkAuth()).toBe(true);
  });
});
