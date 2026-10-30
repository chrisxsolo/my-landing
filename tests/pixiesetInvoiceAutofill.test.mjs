// The Pixieset invoice autofill: a server-priced draft is shown for review,
// then written into the invoice editor with native setters and bubbling
// input/change events. A small fake DOM stands in for Pixieset's page.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const extensionRoot = new URL("../pixieset-extension/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", extensionRoot), "utf8"));

// ── fake DOM ─────────────────────────────────────────────────────────────────

class FakeElement {
  constructor(tagName, attrs = {}, parent = null) {
    this.tagName = tagName.toUpperCase();
    this.attrs = attrs;
    this.parent = parent;
    this.children = [];
    this.value = attrs.value ?? "";
    this.checked = Boolean(attrs.checked);
    this.disabled = false;
    this.textContent = attrs.text ?? "";
    this.events = [];
    this.clicks = 0;
    this.listeners = {};
  }
  get placeholder() { return this.attrs.placeholder ?? ""; }
  get name() { return this.attrs.name ?? ""; }
  get className() { return this.attrs.class ?? ""; }
  get parentElement() { return this.parent; }
  append(tag, attrs = {}) { const el = new FakeElement(tag, attrs, this); this.children.push(el); return el; }
  descendants() { return this.children.flatMap(c => [c, ...c.descendants()]); }
  matches(selector) { return selector.split(",").some(part => matchesSimple(this, part.trim())); }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) ?? null; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) { return this.descendants().filter(el => el.matches(selector)); }
  dispatchEvent(event) { this.events.push(event.type); return true; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  click() { this.clicks++; (this.listeners.click ?? []).forEach(fn => fn()); }
}

