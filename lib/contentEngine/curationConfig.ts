// Curation constants shared by the server service and the admin client.
// Keep this module dependency-free — PhotosSection (a client component)
// imports it, so nothing node-only (crypto, supabase server clients) here.

// How many photos an AI curation pass keeps; everything else gets excluded.
export const TOP_PICK_COUNT = 12;

// Sessions with at least this many included photos auto-curate right after
// analysis finishes — big shoots shouldn't need a second click.
export const AUTO_CURATE_THRESHOLD = 90;
