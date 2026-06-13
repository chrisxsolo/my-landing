// Full-funnel attribution builder. Joins visitor_sessions → inquiries
// (anonymous_session_id) → payments (inquiry_id), plus content_events for the
// funnel-depth metrics, and produces every "what created the money" report.
//
// Pure and framework-free: the API route fetches rows, this turns them into a
// report, and the tab renders it.

import { detectSchoolKey, schoolLabel } from "@/lib/revenue/schools";
import { classifyChannel, inferSource, isInstagramSource } from "./channels";
import type {
  AttributionReport, Confidence, DimensionRow, FunnelEventLite,
  InquiryLite, PaymentLite, SourceRow, VisitorSessionRow,
} from "./types";

const DAY_MS = 86_400_000;
const BLOG_PATH = /^\/blog\/(?!category(\/|$))[a-z0-9-]+$/;

function isActiveRevenue(p: PaymentLite): boolean {
  return p.status === "active" && p.amount_cents > 0;
}

// Per-inquiry enrichment: source + confidence + revenue + key dates.
interface EnrichedInquiry {
  id: number;
  confidence: Confidence;
  sourceKey: string;
  sourceLabel: string;
  landingPage: string | null;
  utmCampaign: string | null;
  isInstagram: boolean;
  schoolKey: string;
  firstSeenAt: string | null;
  firstPaidAt: string | null;
  revenueCents: number;
  booked: boolean;
}

function enrichInquiry(
  inq: InquiryLite,
  session: VisitorSessionRow | null,
  revenueCents: number,
  firstPaidAt: string | null,
): EnrichedInquiry {
  let confidence: Confidence;
  let sourceKey: string;
  let sourceLabel: string;

  if (session) {
    const ch = classifyChannel(session);
    confidence = "tracked";
    sourceKey = ch.key;
    sourceLabel = ch.label;
  } else {
    const guess = inferSource(inq.message);
    if (guess) {
      confidence = "inferred";
      sourceKey = guess.key;
      sourceLabel = guess.label;
    } else {
      confidence = "none";
      sourceKey = "unattributed";
      sourceLabel = "Unattributed (pre-tracking)";
    }
  }

  return {
    id: inq.id,
    confidence,
    sourceKey,
    sourceLabel,
    landingPage: session?.landing_page ?? null,
    utmCampaign: session?.utm_campaign ?? null,
    isInstagram: session ? isInstagramSource(session) : false,
    schoolKey: detectSchoolKey(inq),
    firstSeenAt: session?.first_seen_at ?? null,
    firstPaidAt,
    revenueCents,
    booked: revenueCents > 0 || inq.payment_status === "paid",
  };
}

function sortByRevenue<T extends { revenueCents: number; inquiries: number }>(rows: T[]): T[] {
  return rows.sort((a, b) => b.revenueCents - a.revenueCents || b.inquiries - a.inquiries);
}

// Accumulate inquiries/booked/revenue into keyed dimension rows.
function dimension(
  enriched: EnrichedInquiry[],
  keyOf: (e: EnrichedInquiry) => string | null,
  labelOf: (key: string) => string,
): DimensionRow[] {
  const map = new Map<string, DimensionRow>();
  for (const e of enriched) {
    const key = keyOf(e);
    if (key == null) continue;
    const row = map.get(key) ?? { key, label: labelOf(key), inquiries: 0, booked: 0, revenueCents: 0 };
    row.inquiries += 1;
    if (e.booked) row.booked += 1;
    row.revenueCents += e.revenueCents;
    map.set(key, row);
  }
  return sortByRevenue([...map.values()]);
}

