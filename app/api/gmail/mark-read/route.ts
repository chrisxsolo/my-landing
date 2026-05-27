// POST /api/gmail/mark-read
// Body: { threadId: string }
// Removes the UNREAD label from a Gmail thread so the "New Reply" badge disappears.

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json() as { threadId?: string };
  if (!body.threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });

  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${body.threadId}/modify`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
