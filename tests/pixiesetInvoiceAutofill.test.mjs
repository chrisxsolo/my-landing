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
  assert.equal(describe({ status: "ready", totalCents: 60000 }), "$600.00 in the last draft");
  assert.equal(describe({ status: "review", totalCents: null }), "Pricing needs review");
});

test("the inquiry GET omits Content-Type so its CORS preflight remains valid", async () => {
  const fixture = loadExtension(buildInvoicePage());
  let request = null;
  fixture.context.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => [] };
  };

  await vm.runInContext('apiFetch("/api/extension/inquiries")', fixture.context);

  assert.equal(request.url, "https://www.soloxsnaps.com/api/extension/inquiries");
  assert.equal(request.options.headers["content-type"], undefined);
  assert.equal(typeof request.options.headers["x-extension-secret"], "string");
});

test("the manifest loads every invoice module and was bumped", () => {
  const scripts = manifest.content_scripts[0].js;
  for (const file of ["invoiceSelection.js", "invoicePreview.js", "invoiceFill.js", "domHelpers.js", "content.js"]) {
    assert.ok(scripts.includes(file), `${file} is loaded`);
  }
  assert.equal(manifest.version, "1.2.0");
});

// ── Rush preview: one line item whose price already carries the add-on ───────

const proposalRushDraft = {
  status: "ready", reviewReasons: [], warnings: ["Includes the $75 Rush preview add-on the client asked for in email."],
  client: { inquiryId: 913, name: "Example Client", email: "client@example.test" },
  session: {
    serviceKey: "proposal", itemName: "Proposal Session", description: "Proposal coverage and portraits + Rush preview", quantity: 1, people: 2,
    school: null, location: "Palace of Fine Arts", locationSource: "email", date: "2026-11-20", dateConfidence: "confirmed", time: "5:30 PM",
  },
  pricing: { currency: "USD", baseCents: 82500, travel: { kind: "included", amountCents: 0, place: "Palace of Fine Arts" }, agreedTotalCents: 75000, totalCents: 82500 },
  note: "Thank you for booking, Example! A 50% non-refundable retainer reserves your session, and the remaining balance is due on or before the session date.",
  dueDate: "2026-11-20",
};

test("a proposal with Rush preview previews at $825 with the add-on explained, and fills 825.00 on one line", async () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  fixture.context.draft = proposalRushDraft;
  const html = vm.runInContext("buildInvoicePreview(draft)", fixture.context);
  assert.match(html, /data-invoice-key="baseCents" value="\$825.00"/);
  assert.match(html, /id="sxs-invoice-total">\$825.00</);
  assert.match(html, /Includes the \$75 Rush preview add-on/);
  assert.match(html, /\+ Rush preview/);
  assert.doesNotMatch(html, /\$900/);
  const result = await fill(fixture, proposalRushDraft);
  const [name, description, , price] = inputs(doc);
  assert.equal(name.value, "Proposal Session");
  assert.equal(description.value, "Proposal coverage and portraits + Rush preview");
  assert.equal(price.value, "825.00");
  assert.equal(doc.querySelectorAll("tr").length, 1, "the add-on is inside the session line, not a second row");
  assert.equal(result.filled, 6);
});

test("the $825 survives a preview round-trip without doubling or losing the add-on, and an edited base still wins", () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  fixture.context.draft = proposalRushDraft;
  const untouched = vm.runInContext("readInvoicePreview(draft, document)", fixture.context);
  assert.equal(untouched.pricing.baseCents, 82500);
  assert.equal(untouched.pricing.totalCents, 82500);
  doc.append("input", { "data-invoice-key": "baseCents", value: "$900" });
  const edited = vm.runInContext("readInvoicePreview(draft, document)", fixture.context);
  assert.equal(edited.pricing.baseCents, 90000);
  assert.equal(edited.pricing.totalCents, 90000);
});

// ── default package and golden-hour time (synthetic client) ──────────────────

const goldenDetail = {
  status: "calculated", requested: "golden hour", start: "18:30", end: "19:30", endDerived: false,
  startUtc: "2027-04-25T01:30:00.000Z", endUtc: "2027-04-25T02:30:00.000Z", timeZone: "America/Los_Angeles", zoneAbbreviation: "PDT",
  sourceLabel: "Calculated from sunset",
  sunset: { local: "7:54 pm", utc: "2027-04-25T02:54:00.000Z", source: "user-supplied test sunset", locality: "San Francisco" },
  unresolvedReason: null,
};

