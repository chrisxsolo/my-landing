// Human labels for Content Engine item types. Dependency-free so both the admin
// UI (engineTypes re-exports it) and server code (the publishing queue) share one list.
export const CONTENT_TYPE_LABELS: Record<string, string> = {
  journal_post: "Journal post",
  portfolio_pick: "Portfolio pick",
  school_page_photo: "School page photo",
  guide_photo: "Guide photo",
  testimonial_feature: "Testimonial",
  internal_link_suggestion: "Internal links",
  location_guide: "New location guide",
};
