// Server-only: whether the family journal archive has anything to show. The
// archive page (/blog/category/family-photography) renders noindex while it is
// empty, so public family pages link to it only once this returns true. Uses
// the same post set the archive itself renders.
import { getJournalPostsForCategory } from "@/lib/blog/categoryPosts";
import { FAMILY_JOURNAL_CATEGORY } from "@/lib/familyGuide/journal";

export async function familyJournalHasPosts(): Promise<boolean> {
  try {
    return (await getJournalPostsForCategory(FAMILY_JOURNAL_CATEGORY)).length > 0;
  } catch (err) {
    console.error("[family-guide] could not count journal posts; hiding the journal link", err);
    return false;
  }
}
