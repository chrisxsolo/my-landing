// The contract preview reads the server's resolution of the booking, the
// same draft the invoice is filled from. These tests load the real content
// scripts into a vm with a small fake DOM and check what is shown and what is
// actually written into the contract body. All data is synthetic.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const extensionRoot = new URL("../pixieset-extension/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", extensionRoot), "utf8"));

function loadContract(parts, edited = {}) {
  const nodes = parts.map(nodeValue => ({ nodeValue, parentElement: { dispatchEvent: () => {} } }));
  const editor = { querySelectorAll: () => [] };
  const document = {
    body: {},
    querySelector: () => editor,
    querySelectorAll: () => Object.entries(edited).map(([key, value]) => ({ dataset: { key }, value })),
    getElementById: () => ({ style: {} }),
    createTreeWalker: () => {
      let index = -1;
      return { nextNode: () => ++index < nodes.length, get currentNode() { return nodes[index]; } };
    },
  };
  const context = vm.createContext({
    document, Event, NodeFilter: { SHOW_TEXT: 4 },
    location: { href: "https://studio.pixieset.com/contracts/test", pathname: "/contracts/test" },
    setTimeout: () => {}, MutationObserver: class { observe() {} },
  });
  for (const file of manifest.content_scripts[0].js) {
    vm.runInContext(readFileSync(new URL(file, extensionRoot), "utf8"), context);
  }
  return { context, text: () => nodes.map(node => node.nodeValue).join("") };
}

const TEMPLATE = [
  'in connection with the portrait session of Graduation (the “Portrait Session”).',
  " Type: [SESSION_TYPE]. Date: [SESSION_DATE] at [SESSION_TIME]; Location: [SESSION_LOCATION].",
  " Total: [TOTAL_FEE]; Retainer: [RETAINER]; Remaining: [REMAINING] due [FINAL_DATE]. Signed on [SESSION_DATE].",
];

// The stale form: one person, the Graduation dropdown, a school.
const inquiry = {
  id: 9101, name: "Jordan Example", email: "jordan@example.test", school: "SF State", people: "1",
  session_type: "Graduation Portrait", message: "Hi, looking to book portraits.", date_in_mind: null, created_at: "2026-11-02T16:55:00Z",
};

const draft = (over = {}) => ({
  status: "review", reviewReasons: ["Harbor Practice Field is outside San Francisco and has no approved travel fee. Confirm the travel fee before filling."],
  warnings: ["The session date is not confirmed in email: November 29th, 2026 was requested and has not been accepted yet. Pixieset's due date is left unchanged."],
  session: {
    serviceKey: "senior-portraits", itemName: "Senior Portraits", people: 8, location: "Harbor Practice Field",
    date: "2026-11-29", dateStatus: "proposed", dateConfidence: "tentative", time: "3:00–4:00 pm", timeDetail: { status: "proposed" },
    ...over.session,
  },
  pricing: { baseCents: 120000, totalCents: 120000, baseConfirmed: true, ...over.pricing },
  ...over.top,
});

// The flat facts every API version sends, here disagreeing with nothing but
// carrying a Rush preview charge the resolved total already contains.
const flat = { date: "2026-11-29", readable: "November 29th, 2026", time: "3:00 PM", location: "Harbor Practice Field", session_type: "senior-portraits", total_fee: 1200, total_kind: "agreed_total", confidence: "medium" };

function open(fixture, payload) {
  Object.assign(fixture.context, { inq: inquiry, d: payload });
  vm.runInContext(`
    var resolved = normalizeResolved(d.resolved);
    var enriched = resolved ? enrichInquiryFromResolved(inq, d, resolved) : enrichInquiryFromFacts(inq, d);
    var price = resolved ? priceFromResolved(resolved) : calcPrice(enriched);
  `, fixture.context);
  return {
    preview: () => vm.runInContext("buildContractPreview(enriched, price)", fixture.context),
    fill: () => vm.runInContext("fillContract(enriched, price)", fixture.context),
    status: () => vm.runInContext("resolved ? resolvedStatusLine(resolved) : detectedStatusLine(d)", fixture.context),
  };
}

