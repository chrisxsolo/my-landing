// Refreshes every cached public page and data read (route handlers only).
// Same effect as POST /api/admin/revalidate, for routes whose writes change
// what public pages show — e.g. a session's school decides which /grads page
// its photos appear on (lib/pagePhotos).
import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_CONTENT_CACHE_TAG } from "@/lib/publicContentCache";

export function revalidatePublicContent(): void {
  try {
    revalidateTag(PUBLIC_CONTENT_CACHE_TAG, { expire: 0 });
    revalidatePath("/", "layout");
  } catch (err) {
    // The write itself succeeded; the hourly ISR window is the backstop.
    console.error("[revalidate] public content refresh failed", err);
  }
}