export function buildAttributionReport(input: {
  inquiries: InquiryLite[];
  payments: PaymentLite[];
  sessions: VisitorSessionRow[];
  events: FunnelEventLite[];
}): AttributionReport {
  const { inquiries, payments, sessions, events } = input;
  const sessionById = new Map(sessions.map((s) => [s.anonymous_session_id, s]));

  // Revenue + earliest payment date, grouped by inquiry.
  const revenueByInquiry = new Map<number, number>();
  const firstPaidByInquiry = new Map<number, string>();
  let totalRevenueCents = 0;
  for (const p of payments) {
    if (!isActiveRevenue(p)) continue;
    totalRevenueCents += p.amount_cents;
    if (p.inquiry_id == null) continue;
    revenueByInquiry.set(p.inquiry_id, (revenueByInquiry.get(p.inquiry_id) ?? 0) + p.amount_cents);
    const prev = firstPaidByInquiry.get(p.inquiry_id);
    if (p.paid_at && (!prev || p.paid_at < prev)) firstPaidByInquiry.set(p.inquiry_id, p.paid_at);
  }

  const enriched = inquiries.map((inq) =>
    enrichInquiry(
      inq,
      inq.anonymous_session_id ? sessionById.get(inq.anonymous_session_id) ?? null : null,
      revenueByInquiry.get(inq.id) ?? 0,
      firstPaidByInquiry.get(inq.id) ?? null,
    ),
  );

  // ── by source (inquiries + booking rate + revenue), split by confidence ─────
  const sourceMap = new Map<string, SourceRow>();
  for (const e of enriched) {
    const key = `${e.confidence}:${e.sourceKey}`;
    const label = e.confidence === "inferred" ? `${e.sourceLabel} (inferred)` : e.sourceLabel;
    const row = sourceMap.get(key)
      ?? { key, label, confidence: e.confidence, inquiries: 0, booked: 0, bookingRate: 0, revenueCents: 0 };
    row.inquiries += 1;
    if (e.booked) row.booked += 1;
    row.revenueCents += e.revenueCents;
    sourceMap.set(key, row);
  }
  const bySource = [...sourceMap.values()]
    .map((r) => ({ ...r, bookingRate: r.inquiries ? r.booked / r.inquiries : 0 }))
    .sort((a, b) => b.revenueCents - a.revenueCents || b.inquiries - a.inquiries);

  // ── revenue by landing page / school / blog post / IG campaign ──────────────
  const byLandingPage = dimension(enriched, (e) => e.landingPage, (k) => k);
  const bySchool = dimension(enriched, (e) => e.schoolKey, (k) => schoolLabel(k));
  const byBlogPost = byLandingPage.filter((r) => BLOG_PATH.test(r.key));
  const byInstagramCampaign = dimension(
    enriched,
    (e) => (e.isInstagram && e.utmCampaign ? e.utmCampaign : null),
    (k) => k,
  );

  // ── average days from first visit to (first) payment ────────────────────────
  const dayGaps: number[] = [];
  for (const e of enriched) {
    if (!e.firstSeenAt || !e.firstPaidAt) continue;
    const gap = (new Date(e.firstPaidAt).getTime() - new Date(e.firstSeenAt).getTime()) / DAY_MS;
    if (gap >= 0) dayGaps.push(gap);
  }
  const avgDaysFirstVisitToPayment = dayGaps.length
    ? dayGaps.reduce((a, b) => a + b, 0) / dayGaps.length
    : null;

  // ── pages viewed before an inquiry (per tracked inquiry, avg) ───────────────
  const pageViewsBySession = new Map<string, string[]>(); // session → page_view timestamps
  const completionSessions = new Set<string>();
  const submitSessions = new Set<string>();
  for (const ev of events) {
    if (!ev.anonymous_session_id) continue;
    if (ev.event_type === "page_view") {
      const list = pageViewsBySession.get(ev.anonymous_session_id) ?? [];
      list.push(ev.viewed_at);
      pageViewsBySession.set(ev.anonymous_session_id, list);
    } else if (ev.event_type === "estimator_complete") {
      completionSessions.add(ev.anonymous_session_id);
    } else if (ev.event_type === "inquiry_submit") {
      submitSessions.add(ev.anonymous_session_id);
    }
  }
  const pageCounts: number[] = [];
  for (const inq of inquiries) {
    const sid = inq.anonymous_session_id;
    if (!sid) continue;
    const views = pageViewsBySession.get(sid);
    if (!views) continue;
    const before = views.filter((t) => t <= inq.created_at).length;
    pageCounts.push(before);
  }
  const pagesViewedBeforeInquiry = pageCounts.length
    ? pageCounts.reduce((a, b) => a + b, 0) / pageCounts.length
    : null;

  // ── estimator completion → inquiry conversion ───────────────────────────────
  let convertedToInquiry = 0;
  for (const sid of completionSessions) if (submitSessions.has(sid)) convertedToInquiry += 1;
  const estimatorCompletions = completionSessions.size;

  // ── totals ──────────────────────────────────────────────────────────────────
  const tracked = enriched.filter((e) => e.confidence === "tracked").length;
  const inferred = enriched.filter((e) => e.confidence === "inferred").length;
  const unattributed = enriched.filter((e) => e.confidence === "none").length;
  const attributedRevenueCents = enriched
    .filter((e) => e.confidence !== "none")
    .reduce((sum, e) => sum + e.revenueCents, 0);

  return {
    totals: {
      inquiries: enriched.length,
      tracked,
      inferred,
      unattributed,
      bookedInquiries: enriched.filter((e) => e.booked).length,
      attributedRevenueCents,
      unattributedRevenueCents: totalRevenueCents - attributedRevenueCents,
      totalRevenueCents,
    },
    bySource,
    byLandingPage,
    bySchool,
    byBlogPost,
    byInstagramCampaign,
    avgDaysFirstVisitToPayment,
    pagesViewedBeforeInquiry,
    estimatorToInquiry: {
      estimatorCompletions,
      convertedToInquiry,
      rate: estimatorCompletions ? convertedToInquiry / estimatorCompletions : null,
    },
  };
}