const averyDraft = {
  status: "ready", reviewReasons: [], warnings: [],
  client: { inquiryId: 9001, name: "Avery Example", email: "avery@example.test" },
  session: {
    serviceKey: "graduation", itemName: "Graduation Session", description: "One person, Graduation Session (60 min)", quantity: 1, people: 1,
    school: "California State University, East Bay", location: "Palace of Fine Arts", locationSource: "email",
    date: "2027-04-24", dateConfidence: "confirmed", time: "6:30–7:30 pm", timeDetail: goldenDetail,
    durationMinutes: 60, packageSource: "default", packageNote: "Default: 60-minute Graduation Session",
  },
  pricing: { currency: "USD", baseCents: 42500, travel: { kind: "included", amountCents: 0, place: "Palace of Fine Arts" }, agreedTotalCents: null, totalCents: 42500 },
  note: "Thank you for booking, Avery! A 50% non-refundable retainer reserves your session, and the remaining balance is due on or before the session date.",
  dueDate: "2027-04-24",
};

const unresolvedDraft = {
  ...averyDraft, status: "review",
  reviewReasons: ["Golden hour requested — time needs confirmation: the session date is not confirmed in email."],
  session: {
    ...averyDraft.session, time: null,
    timeDetail: {
      ...goldenDetail, status: "unresolved", start: null, end: null, startUtc: null, endUtc: null, timeZone: null, zoneAbbreviation: null, sunset: null,
      sourceLabel: "Golden hour requested — time needs confirmation", unresolvedReason: "the session date is not confirmed in email.",
    },
  },
};

test("the default package previews ready at $425 with its source, the calculated range, zone and sunset", () => {
  const fixture = loadExtension(buildInvoicePage());
  fixture.context.draft = averyDraft;
  const html = vm.runInContext("buildInvoicePreview(draft)", fixture.context);
  assert.match(html, /Ready to fill/);
  assert.doesNotMatch(html, /Needs review|sxs-review-confirm|does not say which package/);
  assert.match(html, /Package source<\/span><span class="sxs-field-val">Default: 60-minute Graduation Session/);
  assert.match(html, /value="\$425\.00"/);
  assert.match(html, /Total<\/span><span class="sxs-field-val" id="sxs-invoice-total">\$425\.00/);
  assert.match(html, /6:30–7:30 pm<span class="sxs-field-sub">PDT · America\/Los_Angeles<\/span><span class="sxs-field-sub">Calculated from sunset/);
  assert.match(html, /Sunset<\/span><span class="sxs-field-val">7:54 pm<span class="sxs-field-sub">user-supplied test sunset/);
  assert.doesNotMatch(html, />golden hour</);
  assert.match(html, /April 24th, 2027<span class="sxs-field-sub">confirmed in email/);
  assert.match(html, /Included \(San Francisco\) · Palace of Fine Arts/);
  assert.match(html, /California State University, East Bay/);
  assert.equal(vm.runInContext("invoiceFillAllowed(draft, document)", fixture.context), true);
});

test("the default package fills one $425.00 line, no travel row, the due date, and claims no time field", async () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  const { filled, skipped } = await fill(fixture, averyDraft);
  const [name, description, qty, price, note, due] = inputs(doc);
  assert.equal(name.value, "Graduation Session");
  assert.equal(description.value, "One person, Graduation Session (60 min)");
  assert.equal(qty.value, "1");
  assert.equal(price.value, "425.00");
  assert.match(note.value, /^Thank you for booking, Avery!/);
  assert.doesNotMatch(note.value, /6:30|golden|sunset/i);
  assert.equal(due.value, "04/24/2027");
  assert.equal(doc.querySelectorAll('input[placeholder="Item name"]').length, 1);
  assert.deepEqual(plain(skipped), []);
  assert.equal(filled, 6);
  assert.ok(price.events.includes("input") && price.events.includes("change"));
  assert.equal(doc.descendants().every(el => el.clicks === 0), true);
  fixture.context.draft = averyDraft;
  assert.equal(vm.runInContext("invoiceTimeSummary(draft)", fixture.context), " Pixieset's invoice has no session-time field, so 6:30–7:30 pm was not written to it.");
});

