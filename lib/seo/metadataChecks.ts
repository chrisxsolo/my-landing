// Review-time warnings for a page's search title and description. Google has
// no fixed length limits and rewrites both freely, so nothing here blocks a
// save: the point is to catch a blank field, a placeholder-short one, or copy
// so long that the snippet will certainly be cut, while leaving legitimately
// long titles alone.

export const TITLE_SHORT_BELOW = 20;
export const TITLE_LONG_ABOVE = 70;
export const DESCRIPTION_SHORT_BELOW = 70;
export const DESCRIPTION_LONG_ABOVE = 170;

export type MetadataDraft = { title?: string | null; description?: string | null };

export function metadataWarnings({ title, description }: MetadataDraft): string[] {
  const warnings: string[] = [];
  const titleText = (title ?? "").trim();
  const descriptionText = (description ?? "").trim();

  if (!titleText) warnings.push("Title is blank.");
  else if (titleText.length < TITLE_SHORT_BELOW) warnings.push(`Title is very short (${titleText.length} characters); say what and where.`);
  else if (titleText.length > TITLE_LONG_ABOVE) warnings.push(`Title is long (${titleText.length} characters); search results may cut it off.`);

  if (!descriptionText) warnings.push("Meta description is blank; the post body will be used as the snippet.");
  else if (descriptionText.length < DESCRIPTION_SHORT_BELOW) warnings.push(`Meta description is very short (${descriptionText.length} characters).`);
  else if (descriptionText.length > DESCRIPTION_LONG_ABOVE) warnings.push(`Meta description is long (${descriptionText.length} characters); search results may cut it off.`);

  return warnings;
}
