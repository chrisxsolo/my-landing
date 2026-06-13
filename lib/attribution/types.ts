// Shared types for the full-funnel attribution calc layer. Kept framework-free
// so the build logic is unit-testable in isolation (same pattern as lib/revenue).

// How confident we are about an inquiry's source:
//   tracked  — stitched to a real visitor_session (UTM / referrer captured first-party)
//   inferred — no session; source guessed from the message text (labeled, never silent)
//   none     — no session and no textual signal → "Unattributed (pre-tracking)"
export type Confidence = "tracked" | "inferred" | "none";

export interface VisitorSessionRow {
  anonymous_session_id: string;
  landing_page: string | null;
  first_referrer: string | null;
  latest_referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  first_seen_at: string;
}

export interface InquiryLite {
  id: number;
  created_at: string;
  anonymous_session_id: string | null;
  session_type: string | null;
  school: string | null;
  location: string | null;
  message: string;
  email: string;
  payment_status: string | null;
}

export interface PaymentLite {
  inquiry_id: number | null;
  amount_cents: number;
  status: string;
  payment_type: string;
  paid_at: string;
}

export interface FunnelEventLite {
  anonymous_session_id: string | null;
  event_type: string;
  viewed_at: string;
}

// One row of a "by source" breakdown — carries inquiries, booking rate, revenue,
// and the confidence tier so tracked numbers are never silently merged with
// inferred or pre-tracking ones.
export interface SourceRow {
  key: string;
  label: string;
  confidence: Confidence;
  inquiries: number;
  booked: number;
  bookingRate: number; // 0..1
  revenueCents: number;
}

// Generic revenue-by-dimension row (landing page, school, blog post, campaign).
export interface DimensionRow {
  key: string;
  label: string;
  inquiries: number;
  booked: number;
  revenueCents: number;
}

export interface AttributionReport {
  totals: {
    inquiries: number;
    tracked: number;
    inferred: number;
    unattributed: number;
    bookedInquiries: number;
    attributedRevenueCents: number;
    unattributedRevenueCents: number;
    totalRevenueCents: number;
  };
  bySource: SourceRow[];
  byLandingPage: DimensionRow[];
  bySchool: DimensionRow[];
  byBlogPost: DimensionRow[];
  byInstagramCampaign: DimensionRow[];
  avgDaysFirstVisitToPayment: number | null;
  pagesViewedBeforeInquiry: number | null;
  estimatorToInquiry: {
    estimatorCompletions: number;
    convertedToInquiry: number;
    rate: number | null; // 0..1
  };
}