test("an unresolved golden hour shows why, offers a retry, and the acknowledgment never sets a time", () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  fixture.context.draft = unresolvedDraft;
  const html = vm.runInContext("buildInvoicePreview(draft)", fixture.context);
  assert.match(html, /Needs review/);
  assert.match(html, /Not set<span class="sxs-field-sub">Golden hour requested — time needs confirmation<\/span><span class="sxs-field-sub">the session date is not confirmed in email\./);
  assert.match(html, /<button type="button" id="sxs-time-retry"/);
  assert.match(html, /The session time stays unset and will not be filled\./);
  assert.match(html, /id="sxs-invoice-total">\$425\.00/);
  assert.doesNotMatch(html, /6:30/);
  assert.equal(vm.runInContext("invoiceFillAllowed(draft, document)", fixture.context), false);

  doc.append("input", { id: "sxs-review-confirm", type: "checkbox" }).checked = true;
  for (const [key, value] of [["itemName", "Graduation Session"], ["description", "One person, Graduation Session (60 min)"], ["baseCents", "$425.00"], ["travelCents", "$0.00"], ["location", "Palace of Fine Arts"], ["dueDate", ""], ["note", "Thanks"]]) {
    doc.append("input", { "data-invoice-key": key, value });
  }
  assert.equal(vm.runInContext("invoiceFillAllowed(draft, document)", fixture.context), true);
  const reviewed = vm.runInContext("readInvoicePreview(draft, document)", fixture.context);
  assert.equal(reviewed.session.time, null);
  assert.equal(reviewed.session.timeDetail.status, "unresolved");
  assert.equal(reviewed.status, "review");
  assert.equal(reviewed.pricing.totalCents, 42500);
  fixture.context.reviewed = reviewed;
  assert.equal(vm.runInContext("invoiceTimeSummary(reviewed)", fixture.context), " Session time is still unresolved and was not filled.");
});

test("reading the preview back keeps a reviewer's price edit and withdraws a time calculated for another location", () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  const fields = { itemName: "Graduation Session", description: "One person", baseCents: "400", travelCents: "", location: "Palace of Fine Arts", dueDate: "2027-04-24", note: "" };
  const els = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, doc.append("input", { "data-invoice-key": key, value })]));
  fixture.context.draft = averyDraft;
  const kept = vm.runInContext("readInvoicePreview(draft, document)", fixture.context);
  assert.equal(kept.pricing.baseCents, 40000);
  assert.equal(kept.pricing.totalCents, 40000);
  assert.equal(kept.session.time, "6:30–7:30 pm");
  assert.equal(kept.session.timeDetail.status, "calculated");

  els.location.value = "UC Berkeley";
  const moved = vm.runInContext("readInvoicePreview(draft, document)", fixture.context);
  assert.equal(moved.session.time, null);
  assert.equal(moved.session.timeDetail.status, "unresolved");
  assert.match(moved.session.timeDetail.unresolvedReason, /location was edited/);
  assert.equal(moved.pricing.baseCents, 40000);
});

test("a draft from an older API, with no time detail or package note, still previews and fills", async () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  fixture.context.draft = anthonyDraft;
  const html = vm.runInContext("buildInvoicePreview(draft)", fixture.context);
  assert.match(html, /Session time<\/span><span class="sxs-field-val">10:00 AM/);
  assert.doesNotMatch(html, /Package source|Sunset<|undefined/);
  assert.equal(vm.runInContext("invoiceTimeSummary(draft)", fixture.context), " Pixieset's invoice has no session-time field, so 10:00 AM was not written to it.");
  assert.equal((await fill(fixture, anthonyDraft)).filled, 6);
});

test("thread text in the time fields is escaped before it reaches the panel", () => {
  const fixture = loadExtension(buildInvoicePage());
  fixture.context.draft = { ...unresolvedDraft, session: { ...unresolvedDraft.session, packageNote: "<img src=x onerror=1>", timeDetail: { ...unresolvedDraft.session.timeDetail, unresolvedReason: "<script>x</script>" } } };
  const html = vm.runInContext("buildInvoicePreview(draft)", fixture.context);
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
});

// ── unconfirmed price, and a requested session date ──────────────────────────

