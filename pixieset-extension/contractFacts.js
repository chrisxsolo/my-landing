// SoloXSnaps → PixiSet Autofill: the flat facts /api/extension/detect-date
// returns, as the contract preview reads them when the API sends no resolved
// draft (see contractResolved.js).

function detectedTotal(d) {
  return d.total_fee != null && Number.isFinite(Number(d.total_fee)) ? Number(d.total_fee) : null;
}

const PACKAGE_MIN_MINUTES = 15;
const PACKAGE_MAX_MINUTES = 480;
const UNREAD_EMAIL_STATUSES = ["unavailable", "partial", "unparsed"];

// The package the thread settled, checked: a chosen length, a choice still
// open in email, or null when the payload says nothing about one. A
// "selected" with no usable length is an open choice, as on the server:
// it is never priced and never read as "nothing was chosen".
function normalizeEmailPackage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const usable = Number.isInteger(raw.minutes) && raw.minutes >= PACKAGE_MIN_MINUTES && raw.minutes <= PACKAGE_MAX_MINUTES;
  if (raw.status === "selected" && usable) return { status: "selected", minutes: raw.minutes };
  return ["selected", "conflicting", "unclear"].includes(raw.status) ? { status: "open", minutes: null } : null;
}

// Whether the payload says the thread was not read in full.
function emailNotFullyRead(d) {
  return UNREAD_EMAIL_STATUSES.includes(d && d.email_status);
}

// The inquiry plus what /api/extension/detect-date settled. Every field the
// payload lacks keeps the inquiry's own value, so an older API response (no
// Rush preview charge, no total kind) prices exactly as before. The shoot
// location from the thread stays separate from the school.
function enrichInquiryFromFacts(inq, d = {}) {
  // A yearless date on the form means the first such day after the form was sent, not after today.
  const submitted = inq.created_at && !Number.isNaN(Date.parse(inq.created_at)) ? businessDate(new Date(inq.created_at)) : undefined;
  return {
    ...inq,
    _sessionDate: formatSessionDate(d.date) || (d.readable && (formatSessionDate(d.readable) || d.readable))
      || formatSessionDate(inq.date_in_mind, submitted) || inq.date_in_mind || "TBD",
    _sessionTime: d.time || "TBD",
    _location: d.location || "",
    _serviceType: d.session_type || null,
    _agreedTotal: detectedTotal(d),
    _totalKind: typeof d.total_kind === "string" ? d.total_kind : null,
    _rushPreview: normalizeRushPreviewCharge(d.rush_preview_charge),
    _emailPackage: normalizeEmailPackage(d.package),
    _emailUnread: emailNotFullyRead(d),
  };
}

// Where the facts stand. Low confidence is not "the form": a thread that was
// read says so, and one that could not be read is never passed off as silence.
function detectedConfidenceLabel(d) {
  if (emailNotFullyRead(d)) return "⚠ Email thread not fully read";
  if (d.confidence === "high") return "✓ Confirmed in email";
  if (d.confidence === "medium") return "~ Likely from email";
  return d.source === "email" ? "~ From email, not confirmed" : "~ From inquiry form";
}

// One line under the title: how sure the thread is, the service, the figure it wrote and any add-on.
function detectedStatusLine(d) {
  const bits = [detectedConfidenceLabel(d)];
  if (d.session_type) bits.push(SERVICE_LABELS[d.session_type] || d.session_type);
  const total = detectedTotal(d);
  if (total != null) bits.push(`$${total} ${d.total_kind === "agreed_total" ? "agreed" : "quoted"} in email`);
  const rush = normalizeRushPreviewCharge(d.rush_preview_charge);
  if (rush && rush.kind === "add") bits.push(`${rush.label} +${fmt(rush.amountCents / 100)}`);
  return bits.join(" · ");
}

