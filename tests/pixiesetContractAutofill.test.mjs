import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const extensionRoot = new URL("../pixieset-extension/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", extensionRoot), "utf8"));

function loadAutofill(parts, edited = {}) {
  const events = [];
  const nodes = parts.map(nodeValue => ({
    nodeValue,
    parentElement: { dispatchEvent: event => events.push(event.type) },
  }));
  const status = { style: {} };
  const editor = { querySelectorAll: () => [] };
  const document = {
    body: {},
    querySelector: () => editor,
    querySelectorAll: () => Object.entries(edited).map(([key, value]) => ({ dataset: { key }, value })),
    getElementById: () => status,
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
  return { context, nodes, events, text: () => nodes.map(node => node.nodeValue).join("") };
}

function fill(fixture, inquiry) {
  fixture.context.inquiry = inquiry;
  vm.runInContext("fillContract(inquiry, calcPrice(inquiry))", fixture.context);
}

test("fills Family into the existing graduation template and preserves other fields", () => {
  const fixture = loadAutofill([
    'in connection with the portrait session of Graduation (the “Portrait Session”).',
    " Date: [SESSION_DATE] at [SESSION_TIME]; Location: [SESSION_LOCATION].",
    " Total: [TOTAL_FEE]; Retainer: [RETAINER]; Remaining: [REMAINING] on [FINAL_DATE].",
  ]);
  fill(fixture, { session_type: "family", date_in_mind: "October 23rd, 2026" });
  assert.match(fixture.text(), /portrait session of Family \(the “Portrait Session”\)/);
  assert.match(fixture.text(), /October 23rd, 2026 at TBD; Location: Bay Area, CA/);
  assert.match(fixture.text(), /Total: \$350.00; Retainer: \$175.00; Remaining: \$175.00/);
  assert.ok(fixture.events.includes("input"));
});

const PRICE_LINE = ["Total: [TOTAL_FEE]; Retainer: [RETAINER]; Remaining: [REMAINING]."];

test("prices one graduate from the package the inquiry names: mini $325, hour $425", () => {
  const mini = loadAutofill(PRICE_LINE);
  fill(mini, { session_type: "graduation", school: "SF State", people: "1", message: "a 30 minute mini please" });
  assert.equal(mini.text(), "Total: $325.00; Retainer: $162.50; Remaining: $162.50.");
  const hour = loadAutofill(PRICE_LINE);
  fill(hour, { session_type: "graduation", school: "SF State", people: "1", message: "a 1 hour session" });
  assert.equal(hour.text(), "Total: $425.00; Retainer: $212.50; Remaining: $212.50.");
});

test("leaves one graduate with no chosen length unresolved instead of defaulting to the hour", () => {
  const fixture = loadAutofill(PRICE_LINE);
  const inquiry = { session_type: "graduation", school: "SF State", people: "1", message: "grad photos for me in May" };
  fill(fixture, inquiry);
  assert.equal(fixture.text(), "Total: [TOTAL_FEE]; Retainer: [RETAINER]; Remaining: [REMAINING].");
  const preview = vm.runInContext("buildContractPreview(inquiry, calcPrice(inquiry))", fixture.context);
  assert.match(preview, /data-key="TOTAL_FEE" value=""/);
  assert.match(preview, /30-minute mini.*1-hour/);
});

test("treats conflicting mini-or-hour wording as unresolved too", () => {
  const fixture = loadAutofill(PRICE_LINE);
  fill(fixture, { session_type: "graduation", school: "SF State", people: "1", message: "the 1 hour session, or the 30 minute mini if cheaper" });
  assert.equal(fixture.text(), "Total: [TOTAL_FEE]; Retainer: [RETAINER]; Remaining: [REMAINING].");
});

test("prices 90 minutes for one graduate as the hour plus the extension, never the mini", () => {
  const fixture = loadAutofill(PRICE_LINE);
  fill(fixture, { session_type: "graduation", school: "SF State", people: "1", message: "1 hour 30 minutes on campus" });
  assert.equal(fixture.text(), "Total: $525.00; Retainer: $262.50; Remaining: $262.50.");
});

test("adds the campus travel fee to a chosen package", () => {
  const fixture = loadAutofill(PRICE_LINE);
  fill(fixture, { session_type: "graduation", school: "SJSU", people: "1", message: "the 30 minute mini" });
  assert.equal(fixture.text(), "Total: $400.00; Retainer: $200.00; Remaining: $200.00.");
});

// Groups follow lib/pricing.ts graduationSessionPrice: the per-graduate rate
// covers 60 minutes for two graduates and the 90-minute minimum for three or
// more, and each started half hour the inquiry names past that adds $100.
// SF State carries no travel fee, so these totals are the session base alone.
const GROUP_PRICES = [
  [2, "a 1 hour session", 700], [2, "90 minutes", 800], [2, "2 hours", 900],
  [3, "90 minutes", 975], [3, "2 hours", 1075],
  [8, "2 hours", 2100],
];
for (const [people, message, total] of GROUP_PRICES) {
  test(`prices ${people} graduates for "${message}" at $${total} before travel`, () => {
    const fixture = loadAutofill(PRICE_LINE);
    fill(fixture, { session_type: "graduation", school: "SF State", people: String(people), message });
    const half = (total / 2).toFixed(2);
    assert.equal(fixture.text(), `Total: $${total}.00; Retainer: $${half}; Remaining: $${half}.`);
  });
}

test("charges a group's compound length whole: 1 hour 30 minutes is 90 minutes, not 30", () => {
  const fixture = loadAutofill(PRICE_LINE);
  fill(fixture, { session_type: "graduation", school: "SF State", people: "2", message: "1 hour 30 minutes on campus" });
  assert.equal(fixture.text(), "Total: $800.00; Retainer: $400.00; Remaining: $400.00.");
});

test("ignores delivery and arrival spans when a group names its session length", () => {
  const fixture = loadAutofill(PRICE_LINE);
  fill(fixture, {
    session_type: "graduation", school: "SF State", people: "3",
    message: "we would arrive 30 minutes early for a 2 hour session, with photos back within 30 days",
  });
  assert.equal(fixture.text(), "Total: $1075.00; Retainer: $537.50; Remaining: $537.50.");
});

test("prices a group that names no length at its included time", () => {
  const pair = loadAutofill(PRICE_LINE);
  fill(pair, { session_type: "graduation", school: "SF State", people: "2", message: "grad photos for the two of us" });
  assert.equal(pair.text(), "Total: $700.00; Retainer: $350.00; Remaining: $350.00.");
  const three = loadAutofill(PRICE_LINE);
  fill(three, { session_type: "graduation", school: "SF State", people: "3" });
  assert.equal(three.text(), "Total: $975.00; Retainer: $487.50; Remaining: $487.50.");
  const eight = loadAutofill(PRICE_LINE);
  fill(eight, { session_type: "graduation", school: "SF State", people: "8" });
  assert.equal(eight.text(), "Total: $2000.00; Retainer: $1000.00; Remaining: $1000.00.");
});

test("never discounts a group below its included time for a shorter named length", () => {
  const three = loadAutofill(PRICE_LINE);
  fill(three, { session_type: "graduation", school: "SF State", people: "3", message: "a 1 hour session" });
  assert.equal(three.text(), "Total: $975.00; Retainer: $487.50; Remaining: $487.50.");
  const pair = loadAutofill(PRICE_LINE);
  fill(pair, { session_type: "graduation", school: "SF State", people: "2", message: "the 30 minute mini" });
  assert.equal(pair.text(), "Total: $700.00; Retainer: $350.00; Remaining: $350.00.");
});

test("an agreed total overrides a group's calculated duration price", () => {
  const fixture = loadAutofill(PRICE_LINE);
  fill(fixture, { session_type: "graduation", school: "SJSU", people: "8", message: "2 hours", _agreedTotal: 1800 });
  assert.equal(fixture.text(), "Total: $1800.00; Retainer: $900.00; Remaining: $900.00.");
});

test("adds travel once, after the group's extended-time base", () => {
  const fixture = loadAutofill(PRICE_LINE);
  fill(fixture, { session_type: "graduation", school: "SJSU", people: "3", message: "2 hours" });
  assert.equal(fixture.text(), "Total: $1150.00; Retainer: $575.00; Remaining: $575.00.");
});

test("leaves the price placeholders alone for nine or more graduates, and keeps an agreed total", () => {
  const nine = loadAutofill(PRICE_LINE);
  const nineInquiry = { session_type: "graduation", school: "SF State", people: "9", message: "2 hours" };
  fill(nine, nineInquiry);
  assert.equal(nine.text(), "Total: [TOTAL_FEE]; Retainer: [RETAINER]; Remaining: [REMAINING].");
  const ninePreview = vm.runInContext("buildContractPreview(inquiry, calcPrice(inquiry))", nine.context);
  assert.match(ninePreview, /data-key="TOTAL_FEE" value=""/);
  assert.match(ninePreview, /quoted by hand/);
  const legacy = loadAutofill(PRICE_LINE);
  fill(legacy, { session_type: "graduation", school: "SJSU", people: "1", _agreedTotal: 425 });
  assert.equal(legacy.text(), "Total: $425.00; Retainer: $212.50; Remaining: $212.50.");
  const legacyMini = loadAutofill(PRICE_LINE);
  fill(legacyMini, { session_type: "graduation", school: "SJSU", people: "1", message: "the 30 minute mini", _agreedTotal: 350 });
  assert.equal(legacyMini.text(), "Total: $350.00; Retainer: $175.00; Remaining: $175.00.");
});

test("this release of the extension still prices Rush preview (1.1.3 onward)", () => {
  assert.equal(manifest.version, "1.2.0");
});

test("fills the session type when inline formatting splits it across text nodes", () => {
  const fixture = loadAutofill([
    "in connection with the portrait ", "session of ", "Grad", "uation", ' (the "Portrait Session").',
  ]);
  fill(fixture, { session_type: "family" });
  assert.equal(fixture.text(), 'in connection with the portrait session of Family (the "Portrait Session").');
  assert.equal(fixture.nodes[0].nodeValue, "in connection with the portrait ");
  assert.equal(fixture.nodes[4].nodeValue, ' (the "Portrait Session").');
});

test("shows the detected session type as an editable contract preview field", () => {
  const fixture = loadAutofill([]);
  const html = vm.runInContext("buildContractPreview({ session_type: 'family' }, calcPrice({ session_type: 'family' }))", fixture.context);
  assert.match(html, /data-key="SESSION_TYPE" value="Family"/);
});

test("fills SESSION_TYPE placeholders and respects the edited type", () => {
  const fixture = loadAutofill(["Session: [SESSION_TYPE]. portrait session of Graduation (the “Portrait Session”)."], {
    SESSION_TYPE: "Extended Family", TOTAL_FEE: "500", RETAINER: "250",
  });
  fill(fixture, { session_type: "family" });
  assert.equal(fixture.text(), "Session: Extended Family. portrait session of Extended Family (the “Portrait Session”).");
});

for (const [service, label] of Object.entries({
  graduation: "Graduation", family: "Family", "extended-family": "Extended Family",
  couples: "Couples", engagement: "Engagement", proposal: "Proposal",
})) {
  test(`uses ${label} from the detected session type`, () => {
    const fixture = loadAutofill(["portrait session of Graduation (the “Portrait Session”)."]);
    fill(fixture, { session_type: "graduation", _serviceType: service });
    assert.equal(fixture.text(), `portrait session of ${label} (the “Portrait Session”).`);
  });
}

test("leaves unrelated mentions of graduation untouched", () => {
  const fixture = loadAutofill(["Graduation photos from a previous session. portrait session of Graduation (the “Portrait Session”)."]);
  fill(fixture, { session_type: "family" });
  assert.match(fixture.text(), /^Graduation photos from a previous session\. portrait session of Family/);
});

// ── Rush preview (server-resolved add-on; the extension carries no $75 of its own) ──
const PROPOSAL = { session_type: "Couples Session", message: "— Session request —\nPackage: Proposal Session", _serviceType: "proposal" };
const RUSH_ADD = { kind: "add", service: "proposal", amountCents: 7500, label: "Rush preview", note: "Rush preview: +$75 — requested by the client in email." };
const RUSH_INCLUDED = { kind: "included", service: "proposal", amountCents: 7500, label: "Rush preview", note: "The $825 total from the thread already includes the $75 Rush preview." };
const RUSH_REVIEW = { kind: "review", service: "proposal", amountCents: null, label: "Rush preview", note: "The thread mentions Rush preview but whether it was added is unclear. Confirm the total before filling." };

test("adds the server-resolved Rush preview to a proposal: $825, $412.50 and $412.50", () => {
  const fixture = loadAutofill(PRICE_LINE);
  fill(fixture, { ...PROPOSAL, _rushPreview: RUSH_ADD });
  assert.equal(fixture.text(), "Total: $825.00; Retainer: $412.50; Remaining: $412.50.");
  fixture.context.inquiry = { ...PROPOSAL, _rushPreview: RUSH_ADD };
  const preview = vm.runInContext("buildContractPreview(inquiry, calcPrice(inquiry))", fixture.context);
  assert.match(preview, /data-key="TOTAL_FEE" value="\$825.00"/);
  assert.match(preview, /class="sxs-field-row sxs-price-hint sxs-price-note">Rush preview: \+\$75/);
  assert.doesNotMatch(preview, /sxs-warning[^>]*>Rush preview/);
});

test("adds Rush preview on top of the $750 the thread quoted, not on top of today's catalog", () => {
  const fixture = loadAutofill(PRICE_LINE);
  fill(fixture, { ...PROPOSAL, _agreedTotal: 750, _rushPreview: RUSH_ADD });
  assert.equal(fixture.text(), "Total: $825.00; Retainer: $412.50; Remaining: $412.50.");
  const negotiated = loadAutofill(PRICE_LINE);
  fill(negotiated, { ...PROPOSAL, _agreedTotal: 700, _rushPreview: RUSH_ADD });
  assert.equal(negotiated.text(), "Total: $775.00; Retainer: $387.50; Remaining: $387.50.");
});

test("never adds Rush preview on top of a total that already includes it", () => {
  const fixture = loadAutofill(PRICE_LINE);
  fill(fixture, { ...PROPOSAL, _agreedTotal: 825, _rushPreview: RUSH_INCLUDED });
  assert.equal(fixture.text(), "Total: $825.00; Retainer: $412.50; Remaining: $412.50.");
  fixture.context.inquiry = { ...PROPOSAL, _agreedTotal: 825, _rushPreview: RUSH_INCLUDED };
  const preview = vm.runInContext("buildContractPreview(inquiry, calcPrice(inquiry))", fixture.context);
  assert.match(preview, /already includes the \$75 Rush preview/);
});

test("leaves the price placeholders alone and shows why when Rush preview needs review", () => {
  const fixture = loadAutofill(PRICE_LINE);
  const inquiry = { ...PROPOSAL, _agreedTotal: 750, _rushPreview: RUSH_REVIEW };
  fill(fixture, inquiry);
  assert.equal(fixture.text(), "Total: [TOTAL_FEE]; Retainer: [RETAINER]; Remaining: [REMAINING].");
  fixture.context.inquiry = inquiry;
  const preview = vm.runInContext("buildContractPreview(inquiry, calcPrice(inquiry))", fixture.context);
  assert.match(preview, /data-key="TOTAL_FEE" value=""/);
  assert.match(preview, /sxs-warning sxs-price-hint">The thread mentions Rush preview/);
});

test("ignores a malformed Rush preview payload instead of inventing a charge", () => {
  for (const bad of [
    { kind: "add", amountCents: "7500" }, { kind: "add", amountCents: -7500 }, { kind: "add", amountCents: Number.NaN },
    { kind: "add", amountCents: 75.5 }, { kind: "bogus", amountCents: 7500 }, "add", null, 7500, { kind: "add", amountCents: 999999999999 },
  ]) {
    const fixture = loadAutofill(PRICE_LINE);
    fill(fixture, { ...PROPOSAL, _rushPreview: bad });
    assert.equal(fixture.text(), "Total: $750.00; Retainer: $375.00; Remaining: $375.00.", JSON.stringify(bad));
  }
});

test("a manually edited total and retainer still win over the Rush preview figures", () => {
  const fixture = loadAutofill(PRICE_LINE, { TOTAL_FEE: "$900", RETAINER: "500", REMAINING: "400" });
  fill(fixture, { ...PROPOSAL, _rushPreview: RUSH_ADD });
  assert.equal(fixture.text(), "Total: $900.00; Retainer: $500.00; Remaining: $400.00.");
});

test("escapes server text before it reaches the preview", () => {
  const fixture = loadAutofill([]);
  fixture.context.inquiry = { ...PROPOSAL, _rushPreview: { ...RUSH_ADD, note: 'Rush <b>"x"</b> & co' } };
  const preview = vm.runInContext("buildContractPreview(inquiry, calcPrice(inquiry))", fixture.context);
  assert.match(preview, /Rush &lt;b&gt;&quot;x&quot;&lt;\/b&gt; &amp; co/);
  assert.doesNotMatch(preview, /<b>/);
});

test("maps the detect-date payload onto the inquiry, keeping the Rush preview charge and the total's kind", () => {
  const fixture = loadAutofill([]);
  fixture.context.inq = { id: 913, name: "Example Client", email: "client@example.test", date_in_mind: "November 20", created_at: "2026-11-02T17:00:00Z", ...PROPOSAL };
  fixture.context.d = {
    readable: "November 20th, 2026", time: "5:30 PM", location: "Palace of Fine Arts", session_type: "proposal",
    total_fee: 750, total_kind: "quote", confidence: "high", rush_preview_charge: RUSH_ADD,
  };
  const enriched = vm.runInContext("enrichInquiryFromFacts(inq, d)", fixture.context);
  assert.equal(enriched._sessionDate, "November 20th, 2026");
  assert.equal(enriched._sessionTime, "5:30 PM");
  assert.equal(enriched._location, "Palace of Fine Arts");
  assert.equal(enriched._serviceType, "proposal");
  assert.equal(enriched._agreedTotal, 750);
  assert.equal(enriched._totalKind, "quote");
  assert.equal(enriched._rushPreview.kind, "add");
  assert.equal(vm.runInContext("detectedStatusLine(d)", fixture.context), "✓ Confirmed in email · Proposal Session · $750 quoted in email · Rush preview +$75.00");
  fixture.context.d = { readable: null, time: null, location: null, session_type: null, total_fee: 825, total_kind: "agreed_total", confidence: "low" };
  const old = vm.runInContext("enrichInquiryFromFacts(inq, d)", fixture.context);
  assert.equal(old._rushPreview, null, "an older API payload without the field changes nothing");
  assert.equal(old._sessionDate, "November 20th, 2026");
  assert.equal(old._sessionTime, "TBD");
  assert.equal(vm.runInContext("detectedStatusLine(d)", fixture.context), "~ From inquiry form · $825 agreed in email");
});

test("refuses a Rush preview charge the server priced for a different service", () => {
  const fixture = loadAutofill(PRICE_LINE);
  const inquiry = { session_type: "graduation", school: "SF State", people: "2", _rushPreview: RUSH_ADD };
  fill(fixture, inquiry);
  assert.equal(fixture.text(), "Total: [TOTAL_FEE]; Retainer: [RETAINER]; Remaining: [REMAINING].");
  fixture.context.inquiry = inquiry;
  const preview = vm.runInContext("buildContractPreview(inquiry, calcPrice(inquiry))", fixture.context);
  assert.match(preview, /sxs-warning sxs-price-hint">.*proposal.*graduation/i);
});

test("does not promote an unclear thread figure (a deposit, say) to the agreed total", () => {
  const fixture = loadAutofill(PRICE_LINE);
  const inquiry = { ...PROPOSAL, _agreedTotal: 375, _totalKind: "unclear" };
  fill(fixture, inquiry);
  assert.equal(fixture.text(), "Total: $750.00; Retainer: $375.00; Remaining: $375.00.");
  fixture.context.inquiry = inquiry;
  const preview = vm.runInContext("buildContractPreview(inquiry, calcPrice(inquiry))", fixture.context);
  assert.match(preview, /sxs-price-note">The thread mentions \$375.00/);
  const quoted = loadAutofill(PRICE_LINE);
  fill(quoted, { ...PROPOSAL, _agreedTotal: 700, _totalKind: "quote" });
  assert.equal(quoted.text(), "Total: $700.00; Retainer: $350.00; Remaining: $350.00.");
  const legacy = loadAutofill(PRICE_LINE);
  fill(legacy, { ...PROPOSAL, _agreedTotal: 700 });
  assert.equal(legacy.text(), "Total: $700.00; Retainer: $350.00; Remaining: $350.00.", "an older payload without total_kind behaves as before");
});
