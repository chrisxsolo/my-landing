// "Skip failed content type" (spec §8.2): marks a FAILED type 'skipped' via the
// record RPC (which allows skipped-from-failed) so the package can reach ready.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function skipFailedType(args: {
  client: SupabaseClient; packageId: string; contentType: string;
}): Promise<{ packageStatus: string }> {
  const { data, error } = await args.client.rpc("record_generation_result", {
    p_package_id: args.packageId,
    p_content_type: args.contentType,
    p_outcome: "skipped",
    p_error: null,
    p_usage: null,
  });
  if (error) throw new Error(error.message);
  return { packageStatus: data as string };
}
