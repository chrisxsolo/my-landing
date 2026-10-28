// Multi-select for the review queue. Pure.
//
// Cards are selected by queue-item id (one photo can produce several cards:
// its university and its location, say), then the selection is turned into
// unique photo keys for a write. Only cards that stand for an editable photo
// take part: never a session or place finding, never an "excluded but still
// live" placement card. A selection can be approved in one go only when every
// selected card carries exactly one answer and those answers amount to the
// same change — same field, same value and, for a location, the same
// evidence — so nothing ambiguous, disputed or differently valued is ever
// folded into one approval. The change itself is built the same way a single
// card's Approve builds it (suggestionChanges), so evidence and session scope
// never diverge between the two paths.
import { isPhotoItem, type QueueItem } from "@/lib/photoTagging/reviewQueue";
import { evidenceOf, type TagChanges, type TagSuggestion } from "@/lib/photoTagging/types";

/** A card whose photo's tags can be edited in place (and so batch-edited). */
export function isBatchEditable(item: Pick<QueueItem, "key" | "kind">): boolean {
  return isPhotoItem(item) && item.kind !== "excluded-live";
}

/** The selected cards, in queue order; ids that no longer match a shown eligible card are dropped. */
export function selectedItems(shown: readonly QueueItem[], selected: ReadonlySet<string>): QueueItem[] {
  return shown.filter((i) => selected.has(i.id) && isBatchEditable(i));
}

/**
 * The selection with every id that disappeared (approved, dismissed, filtered
 * out) removed. Returns the SAME set when nothing changed, so a state update
 * with it is a no-op.
 */
export function pruneSelection(selected: ReadonlySet<string>, shown: readonly QueueItem[]): ReadonlySet<string> {
  const live = new Set(selectedItems(shown, selected).map((i) => i.id));
  return live.size === selected.size ? selected : live;
}

/** Unique photo keys behind a set of cards. */
export function uniqueKeys(items: readonly QueueItem[]): string[] {
  return [...new Set(items.map((i) => i.key))];
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** "4 photos selected", or "4 cards selected · 3 photos" when several cards share a photo. */
export function selectionSummary(items: readonly QueueItem[]): string {
  const photos = uniqueKeys(items).length;
  if (items.length === photos) return `${plural(photos, "photo")} selected`;
  return `${plural(items.length, "card")} selected · ${plural(photos, "photo")}`;
}

/** What accepting a suggestion writes: the field's value, plus the evidence a location rests on. */
export function suggestionChanges(s: TagSuggestion): TagChanges {
  return s.field === "location" ? { location: s.value, evidence: evidenceOf(s.origin) } : { [s.field]: s.value };
}

export type SharedSuggestion =
  | { ok: true; suggestion: TagSuggestion; changes: TagChanges; keys: string[]; label: string }
  | { ok: false; reason: string };

const FIELD_NOUN = { category: "category", school: "university", location: "location", spot: "campus spot" } as const;

function incompatibility(answers: readonly TagSuggestion[]): string | null {
  const fields = [...new Set(answers.map((s) => s.field))];
  if (fields.length > 1) return `The selected cards suggest different fields (${fields.map((f) => FIELD_NOUN[f]).join(", ")}) — approve them separately or use Batch edit.`;
  const values = [...new Set(answers.map((s) => s.value))];
  if (values.length > 1) {
    const labels = [...new Set(answers.map((s) => s.label))];
    return `The selected cards suggest different values (${labels.join(" vs ")}) — approve them separately or use Batch edit.`;
  }
  const evidence = [...new Set(answers.filter((s) => s.field === "location").map((s) => evidenceOf(s.origin)))];
  if (evidence.length > 1) return `The selected location suggestions rest on different evidence (${evidence.join(" vs ")}) — approve them separately.`;
  return null;
}

/** One answer every selected card agrees on, or why there is none. */
export function sharedSuggestion(items: readonly QueueItem[]): SharedSuggestion {
  if (items.length === 0) return { ok: false, reason: "Select at least one card." };
  const none = items.filter((i) => i.options.length === 0).length;
  if (none > 0) return { ok: false, reason: `${plural(none, "selected card")} ${none === 1 ? "has" : "have"} no suggestion — set the value with Batch edit.` };
  const several = items.filter((i) => i.options.length > 1).length;
  if (several > 0) return { ok: false, reason: `${plural(several, "selected card")} ${several === 1 ? "offers" : "offer"} several answers — pick those one by one.` };
  const answers = items.map((i) => i.options[0]);
  const disputed = answers.filter((s) => s.competing).length;
  if (disputed > 0) return { ok: false, reason: `Records disagree on ${plural(disputed, "selected card")} — pick those by hand.` };
  const reason = incompatibility(answers);
  if (reason) return { ok: false, reason };
  const keys = uniqueKeys(items);
  return { ok: true, suggestion: answers[0], changes: suggestionChanges(answers[0]), keys, label: `Review ${answers[0].label} for ${plural(keys.length, "photo")}` };
}
