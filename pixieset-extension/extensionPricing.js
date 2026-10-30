// SoloXSnaps → PixiSet Autofill: contract pricing, school names and date
// formatting. Contract previews still price in the browser; invoices are
// priced by /api/extension/invoice-draft and never by this file.

// ── SCHOOL NAME EXPANSION ─────────────────────────────────────────────────────
const SCHOOL_FULL_NAMES = {
  "uc-berkeley":  "UC Berkeley",
  "sjsu":         "San Jose State University",
  "sf-state":     "San Francisco State University",
  "usf":          "University of San Francisco",
  "csueb":        "California State University, East Bay",
  "santa-clara":  "Santa Clara University",
  "stanford":     "Stanford University",
};

function detectSchoolKey(schoolText = "") {
  const s = schoolText.toLowerCase();
  if (s.includes("berkeley"))                          return "uc-berkeley";
  if (s.includes("san jose") || s.includes("sjsu"))   return "sjsu";
  if (s.includes("sf state") || s.includes("san francisco state")) return "sf-state";
  if (s.includes("usf") || s.includes("university of san francisco")) return "usf";
  if (s.includes("east bay") || s.includes("csueb"))  return "csueb";
  if (s.includes("santa clara"))                       return "santa-clara";
  if (s.includes("stanford") || s.includes("palo alto")) return "stanford";
  return null;
}

function expandSchoolName(schoolText = "") {
  const key = detectSchoolKey(schoolText);
  return key ? SCHOOL_FULL_NAMES[key] ?? schoolText : schoolText;
}

// ── DATE FORMATTING ──────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// "July 24th" / "7/24" / "2026-07-24" → "July 24th, 2026".
// Missing year resolves to the next occurrence of that month+day.
// Returns null when the text isn't a parseable date (e.g. "sometime this week").
function formatSessionDate(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  let year = null, month = null, day = null;

  const iso   = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(text);
  const named = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/.exec(text);

  if (iso) {
    year = +iso[1]; month = +iso[2]; day = +iso[3];
  } else if (slash) {
    month = +slash[1]; day = +slash[2];
    year = slash[3] ? (+slash[3] < 100 ? 2000 + +slash[3] : +slash[3]) : null;
  } else if (named) {
    const idx = MONTH_NAMES.findIndex(m => m.toLowerCase().startsWith(named[1].toLowerCase()));
    if (idx >= 0) {
      month = idx + 1; day = +named[2];
      year = named[3] ? +named[3] : null;
    }
  }

  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;

  if (year == null) {
    const now = new Date();
    year = now.getFullYear();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (new Date(year, month - 1, day) < today) year += 1;
  }
  return `${MONTH_NAMES[month - 1]} ${ordinal(day)}, ${year}`;
}

// ── PRICING (mirrors lib/pricingCatalog.ts) ──────────────────────────────────
const GRAD_HOURLY_RATE = 350;
const GROUP_RATES = { 2: 300, 3: 275, 4: 250, 5: 225 };
const GROUP_RATE_6_PLUS = 200;
// Travel = round-trip miles x $0.70 rounded up to $5, plus tolls, with that
// total rounded to the nearest $5, or the business-approved fee where one
// exists (lib/travelFee.ts, SJSU = $75).
// tests/unit/travelFee.test.ts fails if these drift from the site.
const TRAVEL_FEES = {
  "sf-state": 0, "usf": 0, "sf-other": 0,
  "uc-berkeley": 45, "csueb": 65, "sjsu": 75, "santa-clara": 65, "stanford": 50,
};

// Flat per-session rates for non-graduation services
const SERVICE_FLAT_RATES = {
  "family":          350, // Family Session (30 min)
  "extended-family": 500, // Extended Family Session (60 min)
  "couples":         450, // 1-Hour Couples Session
  "engagement":      650,
  "proposal":        750,
  "elopement":       950, // Elopement & Courthouse Ceremony, 2-hour base. A
                          // floor Chris edits when the coverage runs longer.
  "maternity":       500, // Maternity Session (60 min, partner + kids included)
};

const SERVICE_LABELS = {
  "family":          "Family Session",
  "extended-family": "Extended Family Session",
  "couples":         "Couples Session",
  "engagement":      "Engagement Session",
  "proposal":        "Proposal Session",
  "elopement":       "Elopement & Courthouse Ceremony",
  "maternity":       "Maternity Session",
  "graduation":      "Graduation Session",
};

function detectServiceType(inq) {
  // Email-detected type wins if it's one we price
  const fromEmail = String(inq._serviceType || "").toLowerCase();
  if (SERVICE_FLAT_RATES[fromEmail] != null || fromEmail === "graduation") return fromEmail;

  const t = `${inq.session_type || ""} ${inq.message || ""}`.toLowerCase().replace(/-/g, " ");
  if (t.includes("elope") || t.includes("courthouse")) return "elopement";
  // Before couples and family: partner and kids are part of the maternity package.
  if (t.includes("matern"))          return "maternity";
  if (t.includes("proposal"))        return "proposal";
  if (t.includes("engagement"))      return "engagement";
  if (t.includes("couple") || t.includes("anniversary")) return "couples";
  if (t.includes("extended family")) return "extended-family";
  if (t.includes("family"))          return "family";
  return "graduation";
}

function calcPrice(inquiry) {
  const service = detectServiceType(inquiry);
  const people = parseInt(inquiry.people || "1") || 1;
  let sessionBase, travelFee = null, schoolKey = null;

  if (SERVICE_FLAT_RATES[service] != null) {
    sessionBase = SERVICE_FLAT_RATES[service];
  } else {
    sessionBase = people <= 1
      ? GRAD_HOURLY_RATE
      : (GROUP_RATES[people] ?? GROUP_RATE_6_PLUS) * people;
    // The thread's shoot location (kept apart from the school) decides first.
    schoolKey = detectSchoolKey(inquiry._location || inquiry.school || inquiry.message || "");
    if (schoolKey != null && TRAVEL_FEES[schoolKey] != null) travelFee = TRAVEL_FEES[schoolKey];
  }

  // A price quoted/agreed in the email thread overrides the calculator
  const agreed = Number.isFinite(inquiry._agreedTotal) ? inquiry._agreedTotal : null;
  if (agreed != null) { sessionBase = agreed; travelFee = null; }
  const subtotal = sessionBase + (travelFee ?? 0);
  const deposit  = subtotal / 2;

  return {
    sessionBase, travelFee,
    subtotal, deposit, remaining: subtotal - deposit,
    people, schoolKey, service, priceFromEmail: agreed != null,
  };
}

function fmt(n) { return `$${Number(n).toFixed(2)}`; }
