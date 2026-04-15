// ─────────────────────────────────────────────────────────────────────────────
// middleware.ts
//
// Protects all admin API routes with a server-side httpOnly cookie.
// The cookie is set by POST /api/admin/login after password verification.
//
// Public routes (no cookie required):
//   GET  /api/gmail/callback   — called by Google during OAuth
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

const PROTECTED = [
  "/api/draft-reply",
  "/api/gmail/auth",
  "/api/gmail/thread",
  "/api/gmail/message",
  "/api/gmail/send",
  "/api/gmail/status",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // OAuth callback is invoked by Google's servers — must stay open
  if (pathname === "/api/gmail/callback") return NextResponse.next();

  if (!PROTECTED.some(p => pathname.startsWith(p))) return NextResponse.next();

  const session = request.cookies.get("admin_session")?.value;
  const secret  = process.env.ADMIN_SESSION_SECRET;

  if (!secret || !session || session !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/gmail/:path*", "/api/draft-reply"],
};
