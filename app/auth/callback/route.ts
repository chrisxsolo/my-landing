import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSafeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

// Supabase OAuth lands here after Google sign-in.
// The supabase-js client handles the token from the URL hash automatically.
// We just redirect to the intended destination.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = getSafeNext(searchParams.get("next"));
  return NextResponse.redirect(`${origin}${next}`);
}
