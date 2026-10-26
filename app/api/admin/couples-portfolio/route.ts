// Admin API for the couples portfolio (portfolio_images rows in the "couples"
// category). requireAdmin + service role. Every write revalidates the public
// pages so /portfolio/couples and the couples guide update immediately.
//   GET                          → all couples photos, including unpublished
//   POST { action: "add", rows } → add uploaded photos to the couples portfolio
//   POST { action: "hero", id }  → make one photo the couples hero
//   PATCH { id, updates }        → title / alt / featured / published / session / size
//   PUT { order: number[] }      → reorder every couples photo
//   DELETE ?id=                  → remove a photo from the portfolio

import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { PUBLIC_CONTENT_CACHE_TAG } from "@/lib/publicContentCache";
import { COUPLES_CATEGORY_SLUG } from "@/lib/couplesRoutes";
import {
  COUPLES_PORTFOLIO_COLUMNS,
  planCouplesReorder,
  validateCouplesPortfolioUpdates,
} from "@/lib/couplesPortfolioAdmin";

export const dynamic = "force-dynamic";

const TABLE = "portfolio_images";
const MAX_ADD = 50;

function fail(error: unknown, fallback: string, status = 400) {
  console.error(`[admin/couples-portfolio] ${fallback}`, error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

function refreshPublicPages() {
  revalidateTag(PUBLIC_CONTENT_CACHE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}

function parseId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function listCouples() {
  const { data, error } = await createSupabaseAdminClient()
    .from(TABLE)
    .select(COUPLES_PORTFOLIO_COLUMNS)
    .eq("category_slug", COUPLES_CATEGORY_SLUG)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    return NextResponse.json({ photos: await listCouples() });
  } catch (error) {
    return fail(error, "Failed to load couples photos.", 500);
  }
}

type AddRow = { image_url?: unknown; title?: unknown; alt?: unknown; width?: unknown; height?: unknown; session_label?: unknown };

async function addPhotos(rows: AddRow[], publish: boolean) {
  const supabase = createSupabaseAdminClient();
  const [{ data: category, error: catError }, { data: last, error: lastError }] = await Promise.all([
    supabase.from("portfolio_categories").select("id").eq("slug", COUPLES_CATEGORY_SLUG).maybeSingle(),
    supabase.from(TABLE).select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (catError) throw catError;
  if (lastError) throw lastError;
  const start = Number(last?.sort_order ?? 0) + 1;
  const inserts = rows.map((row, index) => {
    if (typeof row.image_url !== "string" || !row.image_url.startsWith("https://")) {
      throw new Error("Each photo needs an uploaded image URL.");
    }
    const details = validateCouplesPortfolioUpdates({
      title: row.title,
      alt: row.alt ?? row.title,
      session_label: row.session_label,
      ...(row.width && row.height ? { width: row.width, height: row.height } : {}),
    });
    if (!details.ok) throw new Error(details.error);
    return {
      ...details.data,
      image_url: row.image_url,
      category_id: category?.id ?? null,
      category_slug: COUPLES_CATEGORY_SLUG,
      featured: false,
      published: publish,
      sort_order: start + index,
    };
  });
  const { data, error } = await supabase.from(TABLE).insert(inserts).select(COUPLES_PORTFOLIO_COLUMNS);
  if (error) throw error;
  return data ?? [];
}

async function setHero(id: number) {
  const supabase = createSupabaseAdminClient();
  const { data: target, error: readError } = await supabase
    .from(TABLE).select("id").eq("id", id).eq("category_slug", COUPLES_CATEGORY_SLUG).maybeSingle();
  if (readError) throw readError;
  if (!target) throw new Error("That photo isn't in the couples portfolio.");
  const { error: clearError } = await supabase
    .from(TABLE).update({ category_hero: false }).eq("category_slug", COUPLES_CATEGORY_SLUG).eq("category_hero", true);
  if (clearError) throw clearError;
  const { error } = await supabase.from(TABLE).update({ category_hero: true, published: true }).eq("id", id);
  if (error) throw error;
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = (await req.json()) as { action?: unknown; id?: unknown; rows?: unknown; publish?: unknown };
    if (body.action === "hero") {
      const id = parseId(body.id);
      if (!id) throw new Error("A photo id is required.");
      await setHero(id);
    } else if (body.action === "add") {
      if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > MAX_ADD) {
        throw new Error(`Add between 1 and ${MAX_ADD} photos at a time.`);
      }
      await addPhotos(body.rows as AddRow[], body.publish !== false);
    } else {
      throw new Error("Unknown action.");
    }
    refreshPublicPages();
    return NextResponse.json({ photos: await listCouples() });
  } catch (error) {
    return fail(error, "Couples portfolio update failed.");
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = (await req.json()) as { id?: unknown; updates?: unknown };
    const id = parseId(body.id);
    if (!id || typeof body.updates !== "object" || body.updates === null) throw new Error("id and updates are required.");
    const validation = validateCouplesPortfolioUpdates(body.updates as Record<string, unknown>);
    if (!validation.ok) throw new Error(validation.error);
    const { data, error } = await createSupabaseAdminClient()
      .from(TABLE)
      .update(validation.data)
      .eq("id", id)
      .eq("category_slug", COUPLES_CATEGORY_SLUG)
      .select(COUPLES_PORTFOLIO_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    refreshPublicPages();
    return NextResponse.json({ photo: data });
  } catch (error) {
    return fail(error, "Failed to update photo.");
  }
}

export async function PUT(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = (await req.json()) as { order?: unknown };
    if (!Array.isArray(body.order)) throw new Error("order must be a list of photo ids.");
    const orderedIds = body.order.map(parseId);
    if (orderedIds.some((id) => id === null)) throw new Error("order contains an invalid id.");
    const current = await listCouples();
    const plan = planCouplesReorder(current, orderedIds as number[]);
    if (!plan) throw new Error("The photo list changed — reload and try again.");
    const supabase = createSupabaseAdminClient();
    const results = await Promise.all(
      plan
        .filter((step) => current.find((row) => row.id === step.id)?.sort_order !== step.sort_order)
        .map((step) => supabase.from(TABLE).update({ sort_order: step.sort_order }).eq("id", step.id)),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    refreshPublicPages();
    return NextResponse.json({ photos: await listCouples() });
  } catch (error) {
    return fail(error, "Failed to reorder photos.");
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const id = parseId(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "A valid id is required." }, { status: 400 });
  try {
    const { error } = await createSupabaseAdminClient()
      .from(TABLE).delete().eq("id", id).eq("category_slug", COUPLES_CATEGORY_SLUG);
    if (error) throw error;
    refreshPublicPages();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error, "Failed to remove photo.", 500);
  }
}