const seniorDraft = {
  status: "review", reviewReasons: ["The thread states $1,200 as a quote, which differs from the rate card ($2,000). Confirm the total before filling."], warnings: [],
  client: { inquiryId: 9101, name: "Jordan Example", email: "jordan@example.test" },
  session: {
    serviceKey: "graduation", itemName: "Graduation Session", description: "Eight people", quantity: 1, people: 8,
    school: null, location: "Golden Gate Park", locationSource: "email", date: "2026-11-29", dateConfidence: "tentative", dateStatus: "proposed", time: "3:00–4:00 pm",
  },
  pricing: { currency: "USD", baseCents: 200000, travel: { kind: "included", amountCents: 0, place: "Golden Gate Park" }, agreedTotalCents: 120000, totalCents: null, baseConfirmed: false },
  note: "Thank you for booking, Jordan!", dueDate: null,
};

const panelWith = values => ({ querySelector: selector => {
  const key = /data-invoice-key="(\w+)"/.exec(selector)?.[1];
  return key && key in values ? { value: values[key] } : null;
} });

test("a price the server would not confirm is shown for reference only and is never filled", async () => {
  const doc = buildInvoicePage();
  const price = doc.querySelector('input[placeholder*="0.00"]');
  price.value = "0.00";
  const fixture = loadExtension(doc);
  fixture.context.draft = seniorDraft;
  const html = vm.runInContext("buildInvoicePreview(draft)", fixture.context);
  assert.match(html, /data-invoice-key="baseCents" value="" spellcheck="false" placeholder="enter the agreed price"/);
  assert.match(html, /Not confirmed: nothing is filled until you enter it/);
  assert.match(html, /Rate card: \$2000\.00/);
  assert.match(html, /Mentioned in email: \$1200\.00/);

  // Ticking the review box and filling with the field still empty must not write $2,000.
  fixture.context.root = panelWith({ itemName: "Senior Portraits", description: "Eight people", baseCents: "", location: "Golden Gate Park", travelCents: "$0.00", dueDate: "", note: "" });
  const untouched = plain(vm.runInContext("readInvoicePreview(draft, root)", fixture.context));
  assert.equal(untouched.pricing.baseCents, null);
  assert.equal(untouched.pricing.totalCents, null);
  const result = await fill(fixture, untouched);
  assert.equal(price.value, "0.00");
  assert.deepEqual(price.events, []);
  assert.match(result.skipped.join(" "), /price \(not confirmed/);
});

test("a price typed into the panel is what gets filled", async () => {
  const doc = buildInvoicePage();
  const fixture = loadExtension(doc);
  fixture.context.draft = seniorDraft;
  fixture.context.root = panelWith({ itemName: "Senior Portraits", description: "Eight people", baseCents: "$1,200", location: "Golden Gate Park", travelCents: "$0.00", dueDate: "", note: "" });
  const typed = plain(vm.runInContext("readInvoicePreview(draft, root)", fixture.context));
  assert.equal(typed.pricing.baseCents, 120000);
  assert.equal(typed.pricing.totalCents, 120000);
  await fill(fixture, typed);
  assert.equal(doc.querySelector('input[placeholder*="0.00"]').value, "1200.00");
  assert.equal(doc.querySelector('input[placeholder*="Item name"]').value, "Senior Portraits");
});

test("a requested session date is shown with its standing and can be accepted by hand as the due date", () => {
  const fixture = loadExtension(buildInvoicePage());
  fixture.context.draft = seniorDraft;
  const html = vm.runInContext("buildInvoicePreview(draft)", fixture.context);
  assert.match(html, /November 29th, 2026<span class="sxs-field-sub">requested in email, not yet confirmed/);
  assert.match(html, /id="sxs-accept-date"/);
  assert.match(html, /data-invoice-key="dueDate" value=""/);

  const due = { value: "" };
  const button = { textContent: "", disabled: false };
  fixture.context.root = { querySelector: selector => (selector.includes("dueDate") ? due : selector === "#sxs-accept-date" ? button : null) };
  vm.runInContext("acceptSessionDateAsDue(draft, root)", fixture.context);
  assert.equal(due.value, "2026-11-29");
  assert.equal(button.disabled, true);

  fixture.context.draft = { ...seniorDraft, dueDate: "2026-11-29", session: { ...seniorDraft.session, dateStatus: "confirmed", dateConfidence: "confirmed" } };
  const confirmed = vm.runInContext("buildInvoicePreview(draft)", fixture.context);
  assert.match(confirmed, /November 29th, 2026<span class="sxs-field-sub">confirmed in email/);
  assert.doesNotMatch(confirmed, /sxs-accept-date/);
});