test("a requested date is filled in for review: senior portraits, November 29th at 3 pm, $1,200 split 600/600", () => {
  const fixture = loadContract(TEMPLATE);
  const view = open(fixture, { ...flat, resolved: draft() });
  const html = view.preview();
  assert.match(html, /data-key="SESSION_TYPE" value="Senior Portraits"/);
  assert.match(html, /data-key="SESSION_DATE" value="November 29th, 2026"/);
  assert.match(html, /data-key="FINAL_DATE" value="November 29th, 2026"/);
  assert.match(html, /data-key="SESSION_TIME" value="3:00–4:00 pm"/);
  assert.match(html, /data-key="SESSION_LOCATION" value="Harbor Practice Field"/);
  assert.match(html, /data-key="TOTAL_FEE" value="\$1200.00"/);
  assert.match(html, /data-key="RETAINER" value="\$600.00"/);
  assert.match(html, /data-key="REMAINING" value="\$600.00"/);
  assert.match(html, /sxs-date-note">Session date requested in email, not yet confirmed\. \[FINAL_DATE\] \(balance due\) uses the same date/);
  assert.doesNotMatch(html, /TBD|Graduation|SF State|San Francisco State/);
  assert.equal(view.status(), "Senior Portraits · date requested in email, not yet confirmed · time requested, not yet confirmed · $1200.00 total");

  view.fill();
  assert.equal(fixture.text(), [
    "in connection with the portrait session of Senior Portraits (the “Portrait Session”).",
    " Type: Senior Portraits. Date: November 29th, 2026 at 3:00–4:00 pm; Location: Harbor Practice Field.",
    " Total: $1200.00; Retainer: $600.00; Remaining: $600.00 due November 29th, 2026. Signed on November 29th, 2026.",
  ].join(""));
});

test("a confirmed date carries no caution, and neither date placeholder is TBD", () => {
  const fixture = loadContract(TEMPLATE);
  const confirmed = draft({ session: { dateStatus: "confirmed", dateConfidence: "confirmed", timeDetail: { status: "confirmed" } }, top: { warnings: [] } });
  const view = open(fixture, { ...flat, resolved: confirmed });
  assert.doesNotMatch(view.preview(), /sxs-date-note|TBD/);
  assert.equal(view.status(), "Senior Portraits · date confirmed in email · $1200.00 total");
  view.fill();
  assert.doesNotMatch(fixture.text(), /TBD|\[SESSION_DATE\]|\[FINAL_DATE\]/);
});

test("filling twice changes nothing the second time", () => {
  const fixture = loadContract(TEMPLATE);
  const view = open(fixture, { ...flat, resolved: draft() });
  view.fill();
  const once = fixture.text();
  view.fill();
  assert.equal(fixture.text(), once);
});

test("edited preview values win, and FINAL_DATE can differ from the session date", () => {
  const fixture = loadContract(TEMPLATE, { SESSION_DATE: "December 5th, 2026", FINAL_DATE: "December 1st, 2026", TOTAL_FEE: "$1,000.00", RETAINER: "$400", REMAINING: "$600" });
  open(fixture, { ...flat, resolved: draft() }).fill();
  assert.match(fixture.text(), /Date: December 5th, 2026 at/);
  assert.match(fixture.text(), /Total: \$1000\.00; Retainer: \$400\.00; Remaining: \$600\.00 due December 1st, 2026\./);
});

test("a total the server would not give stays empty: the browser never substitutes the thread's figure or the rate card", () => {
  const fixture = loadContract(TEMPLATE);
  const refused = draft({ pricing: { baseCents: 200000, totalCents: null, baseConfirmed: false }, top: { reviewReasons: ["The thread states $1,200 as a quote, which differs from the rate card ($2,000). Confirm the total before filling."] } });
  const view = open(fixture, { ...flat, resolved: refused });
  const html = view.preview();
  assert.match(html, /data-key="TOTAL_FEE" value=""/);
  assert.match(html, /sxs-warning sxs-price-hint">The thread states \$1,200 as a quote/);
  assert.doesNotMatch(html, /\$1200\.00|\$2000\.00/);
  view.fill();
  assert.match(fixture.text(), /Total: \[TOTAL_FEE\]; Retainer: \[RETAINER\]; Remaining: \[REMAINING\]/);
  assert.match(view.status(), /total needs review$/);
});

test("the resolved total already holds the Rush preview: the flat charge is not added again", () => {
  const fixture = loadContract(TEMPLATE);
  const proposal = draft({ session: { serviceKey: "proposal", itemName: "Proposal Session", dateStatus: "confirmed" }, pricing: { baseCents: 82500, totalCents: 82500 }, top: { status: "ready", reviewReasons: [], warnings: ["Includes the $75 Rush preview add-on the client asked for in email."] } });
  const charge = { kind: "add", service: "proposal", amountCents: 7500, label: "Rush preview", note: "" };
  const view = open(fixture, { ...flat, session_type: "proposal", total_fee: 750, total_kind: "quote", rush_preview_charge: charge, resolved: proposal });
  const html = view.preview();
  assert.match(html, /data-key="TOTAL_FEE" value="\$825\.00"/);
  assert.match(html, /data-key="RETAINER" value="\$412\.50"/);
  assert.match(html, /sxs-price-note">Includes the \$75 Rush preview/);
});

test("a malformed resolution is ignored, never guessed at, and an absurd total is no total", () => {
  const fixture = loadContract([]);
  const normalize = raw => { fixture.context.raw = raw; return vm.runInContext("JSON.stringify(normalizeResolved(raw))", fixture.context); };
  for (const bad of [null, "draft", {}, { session: {} }, { session: { serviceKey: 7 }, pricing: {} }]) assert.equal(normalize(bad), "null");
  const odd = JSON.parse(normalize({ session: { serviceKey: "family", date: "11/29/2026", dateStatus: "sure", location: 4 }, pricing: { totalCents: 1e12 }, reviewReasons: "x" }));
  assert.deepEqual(odd, { serviceKey: "family", date: null, dateStatus: "unknown", time: null, timeStatus: null, location: null, totalCents: null, reviewReasons: [], warnings: [] });
});

test("an API with no resolution keeps the browser's own preview", () => {
  const fixture = loadContract(TEMPLATE);
  const view = open(fixture, { ...flat, session_type: "family", total_fee: null, total_kind: null, confidence: "high" });
  assert.match(view.preview(), /data-key="SESSION_TYPE" value="Family"/);
  assert.match(view.preview(), /data-key="TOTAL_FEE" value="\$350\.00"/);
  assert.match(view.status(), /^✓ Confirmed in email/);
});

test("the browser's fallback never calls an unknown session a graduation", () => {
  const fixture = loadContract([]);
  const type = inq => { fixture.context.inq = inq; return vm.runInContext("detectServiceType(inq)", fixture.context); };
  assert.equal(type({ session_type: "Graduation Portrait", message: "Senior portraits for our soccer team, 8 players" }), "senior-portraits");
  assert.equal(type({ session_type: "Graduation Portrait", message: "Senior portraits for our team before we graduate" }), "graduation");
  assert.equal(type({ message: "Some photos please" }), "other");
  assert.equal(type({ message: "Some photos please", school: "SJSU" }), "graduation");
  assert.equal(type({ school: "SJSU", _serviceType: "event" }), "other");
  assert.equal(type({ school: "SJSU", _serviceType: "unknown" }), "other");
  assert.equal(type({ school: "SJSU", _serviceType: "senior-portraits" }), "senior-portraits");

  fixture.context.inq = { message: "Senior portraits for our soccer team", people: "8", school: "SJSU" };
  const price = JSON.parse(vm.runInContext("JSON.stringify(calcPrice(inq))", fixture.context));
  assert.equal(price.subtotal, null);
  assert.equal(price.travelFee, null);
  assert.match(price.reviewHint, /quoted per booking/);
  fixture.context.inq = { message: "Senior portraits for our soccer team", people: "8", _agreedTotal: 1200, _totalKind: "agreed_total" };
  assert.equal(vm.runInContext("calcPrice(inq).subtotal", fixture.context), 1200);
});

test("a yearless date on the form is read from the day the form was sent", () => {
  const fixture = loadContract([]);
  fixture.context.inq = { date_in_mind: "November 20", created_at: "2025-10-01T17:00:00Z" };
  assert.equal(vm.runInContext("enrichInquiryFromFacts(inq)._sessionDate", fixture.context), "November 20th, 2025");
  fixture.context.inq = { date_in_mind: "29th Nov", created_at: "2026-11-02T17:00:00Z" };
  assert.equal(vm.runInContext("enrichInquiryFromFacts(inq)._sessionDate", fixture.context), "November 29th, 2026");
});

test("an answer for a screen the user has left is recognised as stale", () => {
  const fixture = loadContract([]);
  const stale = vm.runInContext("var first = beginView(); var second = beginView(); [isCurrentView(first), isCurrentView(second)]", fixture.context);
  assert.deepEqual([...stale], [false, true]);
});

test("flagged items must be ticked before a contract fill; a clean, confirmed one needs no tick", () => {
  const fixture = loadContract(TEMPLATE);
  assert.match(open(fixture, { ...flat, resolved: draft() }).preview(), /id="sxs-contract-confirm"/);
  const clean = draft({ session: { dateStatus: "confirmed", location: "Golden Gate Park" }, top: { status: "ready", reviewReasons: [], warnings: [] } });
  assert.doesNotMatch(open(fixture, { ...flat, resolved: clean }).preview(), /sxs-contract-confirm/);
  // An older API's browser-priced preview keeps its old, ungated behaviour.
  assert.doesNotMatch(open(fixture, { ...flat, session_type: "family" }).preview(), /sxs-contract-confirm/);
});

test("when the thread cannot be checked, no total is offered and the browser does not price behind the failure", () => {
  const fixture = loadContract(TEMPLATE);
  fixture.context.inq = { ...inquiry, message: "Grad photos for 8 of us, graduating in May", people: "8", _dateStatus: "inquiry" };
  const price = JSON.parse(vm.runInContext("JSON.stringify(unpricedContract(inq))", fixture.context));
  assert.equal(price.subtotal, null);
  assert.match(price.reviewHint, /could not be checked, so no total is filled in/);
  const html = vm.runInContext("buildContractPreview(inq, unpricedContract(inq))", fixture.context);
  assert.match(html, /data-key="TOTAL_FEE" value=""/);
  assert.match(html, /sxs-contract-confirm/);
  assert.doesNotMatch(html, /\$2000/);
});

test("a time the server could not resolve is left TBD instead of writing a bare golden hour", () => {
  const fixture = loadContract(TEMPLATE);
  const unresolved = draft({ session: { time: null, timeDetail: { status: "unresolved" } } });
  const view = open(fixture, { ...flat, time: "golden hour", resolved: unresolved });
  assert.match(view.preview(), /data-key="SESSION_TIME" value="TBD"/);
});

test("the contract body is the editable box that holds the placeholders, not the first one or the panel's", () => {
  const fixture = loadContract([]);
  const box = (text, inPanel = false) => ({ textContent: text, closest: selector => (inPanel && selector === "#sxs-panel" ? {} : null) });
  const decoy = box("Internal note"), panel = box("[SESSION_DATE]", true), body = box("Date: [SESSION_DATE]");
  fixture.context.document.querySelectorAll = () => [decoy, panel, body];
  fixture.context.body = body;
  assert.equal(vm.runInContext("findContractEditor() === body", fixture.context), true);
  fixture.context.document.querySelectorAll = () => [decoy, panel];
  fixture.context.decoy = decoy;
  assert.equal(vm.runInContext("findContractEditor() === decoy", fixture.context), true);
});
