// ─────────────────────────────────────────────────────────────────────────────
// /api/ai/rules — the learned-rules queue.
//
//   GET    returns the permanent profile (read-only, for reference) plus every
//          learned rule grouped by status, so Chris can see exactly what the
//          model is being told.
//   POST   { id, action: "approve" | "reject", supersedes?: string[] }
//          Approving is the only way a rule reaches a prompt. `supersedes`
//          retires the rules it contradicts in the same write, which is how a
//          conflict gets resolved instead of accumulating.
//
// Previously this route returned the raw markdown note and there was no way to
// approve, reject, or retire anything.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchWritingRules, setRuleStatus, insertWritingRule } from "@/lib/ai/aiEmailStore";
import { classifyRuleIntake, selectPromptRules, RULE_CATEGORIES, type RuleCategory } from "@/lib/ai/writingRules";
import { PERMANENT_RULES, STYLE_NOTES, BANNED_PHRASES } from "@/lib/ai/soloxsnapsWritingProfile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const rules = await fetchWritingRules();

  return NextResponse.json({
    // The permanent profile lives in code and cannot be edited here. Showing it
    // makes clear which rules are fixed and which were learned.
    permanent: {
      hardRules: PERMANENT_RULES,
      styleNotes: STYLE_NOTES,
      bannedPhrases: BANNED_PHRASES,
      editable: false,
      source: "lib/ai/soloxsnapsWritingProfile.ts",
    },
    learned: {
      pending: rules.filter((rule) => rule.status === "pending"),
      approved: rules.filter((rule) => rule.status === "approved"),
      rejected: rules.filter((rule) => rule.status === "rejected"),
      superseded: rules.filter((rule) => rule.status === "superseded"),
    },
    /** Exactly the learned rules the next draft will carry. */
    activeInPrompt: selectPromptRules(rules),
  });
}

type PostBody = {
  id?: string;
  action?: string;
  supersedes?: string[];
  /** For adding a rule by hand rather than from an edit. */
  rule?: string;
  category?: string;
};

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = (body.action ?? "").toLowerCase();

  // ── Add a rule by hand ───────────────────────────────────────────────────
  if (action === "add") {
    const text = (body.rule ?? "").trim();
    if (!text) return NextResponse.json({ error: "rule is required." }, { status: 400 });

    const category = (RULE_CATEGORIES as readonly string[]).includes(body.category ?? "")
      ? (body.category as RuleCategory)
      : "style";

    const existing = await fetchWritingRules();
    const intake = classifyRuleIntake(text, existing);
    if (intake.verdict !== "new") {
      // Refusing here is the point: a duplicate or a contradiction added
      // blindly is how the old rules note became self-contradictory.
      return NextResponse.json({ intake, added: null }, { status: 409 });
    }

    const row = await insertWritingRule({ rule: text, category, status: "pending", source: "manual" });
    if (!row) return NextResponse.json({ error: "Could not save the rule." }, { status: 500 });
    return NextResponse.json({ added: row, intake });
  }

  // ── Approve or reject ────────────────────────────────────────────────────
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: 'action must be "approve", "reject", or "add".' }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  if (action === "reject") {
    const ok = await setRuleStatus(body.id, "rejected");
    return ok
      ? NextResponse.json({ ok: true, status: "rejected" })
      : NextResponse.json({ error: "Could not update the rule." }, { status: 500 });
  }

  const approved = await setRuleStatus(body.id, "approved");
  if (!approved) return NextResponse.json({ error: "Could not update the rule." }, { status: 500 });

  // Retire the rules this one replaces, pointing them at their replacement so
  // the history stays readable.
  const retired: string[] = [];
  for (const supersededId of body.supersedes ?? []) {
    if (supersededId === body.id) continue;
    if (await setRuleStatus(supersededId, "superseded", body.id)) retired.push(supersededId);
  }

  return NextResponse.json({ ok: true, status: "approved", superseded: retired });
}
