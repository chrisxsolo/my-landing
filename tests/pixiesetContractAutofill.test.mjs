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