// Supports `tag`, `tag[attr*="x" i]`, `tag[attr="x"]`, `[class*="x" i]`, `#id`, `[role='button']`.
function matchesSimple(el, selector) {
  const m = /^([a-z]*)(#[\w-]+)?((?:\[[^\]]+\])*)$/i.exec(selector);
  if (!m) return false;
  const [, tag, id, attrPart] = m;
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  if (id && el.attrs.id !== id.slice(1)) return false;
  for (const [, name, op, raw, flag] of attrPart.matchAll(/\[([\w-]+)(\*?=)?(?:"([^"]*)"|'([^']*)')?\s*(i)?\]/g)) {
    const actual = el.attrs[name];
    if (actual == null) return false;
    if (!op) continue;
    const expected = raw ?? "";
    const a = flag ? actual.toLowerCase() : actual;
    const e = flag ? expected.toLowerCase() : expected;
    if (op === "*=" ? !a.includes(e) : a !== e) return false;
  }
  return true;
}

function buildInvoicePage({ rows = 1, addItem = true } = {}) {
  const doc = new FakeElement("document");
  const table = doc.append("table");
  const addRow = () => {
    const tr = table.append("tr");
    tr.append("input", { placeholder: "Item name" });
    tr.append("input", { placeholder: "Item description" });
    tr.append("input", { placeholder: "Qty" });
    tr.append("input", { placeholder: "0.00" });
    return tr;
  };
  for (let i = 0; i < rows; i++) addRow();
  if (addItem) {
    const button = doc.append("button", { text: "+ Add item" });
    button.addEventListener("click", addRow);
  }
  doc.append("textarea", { placeholder: "Thank you for your business" });
  doc.append("input", { placeholder: "Due date" });
  doc.body = doc;
  doc.appendChild = () => {};
  doc.getElementById = id => doc.descendants().find(el => el.attrs.id === id) ?? null;
  doc.createElement = tag => new FakeElement(tag);
  return doc;
}

function loadExtension(doc, { pathname = "/invoices/123" } = {}) {
  const stored = {};
  const chrome = {
    storage: {
      local: {
        get: (key, cb) => cb({ [key]: stored[key] }),
        set: (items, cb) => { Object.assign(stored, items); cb?.(); },
      },
    },
  };
  const context = vm.createContext({
    document: doc, Event, NodeFilter: { SHOW_TEXT: 4 }, chrome, console,
    window: {
      HTMLInputElement: { prototype: { value: null } },
      HTMLTextAreaElement: { prototype: { value: null } },
    },
    location: { href: `https://studio.pixieset.com${pathname}`, pathname },
    setTimeout, Date, Promise, MutationObserver: class { observe() {} },
  });
  // Native setters are looked up on the prototypes; in this fake DOM a plain
  // property write is the equivalent.
  context.Object = Object;
  for (const file of manifest.content_scripts[0].js) {
    vm.runInContext(readFileSync(new URL(file, extensionRoot), "utf8"), context);
  }
  vm.runInContext(`
    Object.getOwnPropertyDescriptor = (proto, key) => ({ set(value) { this.value = value; } });
  `, context);
  return { context, stored };
}

const anthonyDraft = {
  status: "ready", reviewReasons: [], warnings: [],
  client: { inquiryId: 412, name: "Anthony Trujillo", email: "anthony@example.com" },
  session: {
    serviceKey: "graduation", itemName: "Graduation Session", description: "Two people", quantity: 1, people: 2,
    school: "SJSU", location: "San Francisco City Hall", locationSource: "email",
    date: "2027-05-16", dateConfidence: "confirmed", time: "10:00 AM",
  },
  pricing: { currency: "USD", baseCents: 60000, travel: { kind: "included", amountCents: 0, place: "San Francisco City Hall" }, agreedTotalCents: null, totalCents: 60000 },
  note: "Thank you for booking, Anthony! A 50% non-refundable retainer reserves your session, and the remaining balance is due on or before the session date.",
  dueDate: "2027-05-16",
};

const sjsuDraft = {
  ...anthonyDraft,
  session: { ...anthonyDraft.session, location: "SJSU campus" },
  pricing: { ...anthonyDraft.pricing, travel: { kind: "verified", amountCents: 7500, place: "SJSU campus" }, totalCents: 67500 },
};

async function fill(fixture, draft) {
  fixture.context.draft = draft;
  return vm.runInContext("fillInvoiceFromDraft(draft, document)", fixture.context);
}

const inputs = doc => doc.querySelectorAll("input, textarea");
// Values that cross the vm boundary carry another realm's prototypes.
const plain = value => JSON.parse(JSON.stringify(value));

// ── preview ──────────────────────────────────────────────────────────────────

test("Anthony's preview shows $600, City Hall, included travel and no travel line", () => {
  const fixture = loadExtension(buildInvoicePage());
  fixture.context.draft = anthonyDraft;
  const html = vm.runInContext("buildInvoicePreview(draft)", fixture.context);
  assert.match(html, /data-invoice-key="itemName" value="Graduation Session"/);
  assert.match(html, /data-invoice-key="description" value="Two people"/);
  assert.match(html, /Quantity<\/span><span class="sxs-field-val">1</);
  assert.match(html, /data-invoice-key="baseCents" value="\$600.00"/);
  assert.match(html, /data-invoice-key="location" value="San Francisco City Hall"/);
  assert.match(html, /Included \(San Francisco\)/);
  assert.match(html, /id="sxs-invoice-total">\$600.00</);
  assert.match(html, /confirmed in email/);
  assert.doesNotMatch(html, /Travel Fee/);
  assert.doesNotMatch(html, /\$675/);
  assert.match(html, /Thank you for booking, Anthony!/);
});

test("a review draft is not fillable until the flagged fields are confirmed", () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  fixture.context.draft = { ...anthonyDraft, status: "review", reviewReasons: ["Point Reyes has no approved travel fee."] };
  const html = vm.runInContext("buildInvoicePreview(draft)", fixture.context);
  assert.match(html, /Needs review/);
  assert.match(html, /Point Reyes has no approved travel fee/);
  assert.match(html, /id="sxs-review-confirm"/);
  assert.equal(vm.runInContext("invoiceFillAllowed(draft, document)", fixture.context), false);
  doc.append("input", { id: "sxs-review-confirm", type: "checkbox" }).checked = true;
  assert.equal(vm.runInContext("invoiceFillAllowed(draft, document)", fixture.context), true);
});

test("edits in the preview are read back; a fee typed for an unknown location becomes a travel line", () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  doc.append("input", { "data-invoice-key": "baseCents", value: "$650" });
  doc.append("input", { "data-invoice-key": "travelCents", value: "90" });
  doc.append("input", { "data-invoice-key": "location", value: "Point Reyes" });
  doc.append("input", { "data-invoice-key": "dueDate", value: "" });
  fixture.context.draft = {
    ...anthonyDraft, status: "review", reviewReasons: ["unpriced"],
    pricing: { ...anthonyDraft.pricing, travel: { kind: "unknown", amountCents: null, place: "Point Reyes" }, totalCents: null },
  };
  const reviewed = vm.runInContext("readInvoicePreview(draft, document)", fixture.context);
  assert.equal(reviewed.pricing.baseCents, 65000);
  assert.deepEqual(plain(reviewed.pricing.travel), { kind: "verified", amountCents: 9000, place: "Point Reyes" });
  assert.equal(reviewed.pricing.totalCents, 74000);
  assert.equal(reviewed.dueDate, null);
});

// ── fill ─────────────────────────────────────────────────────────────────────

test("fills Anthony's invoice: item, description, quantity, price, note, due date, and no travel row", async () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  const result = await fill(fixture, anthonyDraft);
  const [name, description, qty, price] = inputs(doc);
  assert.equal(name.value, "Graduation Session");
  assert.equal(description.value, "Two people");
  assert.equal(qty.value, "1");
  assert.equal(price.value, "600.00");
  assert.equal(doc.querySelector("textarea").value, anthonyDraft.note);
  assert.equal(doc.querySelector('input[placeholder*="Due"]').value, "05/16/2027");
  assert.equal(doc.querySelectorAll("tr").length, 1, "no Travel Fee row for included travel");
  assert.equal(result.filled, 6);
  assert.deepEqual(plain(result.skipped), []);
  for (const el of [name, description, qty, price]) {
    assert.deepEqual(el.events, ["input", "change"], `${el.placeholder} got input + change`);
  }
});

