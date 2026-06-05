// POST /api/admin/revalidate
//
// Invalidates the cached public marketing pages (homepage, portfolio, blog,
// pricing) so admin content edits appear immediately instead of waiting for the
// hourly ISR window. Admin save handlers call this after a successful mutation.

import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  // Layout-level revalidation of the root invalidates all cached pages and data
  // on their next visit — simpler and route-group-safe vs. enumerating paths.
  revalidatePath("/", "layout");

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
