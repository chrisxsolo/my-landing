// SoloXSnaps → PixiSet Autofill: which inquiry is being invoiced.
//
// Pixieset's invoice flow is two pages: pick a client, then edit the invoice.
// The chosen inquiry is kept in chrome.storage.local across that navigation
// so the second page restores it without another search. Server-confirmed
// totals are cached the same way so the list can show them.

const SELECTION_KEY = "sxsInvoiceSelection";
const DRAFT_TOTALS_KEY = "sxsDraftTotals";
const SELECTION_TTL_MS = 30 * 60 * 1000;

function storageGet(key) {
  return new Promise(resolve => {
    try { chrome.storage.local.get(key, items => resolve(items?.[key] ?? null)); }
    catch (err) { console.error("SoloXSnaps storage read failed", err); resolve(null); }
  });
}

function storageSet(key, value) {
  return new Promise(resolve => {
    try { chrome.storage.local.set({ [key]: value }, () => resolve()); }
    catch (err) { console.error("SoloXSnaps storage write failed", err); resolve(); }
  });
}

/** A stored selection counts only while it is fresh. */
function isSelectionValid(selection, now = Date.now()) {
  return Boolean(selection)
    && Number.isInteger(selection.inquiryId) && selection.inquiryId > 0
    && typeof selection.savedAt === "number"
    && now - selection.savedAt >= 0
    && now - selection.savedAt < SELECTION_TTL_MS;
}

function saveInvoiceSelection(inquiryId, email, now = Date.now()) {
  return storageSet(SELECTION_KEY, { inquiryId: Number(inquiryId), email, savedAt: now });
}

async function loadInvoiceSelection(now = Date.now()) {
  const selection = await storageGet(SELECTION_KEY);
  if (isSelectionValid(selection, now)) return selection;
  if (selection) await clearInvoiceSelection();
  return null;
}

function clearInvoiceSelection() {
  return storageSet(SELECTION_KEY, null);
}

/** Totals the server has confirmed, by inquiry id: { status, totalCents }. */
async function loadDraftTotals() {
  const totals = await storageGet(DRAFT_TOTALS_KEY);
  return totals && typeof totals === "object" ? totals : {};
}

async function rememberDraftTotal(inquiryId, draft) {
  const totals = await loadDraftTotals();
  const next = { ...totals, [String(inquiryId)]: { status: draft.status, totalCents: draft.pricing.totalCents } };
  await storageSet(DRAFT_TOTALS_KEY, next);
  return next;
}

/** What an inquiry row says about price before and after the server has priced it. */
function describeListPrice(cached) {
  if (!cached) return "Open to confirm pricing";
  if (cached.status === "ready" && Number.isInteger(cached.totalCents)) return `${fmtCents(cached.totalCents)} confirmed`;
  return "Pricing needs review";
}

function fmtCents(cents) {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

/**
 * The one Pixieset client suggestion that carries this email. Zero matches or
 * several both return null, and the user picks by hand.
 */
function chooseClientMatch(candidates, email) {
  const wanted = String(email || "").trim().toLowerCase();
  if (!wanted) return null;
  const matches = candidates.filter(c => String(c.text || "").toLowerCase().includes(wanted));
  return matches.length === 1 ? matches[0] : null;
}
