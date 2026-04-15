// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/login   — verify password, set httpOnly session cookie
// DELETE /api/admin/login — clear session cookie (logout)
//
// Env vars required:
//   ADMIN_PASSWORD        — your admin password (not hardcoded)
//   ADMIN_SESSION_SECRET  — long random string used as the cookie value
//                           generate with: openssl rand -hex 32
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "admin_session";
const COOKIE_OPTS = {
  httpOnly:  true,
  secure:    process.env.NODE_ENV === "production",
  sameSite:  "lax" as const,
  path:      "/",
  maxAge:    60 * 60 * 24 * 30, // 30 days
};

export async function POST(req: NextRequest) {
  let body: { password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!adminPassword || !sessionSecret) {
    console.error("Missing ADMIN_PASSWORD or ADMIN_SESSION_SECRET env vars");
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  if (body.password !== adminPassword) {
    // Constant-time-ish comparison isn't strictly needed for a single-user app,
    // but returning a 401 after a brief delay reduces brute-force value.
    await new Promise(r => setTimeout(r, 300));
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, sessionSecret, COOKIE_OPTS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { ...COOKIE_OPTS, maxAge: 0 });
  return res;
}
