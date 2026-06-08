import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  COUPLES_POSING_PROMPTS,
  COUPLES_PROMPTS_TABLE,
  normalizeCouplesPromptRow,
  type AdminCouplesPosingPrompt,
  type CouplesGuideMode,
} from "@/lib/couplesPosingGuide";

function defaultPrompts(): AdminCouplesPosingPrompt[] {
  const timestamp = new Date(0).toISOString();
  return COUPLES_POSING_PROMPTS.map((prompt) => ({
    ...prompt,
    id: `default-${prompt.number}`,
    display_order: prompt.number,
    is_published: true,
    created_at: timestamp,
    updated_at: timestamp,
  }));
}

export async function listCouplesPosingPrompts(
  mode: CouplesGuideMode,
  allowFallback = false,
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from(COUPLES_PROMPTS_TABLE)
    .select("*")
    .order("display_order", { ascending: true })
    .order("prompt_number", { ascending: true });

  if (mode !== "photographer") query = query.eq("is_published", true);

  const { data, error } = await query.returns<
    Array<Omit<AdminCouplesPosingPrompt, "number"> & { prompt_number: number }>
  >();
  if (error) {
    if (allowFallback && error.code === "PGRST205") return defaultPrompts();
    throw error;
  }
  return (data ?? []).map(normalizeCouplesPromptRow);
}
