// ─────────────────────────────────────────────────────────────────────────────
// /api/ai/examples — approved writing examples.
//
//   GET  lists the seeded examples and the ones Chris has approved.
//   POST saves a draft as an approved example.
//
// Only explicitly approved emails land here. A sent email is not automatically
// a good example, and the previous sync-from-sent behaviour treated every
// recent send as style evidence.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchExamplePool, insertApprovedExample } from "@/lib/ai/aiEmailStore";
import { resolvePlaybookKey } from "@/lib/ai/soloxsnapsWritingProfile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const pool = await fetchExamplePool();
  return NextResponse.json({
    seeded: pool.filter((example) => example.source === "seed"),
    approved: pool.filter((example) => example.source === "approved-draft"),
  });
}

type PostBody = {
  body?: string;
  session_type?: string | null;
  scenarios?: string[];
  tags?: string[];
  inquiry_id?: string | null;
};

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let payload: PostBody;
  try {
    payload = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (payload.body ?? "").trim();
  if (text.length < 40) {
    return NextResponse.json({ error: "That is too short to be a useful example." }, { status: 400 });
  }

  const ok = await insertApprovedExample({
    body: text,
    // Stored as a playbook key so example retrieval can match on it directly.
    sessionType: resolvePlaybookKey(payload.session_type),
    scenarios: payload.scenarios ?? [],
    tags: payload.tags ?? [],
    sourceInquiryId: payload.inquiry_id ?? null,
  });

  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Could not save the example." }, { status: 500 });
}
