// Takedown of one published item (spec §7.3): removes or deactivates the live
// record, preserves publication history (item stays 'published' with
// published_ref.taken_down_at), deletes derivatives only per the
// shared-derivative rule (§4.3), and revalidates affected routes. Private
// sources are never touched.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_DERIVATIVES_BUCKET, photoIdsFromPayload } from "@/lib/contentEngine/derivatives";
import { countLiveReferences } from "@/lib/contentEngine/derivativeRefs";
import { pathsForPublishedItem } from "@/lib/contentEngine/publishRevalidation";

export class TakedownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TakedownError";
  }
}

export interface TakedownArgs {
  client: SupabaseClient;
  itemId: string;
  revalidate: (path: string) => void;
}

export interface TakedownResult {
  removed: boolean;
  derivativesDeleted: string[];
  revalidated: string[];
}

async function removeLiveRecord(client: SupabaseClient, targetType: string, targetId: string | null) {
  if (!targetId && targetType !== "none") throw new TakedownError("published target id missing");
  switch (targetType) {
    case "blog_post": {
      const id = Number(targetId);
      if (Number.isNaN(id)) throw new TakedownError(`published target id is not numeric: ${targetId}`);
      await client.from("image_library").delete().eq("source_post_id", id);
      await client.from("blog_posts").delete().eq("id", id);
      return;
    }
    case "portfolio_image": {
      const id = Number(targetId);
      if (Number.isNaN(id)) throw new TakedownError(`published target id is not numeric: ${targetId}`);
      await client.from("portfolio_images").delete().eq("id", id);
      return;
    }
    case "school_page_photo":
      await client.from("school_page_photos").update({ active: false }).eq("id", targetId);
      return;
    case "family_location_photo":
      await client.from("family_location_photos").update({ published: false }).eq("id", targetId);
      return;
    case "couples_location_photo":
      await client.from("couples_location_photos").update({ published: false }).eq("id", targetId);
      return;
    case "testimonial":
      await client.from("testimonials").update({ photography_session_id: null }).eq("id", targetId);
      return;
    case "none":
      return; // nothing live to remove
    default:
      throw new TakedownError(`unsupported published target type: ${targetType}`);
  }
}

export async function takedownPublishedItem(args: TakedownArgs): Promise<TakedownResult> {
  const { client, itemId, revalidate } = args;

  const { data: item, error } = await client.from("session_content_items")
    .select("id,content_type,status,payload,published_target_type,published_target_id,published_ref")
    .eq("id", itemId).maybeSingle();
  if (error || !item) throw new TakedownError(`content item not found: ${error?.message ?? itemId}`);
  if (item.status !== "published") throw new TakedownError(`item is not published (status=${item.status})`);
  if ((item.published_ref as Record<string, unknown> | null)?.taken_down_at) {
    throw new TakedownError("item is already taken down");
  }

  await removeLiveRecord(client, item.published_target_type as string, item.published_target_id as string | null);

  // shared-derivative rule (§4.3): delete only when zero live references remain
  const photoIds = photoIdsFromPayload(item.content_type, item.payload as Record<string, unknown>);
  const derivativesDeleted: string[] = [];
  if (photoIds.length > 0) {
    const { data: photos } = await client.from("session_photos")
      .select("id,public_derivative_url,public_derivative_storage_path").in("id", photoIds);
    for (const photo of photos ?? []) {
      if (!photo.public_derivative_url) continue;
      const refs = await countLiveReferences(client, photo);
      if (refs.total === 0) {
        const { error: rmErr } = await client.storage.from(PUBLIC_DERIVATIVES_BUCKET)
          .remove([photo.public_derivative_storage_path as string]);
        if (rmErr) console.error(`derivative removal failed for ${photo.id}:`, rmErr.message);
        await client.from("session_photos").update({
          public_derivative_url: null,
          public_derivative_storage_path: null,
          public_derivative_content_hash: null,
          public_derivative_created_at: null,
        }).eq("id", photo.id);
        derivativesDeleted.push(photo.id);
      }
    }
  }

  // preserve history: stays 'published', marked taken down
  const ref = { ...((item.published_ref as Record<string, unknown>) ?? {}), taken_down_at: new Date().toISOString() };
  await client.from("session_content_items").update({ published_ref: ref }).eq("id", itemId);

  const paths = pathsForPublishedItem(item.content_type, item.payload as Record<string, unknown>);
  const revalidated: string[] = [];
  for (const path of paths) {
    try {
      revalidate(path);
      revalidated.push(path);
    } catch (err) {
      console.error(`takedown revalidation failed for ${path}`, err);
    }
  }

  return { removed: true, derivativesDeleted, revalidated };
}
