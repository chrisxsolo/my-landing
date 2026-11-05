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

test("prices a group from the per-graduate rate regardless of length wording", () => {
  const group = loadAutofill(PRICE_LINE);
  fill(group, { session_type: "graduation", school: "SF State", people: "3" });
  assert.equal(group.text(), "Total: $975.00; Retainer: $487.50; Remaining: $487.50.");
  const eight = loadAutofill(PRICE_LINE);
  fill(eight, { session_type: "graduation", school: "SF State", people: "8", message: "2 hours" });
  assert.equal(eight.text(), "Total: $2000.00; Retainer: $1000.00; Remaining: $1000.00.");
});

test("leaves the price placeholders alone for nine or more graduates, and keeps an agreed total", () => {
  const nine = loadAutofill(PRICE_LINE);
  fill(nine, { session_type: "graduation", school: "SF State", people: "9" });
  assert.equal(nine.text(), "Total: [TOTAL_FEE]; Retainer: [RETAINER]; Remaining: [REMAINING].");
  const legacy = loadAutofill(PRICE_LINE);
  fill(legacy, { session_type: "graduation", school: "SJSU", people: "1", _agreedTotal: 425 });
  assert.equal(legacy.text(), "Total: $425.00; Retainer: $212.50; Remaining: $212.50.");
  const legacyMini = loadAutofill(PRICE_LINE);
  fill(legacyMini, { session_type: "graduation", school: "SJSU", people: "1", message: "the 30 minute mini", _agreedTotal: 350 });
  assert.equal(legacyMini.text(), "Total: $350.00; Retainer: $175.00; Remaining: $175.00.");
});

test("this release of the extension is the one that prices packages", () => {
  assert.equal(manifest.version, "1.1.1");
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
