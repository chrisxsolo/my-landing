import { NextRequest, NextResponse } from "next/server";
import { listCouplesPosingPrompts } from "@/lib/couplesPrompts";
import {
  COUPLES_PROMPTS_TABLE,
  createCouplesPromptSlug,
  normalizeCouplesPromptRow,
  validateCouplesPromptInput,
} from "@/lib/couplesPosingGuide";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function jsonError(error: unknown, fallback: string, status = 500) {
  console.error(`[admin/couples-posing-prompts] ${fallback}`, error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

async function getNextNumbers() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(COUPLES_PROMPTS_TABLE)
    .select("prompt_number,display_order")
    .order("prompt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const promptNumber = Number(data?.prompt_number ?? 0) + 1;
  const displayOrder = Math.max(Number(data?.display_order ?? 0) + 1, promptNumber);
  return { promptNumber, displayOrder };
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    return NextResponse.json({
      prompts: await listCouplesPosingPrompts("photographer"),
    });
  } catch (error) {
    return jsonError(error, "Failed to load couples prompts.");
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const validation = validateCouplesPromptInput(
      await req.json() as Record<string, unknown>,
    );
    if (!validation.ok) throw new Error(validation.error);

    const { promptNumber, displayOrder } = await getNextNumbers();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(COUPLES_PROMPTS_TABLE)
      .insert({
        ...validation.data,
        prompt_number: promptNumber,
        display_order: validation.data.display_order || displayOrder,
        slug: `${createCouplesPromptSlug(validation.data.title)}-${promptNumber}`,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ prompt: normalizeCouplesPromptRow(data) }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to add couples prompt.", 400);
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = await req.json() as {
      id?: unknown;
      updates?: Record<string, unknown>;
    };
    if (typeof body.id !== "string") throw new Error("Prompt ID is required.");

    const supabase = createSupabaseAdminClient();
    const { data: current, error: readError } = await supabase
      .from(COUPLES_PROMPTS_TABLE)
      .select("*")
      .eq("id", body.id)
      .single();
    if (readError) throw readError;

    const validation = validateCouplesPromptInput({
      ...current,
      ...(body.updates ?? {}),
    });
    if (!validation.ok) throw new Error(validation.error);

    const { data, error } = await supabase
      .from(COUPLES_PROMPTS_TABLE)
      .update(validation.data)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ prompt: normalizeCouplesPromptRow(data) });
  } catch (error) {
    return jsonError(error, "Failed to update couples prompt.", 400);
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = await req.json() as { id?: unknown };
    if (typeof body.id !== "string") throw new Error("Prompt ID is required.");

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from(COUPLES_PROMPTS_TABLE)
      .delete()
      .eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    return jsonError(error, "Failed to delete couples prompt.", 400);
  }
}
