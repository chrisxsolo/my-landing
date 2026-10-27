// One vocabulary for content state across the admin. Stored values differ by
// table (item status, session state, location status, sync status); the badge
// a person reads for the same situation should not. Every chip, tile and badge
// that describes content takes its label and colors from here. Labels only —
// nothing here changes what the database stores.
import { T } from "@/app/admin/adminTheme";

export type ContentStatus = "draft" | "needs_review" | "approved" | "published" | "hidden" | "failed";

export interface ContentStatusMeta { label: string; color: string; bg: string }

export const CONTENT_STATUS: Record<ContentStatus, ContentStatusMeta> = {
  draft:        { label: "Draft",        color: T.amber,   bg: T.amberBg },
  needs_review: { label: "Needs review", color: T.amber,   bg: T.amberBg },
  approved:     { label: "Approved",     color: T.violet,  bg: T.violetBg },
  published:    { label: "Published",    color: T.green,   bg: T.greenBg },
  hidden:       { label: "Hidden",       color: T.inkSoft, bg: T.neutralBg },
  failed:       { label: "Failed",       color: T.red,     bg: T.redBg },
};
