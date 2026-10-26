// /api/admin/page-photos — the admin Page Photos tab.
//   GET                → every page's counts + photos needing a school
//   GET ?page=<key>    → that page's photos in display order (+ overflow, hidden)
//   POST  { page, imageUrl, action }  → pin / unpin / hide / unhide / hero / unhero / up / down
//   PATCH { portfolioId, school }     → set or clear a portfolio photo's school tag
// requireAdmin + service role. Writes refresh the public pages.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { buildPagePhotoReport, buildPageView } from "@/lib/pagePhotos/adminView";
import { applyCuration, isCurationAction, setPortfolioSchool } from "@/lib/pagePhotos/curationStore";
import { isPageKey } from "@/lib/pagePhotos/pageKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  console.error(`[page-photos] ${fallback}`, err);
  const status = /not found/i.test(message) ? 404 : /must be/i.test(message) ? 422 : 500;
  return NextResponse.json({ error: message }, { status });
}

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const page = req.nextUrl.searchParams.get("page");
  const client = createSupabaseAdminClient();
  try {
    if (!page) return NextResponse.json(await buildPagePhotoReport(client));
    if (!isPageKey(page)) return NextResponse.json({ error: "page must be a page key like grads/sjsu" }, { status: 400 });
    const view = await buildPageView(client, page);
    return view ? NextResponse.json(view) : NextResponse.json({ error: "page not found" }, { status: 404 });
  } catch (err) {
    return fail(err, "could not load page photos");
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  const { page, imageUrl, action } = body;
  if (!isPageKey(page)) return NextResponse.json({ error: "page must be a page key like grads/sjsu" }, { status: 400 });
  if (typeof imageUrl !== "string" || !/^https?:\/\//.test(imageUrl)) {
    return NextResponse.json({ error: "imageUrl must be a photo URL" }, { status: 400 });
  }
  if (!isCurationAction(action)) return NextResponse.json({ error: "unknown action" }, { status: 400 });

  const client = createSupabaseAdminClient();
  try {
    // Only photos this page could actually show may be curated — a pin can
    // reorder eligible photos but never publish anything new.
    const before = await buildPageView(client, page);
    if (!before) return NextResponse.json({ error: "page not found" }, { status: 404 });
    const known = [...before.shown, ...before.overflow, ...before.hidden].some((p) => p.url === imageUrl);
    if (!known) return NextResponse.json({ error: "that photo is not eligible for this page" }, { status: 422 });

    await applyCuration(client, page, imageUrl, action);
    revalidatePublicContent();
    return NextResponse.json(await buildPageView(client, page));
  } catch (err) {
    return fail(err, "could not save page curation");
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  const { portfolioId, school } = body;
  if (typeof portfolioId !== "number" || !Number.isInteger(portfolioId)) {
    return NextResponse.json({ error: "portfolioId must be an integer" }, { status: 400 });
  }
  if (school !== null && typeof school !== "string") {
    return NextResponse.json({ error: "school must be a school slug or null" }, { status: 400 });
  }
  try {
    await setPortfolioSchool(createSupabaseAdminClient(), portfolioId, school);
    revalidatePublicContent();
    return NextResponse.json({ updated: true });
  } catch (err) {
    return fail(err, "could not save the photo's school");
  }
}
