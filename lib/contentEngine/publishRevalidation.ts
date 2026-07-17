// Targeted revalidation map (spec §9.1 Step C): published content invalidates
// exactly the routes it appears on. Hourly ISR is the backstop; Step-C
// failures are recoverable tasks, never a reason to unpublish.
export function pathsForPublishedItem(contentType: string, payload: Record<string, unknown>): string[] {
  switch (contentType) {
    case "journal_post":
      return ["/blog", `/blog/${payload.slug as string}`];
    case "portfolio_pick":
      return payload.featured === true ? ["/portfolio", "/"] : ["/portfolio"];
    case "school_page_photo":
      return [`/grads/${payload.school_slug as string}`];
    case "guide_photo": {
      if (payload.guide === "grad") return ["/grad-guide/campus-spots"];
      const hub = payload.guide === "family" ? "family-guide"
        : payload.guide === "portrait" ? "portrait-guide" : "couples-guide";
      return [`/${hub}/locations/${payload.location_key as string}`];
    }
    default:
      return [];
  }
}
