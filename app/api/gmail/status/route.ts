// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/gmail/status   — returns SAFE status only (never raw tokens):
//                            { connected, email?, expiry?, reconnectRequired }
// DELETE /api/gmail/status — removes stored tokens (disconnect)
//
// Raw access/refresh tokens live in the locked-down gmail_credentials table and
// are handled only by server-side service-role code (lib/gmailTokens.ts). This
// endpoint must never return them.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { getValidTokens, clearGmailTokens } from "@/lib/gmailTokens";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    // getValidTokens() also auto-refreshes if expiring — so this is a real
    // liveness check, not just "does the row exist?"
    const tokens = await getValidTokens();
    if (!tokens) {
      // Tokens existed but can't be refreshed (revoked, expired, missing
      // refresh_token). Clean up the stale entry so the UI shows disconnected.
      await clearGmailTokens();
      return NextResponse.json({ connected: false, reconnectRequired: true });
    }
    // Safe fields only — no access_token / refresh_token.
    return NextResponse.json({
      connected: true,
      email: tokens.email ?? "Gmail",
      expiry: tokens.expiry_date,
      reconnectRequired: false,
    });
  } catch {
    return NextResponse.json({ connected: false, reconnectRequired: true });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  await clearGmailTokens();
  return NextResponse.json({ ok: true });
}
