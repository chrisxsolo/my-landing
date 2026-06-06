// ─────────────────────────────────────────────────────────────────────────────
// lib/requireAdmin.ts
//
// Drop-in auth check for protected API route handlers.
// Replaces middleware.ts to avoid Next.js 16 webpack/edge-runtime issues.
//
// Usage (at the top of any protected route handler):
//
//   const deny = requireAdmin(req);
//   if (deny) return deny;          // returns 401 JSON if unauthorized
//
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { isValidAdminSession } from "@/lib/adminAuthShared";

export function requireAdmin(req: NextRequest): NextResponse | null {
  const session = req.cookies.get("admin_session")?.value;
  const secret  = process.env.ADMIN_SESSION_SECRET;

  if (!isValidAdminSession(session, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // authorized — caller continues normally
}
