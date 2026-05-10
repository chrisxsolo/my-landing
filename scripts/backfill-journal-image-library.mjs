import { createClient } from "@supabase/supabase-js";
import {
  buildJournalImageLibraryRows,
  filterMissingLibraryRows,
  IMAGE_LIBRARY_SOURCE_TYPES,
} from "../lib/imageLibraryShared.ts";

const BLOG_POSTS_TABLE = "blog_posts";
const IMAGE_LIBRARY_TABLE = "image_library";
const DRY_RUN_FLAG = "--dry-run";

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeExtraImageUrls(value) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const trimmed = item.trim();
    return trimmed ? [trimmed] : [];
  });
}

async function getJournalBlogPosts(supabase) {
  const primaryQuery = await supabase
    .from(BLOG_POSTS_TABLE)
    .select("id,title,slug,cover_image_url,extra_image_urls")
    .contains("sites", [IMAGE_LIBRARY_SOURCE_TYPES.journal])
    .order("published_at", { ascending: false });

  if (!primaryQuery.error) {
    return primaryQuery.data ?? [];
  }

  const fallbackQuery = await supabase
    .from(BLOG_POSTS_TABLE)
    .select("id,title,slug,cover_image_url,extra_image_urls")
    .eq("category", IMAGE_LIBRARY_SOURCE_TYPES.journal)
    .order("published_at", { ascending: false });

  if (fallbackQuery.error) throw fallbackQuery.error;
  return fallbackQuery.data ?? [];
}

async function getExistingLibraryRows(supabase, postIds) {
  if (postIds.length === 0) return [];

  const { data, error } = await supabase
    .from(IMAGE_LIBRARY_TABLE)
    .select("source_post_id,source_role,image_url")
    .in("source_post_id", postIds);

  if (error) throw error;
  return data ?? [];
}

async function main() {
  const dryRun = process.argv.includes(DRY_RUN_FLAG);
  const supabase = getSupabaseAdminClient();
  const posts = await getJournalBlogPosts(supabase);
  const existingRows = await getExistingLibraryRows(
    supabase,
    posts.map((post) => post.id),
  );

  const candidateRows = posts.flatMap((post) =>
    buildJournalImageLibraryRows({
      postId: post.id,
      postSlug: post.slug,
      postTitle: typeof post.title === "string" && post.title.trim() ? post.title.trim() : post.slug,
      coverImageUrl: post.cover_image_url,
      extraImageUrls: normalizeExtraImageUrls(post.extra_image_urls),
    }),
  );

  const rowsToInsert = filterMissingLibraryRows(candidateRows, existingRows);

  if (!dryRun && rowsToInsert.length > 0) {
    const { error } = await supabase.from(IMAGE_LIBRARY_TABLE).insert(rowsToInsert);
    if (error) throw error;
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        scannedPosts: posts.length,
        candidateAssets: candidateRows.length,
        insertedAssets: dryRun ? 0 : rowsToInsert.length,
        missingAssets: rowsToInsert.length,
        skippedAssets: candidateRows.length - rowsToInsert.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[backfill-journal-image-library]", error);
  process.exitCode = 1;
});
