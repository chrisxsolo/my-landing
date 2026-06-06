import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const PAYMENTS_TABLE = "payments";
const PAYMENT_SELECT = "id,inquiry_id,client_name,client_email,amount,amount_cents,method,payment_type,invoice,note,source,status,paid_at,session_date";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(PAYMENTS_TABLE)
      .select(PAYMENT_SELECT)
      .order("paid_at", { ascending: false })
      .limit(1000);

    if (error) throw error;
    return NextResponse.json({ payments: data ?? [] });
  } catch (err) {
    console.error("[admin/payments] GET failed:", err);
    return NextResponse.json({ error: "Failed to load payments." }, { status: 500 });
  }
}
