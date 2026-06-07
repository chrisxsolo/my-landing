import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  COUPLES_INSPIRATION_BUCKET,
  COUPLES_INSPIRATION_TABLE,
  filterInspirationImagesForMode,
  type CouplesGuideMode,
  type CouplesInspirationImage,
} from "@/lib/couplesPosingGuide";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

type InspirationRow = Omit<CouplesInspirationImage, "image_url">;

async function signStoragePath(path: string | null) {
  if (!path) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(COUPLES_INSPIRATION_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("[couples-guide] failed to sign storage path", { path, error });
    return null;
  }
  return data.signedUrl;
}

function toPublicFields(image: CouplesInspirationImage) {
  return {
    id: image.id,
    image_url: image.image_url,
    title: image.title,
    client_notes: image.client_notes,
    creator_name: image.creator_name,
    attribution_text: image.attribution_text,
    external_source_url: image.external_source_url,
    categories: image.categories,
    tags: image.tags,
    related_prompt_number: image.related_prompt_number,
    width: image.width,
    height: image.height,
    alt_text: image.alt_text,
    visibility: image.visibility,
    is_published: image.is_published,
    display_order: image.display_order,
    rights_confirmed: image.rights_confirmed,
  };
}

export async function listCouplesInspirationImages(mode: CouplesGuideMode) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(COUPLES_INSPIRATION_TABLE)
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false })
    .returns<InspirationRow[]>();

  if (error) throw error;

  const allowed = filterInspirationImagesForMode(data ?? [], mode);
  const withUrls: CouplesInspirationImage[] = await Promise.all(
    allowed.map(async (image) => ({
      ...image,
      image_url: image.storage_path
        ? await signStoragePath(image.storage_path)
        : image.external_source_url,
    })),
  );

  if (mode === "photographer") return withUrls;
  return withUrls.map(toPublicFields);
}