test("adds a Travel Fee row through Add Item for an approved $75 SJSU fee", async () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  const result = await fill(fixture, sjsuDraft);
  const rows = doc.querySelectorAll("tr");
  assert.equal(rows.length, 2);
  const [name, description, qty, price] = rows[1].querySelectorAll("input");
  assert.equal(name.value, "Travel Fee");
  assert.equal(description.value, "Travel to SJSU campus");
  assert.equal(qty.value, "1");
  assert.equal(price.value, "75.00");
  assert.deepEqual(price.events, ["input", "change"]);
  assert.equal(result.filled, 10);
});

test("uses an existing blank second row instead of adding one", async () => {
  const doc = buildInvoicePage({ rows: 2 });
  const fixture = loadExtension(doc);
  await fill(fixture, sjsuDraft);
  assert.equal(doc.querySelectorAll("tr").length, 2);
  assert.equal(doc.querySelectorAll("tr")[1].querySelector("input").value, "Travel Fee");
});

test("reports a missing Add Item control instead of dropping the fee silently", async () => {
  const doc = buildInvoicePage({ addItem: false });
  const fixture = loadExtension(doc);
  const result = await fill(fixture, sjsuDraft);
  assert.match(result.skipped.join(" "), /travel fee row/);
});

test("leaves the due date untouched when the session date is not confirmed", async () => {
  const doc = buildInvoicePage();
  const due = doc.querySelector('input[placeholder*="Due"]');
  due.value = "01/01/2030";
  const fixture = loadExtension(doc);
  await fill(fixture, { ...anthonyDraft, dueDate: null, session: { ...anthonyDraft.session, dateConfidence: "tentative" } });
  assert.equal(due.value, "01/01/2030");
  assert.deepEqual(due.events, []);
});

// ── client selection + persistence ───────────────────────────────────────────

test("an exact email match is the only one chosen; none or several do not auto-advance", () => {
  const fixture = loadExtension(buildInvoicePage());
  const run = (candidates, email) => {
    fixture.context.candidates = candidates; fixture.context.email = email;
    return vm.runInContext("chooseClientMatch(candidates, email)", fixture.context);
  };
  const one = [{ text: "Anthony Trujillo · anthony@example.com" }, { text: "Ana Trujillo · ana@example.com" }];
  assert.equal(run(one, "anthony@example.com").text, one[0].text);
  assert.equal(run(one, "ANTHONY@example.com").text, one[0].text);
  assert.equal(run(one, "nobody@example.com"), null);
  assert.equal(run([{ text: "a anthony@example.com" }, { text: "b anthony@example.com" }], "anthony@example.com"), null);
  assert.equal(run(one, ""), null);
});

test("the selected inquiry survives navigation and expires after 30 minutes", async () => {
  const fixture = loadExtension(buildInvoicePage());
  const now = 1_700_000_000_000;
  await vm.runInContext(`saveInvoiceSelection(412, "anthony@example.com", ${now})`, fixture.context);
  assert.equal(fixture.stored.sxsInvoiceSelection.inquiryId, 412);
  const fresh = await vm.runInContext(`loadInvoiceSelection(${now + 5 * 60 * 1000})`, fixture.context);
  assert.equal(fresh.inquiryId, 412);
  const stale = await vm.runInContext(`loadInvoiceSelection(${now + 31 * 60 * 1000})`, fixture.context);
  assert.equal(stale, null);
  assert.equal(fixture.stored.sxsInvoiceSelection, null, "an expired selection is cleared");
});

test("a successful fill clears the stored selection", async () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  await vm.runInContext(`saveInvoiceSelection(412, "anthony@example.com")`, fixture.context);
  await vm.runInContext("clearInvoiceSelection()", fixture.context);
  assert.equal(fixture.stored.sxsInvoiceSelection, null);
});

test("the list shows no browser-calculated travel total before the server has priced the inquiry", () => {
  const fixture = loadExtension(buildInvoicePage());
  const describe = cached => { fixture.context.cached = cached; return vm.runInContext("describeListPrice(cached)", fixture.context); };
  assert.equal(describe(undefined), "Open to confirm pricing");
  assert.equal(describe({ status: "ready", totalCents: 60000 }), "$600.00 confirmed");
  assert.equal(describe({ status: "review", totalCents: null }), "Pricing needs review");
});

test("the manifest loads every invoice module and was bumped", () => {
  const scripts = manifest.content_scripts[0].js;
  for (const file of ["invoiceSelection.js", "invoicePreview.js", "invoiceFill.js", "domHelpers.js", "content.js"]) {
    assert.ok(scripts.includes(file), `${file} is loaded`);
  }
  assert.notEqual(manifest.version, "1.0.3");
});
