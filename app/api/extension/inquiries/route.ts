import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const EXTENSION_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-extension-secret");
  if (!token || token !== EXTENSION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select("id, name, email, phone, school, people, date_in_mind, session_type, message, created_at")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("Extension inquiries fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch inquiries" }, { status: 500 });
  }

  return NextResponse.json(data, {
    headers: {
      "Access-Control-Allow-Origin": "https://studio.pixieset.com",
      "Access-Control-Allow-Headers": "x-extension-secret",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://studio.pixieset.com",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "x-extension-secret",
    },
  });
}
