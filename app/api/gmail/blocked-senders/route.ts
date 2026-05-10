import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  addBlockedSender,
  getBlockedSenders,
  removeBlockedSender,
} from "@/lib/gmailBlockedSenders";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const senders = await getBlockedSenders();
    return NextResponse.json({ senders });
  } catch (err) {
    console.error("[gmail/blocked-senders] GET", err);
    return NextResponse.json({ error: "Failed to load blocked senders." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const body = await req.json() as { email?: string };
    const senders = await addBlockedSender(body.email ?? "");
    return NextResponse.json({ senders });
  } catch (err) {
    console.error("[gmail/blocked-senders] POST", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to block sender." },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const body = await req.json() as { email?: string };
    const senders = await removeBlockedSender(body.email ?? "");
    return NextResponse.json({ senders });
  } catch (err) {
    console.error("[gmail/blocked-senders] DELETE", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to unblock sender." },
      { status: 400 },
    );
  }
}
