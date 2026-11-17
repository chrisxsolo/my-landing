// The extension's Description of Services, end to end in a real DOM: the
// actual content scripts run in jsdom against a stand-in contract page and a
// stubbed API. Every client, thread and contract here is synthetic.

import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
// @ts-expect-error jsdom ships no type declarations; only its documented JSDOM API is used here.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../pixieset-extension");
const manifest = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const SCRIPTS: string[] = manifest.content_scripts[0].js;

const TOKEN = "[DESCRIPTION_OF_SERVICES]";
const OLD_SENTENCE = "[Minimum of 30 edited images delivered within two weeks through an online gallery]";
const PROPOSAL_TEXT = "Proposal photography session. Minimum of 50 edited images delivered within two weeks through an online gallery.\nRush Preview: 5 edited images delivered within 48 hours.";

const INQUIRIES = [
  { id: 1, name: "Alex Example", email: "alex@example.test", created_at: "2026-11-01T10:00:00Z", session_type: "Couples Session", people: "2", message: "" },
  { id: 2, name: "Blake Example", email: "blake@example.test", created_at: "2026-11-02T10:00:00Z", session_type: "Couples Session", people: "2", message: "" },
];

const resolved = (serviceKey = "proposal") => ({
  status: "ready", reviewReasons: [], warnings: [],
  session: { serviceKey, date: "2026-11-20", dateStatus: "confirmed", time: "5:00 PM", timeDetail: { status: "confirmed" }, location: "San Francisco" },
  pricing: { totalCents: 82500 },
});
const services = (over: Record<string, unknown> = {}) => ({
  text: PROPOSAL_TEXT, status: "ready", reviewReasons: [], serviceKey: "proposal", packageKey: "proposal", identity: "proposal|proposal|2|open|std|none|selected", ...over,
});

type Reply = Record<string, unknown> | Error | Promise<Record<string, unknown>>;

function openPage(editorHtml: string, replies: Record<number, Reply>) {
  const dom = new JSDOM(`<body>${editorHtml}</body>`, { url: "https://studio.pixieset.com/contracts/123", runScripts: "outside-only" });
  const win = dom.window as unknown as Record<string, unknown> & { document: Document };
  win.chrome = { storage: { local: { get: (key: string, cb: (items: object) => void) => cb({}), set: (_: object, cb?: () => void) => cb?.() } } };
  win.fetch = async (url: string, options: { body?: string } = {}) => {
    const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body });
    if (String(url).endsWith("/api/extension/inquiries")) return json(INQUIRIES);
    const reply = await replies[JSON.parse(options.body ?? "{}").inquiry_id];
    return reply instanceof Error ? json({ error: reply.message }, false, 502) : json(reply);
  };
  const context = dom.getInternalVMContext();
  for (const file of SCRIPTS) new vm.Script(readFileSync(path.join(ROOT, file), "utf8"), { filename: file }).runInContext(context);
  const doc = win.document;
  const $ = <T extends Element = HTMLElement>(selector: string) => doc.querySelector(selector) as T | null;
  const settle = async (ready: () => unknown) => {
    for (let i = 0; i < 200 && !ready(); i++) await new Promise((resolve) => setTimeout(resolve, 1));
    if (!ready()) throw new Error("the panel never reached the expected state");
  };
  const page = {
    doc, $,
    box: () => $("#sxs-services-text") as unknown as HTMLTextAreaElement,
    fillButton: () => $("#sxs-fill") as unknown as HTMLButtonElement,
    confirm: () => $("#sxs-services-confirm") as unknown as HTMLInputElement,
    notes: () => $("#sxs-services-notes")?.textContent ?? "",
    status: () => $("#sxs-fill-status")?.textContent ?? "",
    async start() { vm.runInContext("showPanel()", context); await settle(() => doc.querySelectorAll(".sxs-inq-row").length === INQUIRIES.length); },
    click(id: number) { (doc.querySelector(`.sxs-inq-row[data-id="${id}"]`) as HTMLElement).click(); },
    async choose(id: number) { page.click(id); await settle(() => page.box()); },
    async back() { ($("#sxs-back") as HTMLElement).click(); await settle(() => doc.querySelectorAll(".sxs-inq-row").length === INQUIRIES.length && $("#sxs-list")!.style.display === "block"); },
    type(element: HTMLInputElement | HTMLTextAreaElement, value: string) { element.value = value; element.dispatchEvent(new dom.window.Event("input", { bubbles: true })); },
    tick(box: HTMLInputElement) { box.checked = true; box.dispatchEvent(new dom.window.Event("change", { bubbles: true })); },
    fill() { page.fillButton().click(); },
  };
  return page;
}

const TEMPLATE = `<div id="contract" contenteditable="true"><h2>Description of Services</h2><ul><li><b>[DESCRIPTION_</b>OF_SERVICES]</li></ul><p>Total: [TOTAL_FEE] <em>non-refundable</em>.</p></div>`;

describe("preview", () => {
  it("shows the server's description in a labelled multiline box and arms Fill for a ready one", async () => {
    const page = openPage(TEMPLATE, { 1: { resolved: resolved(), services: services() } });
    await page.start();
    await page.choose(1);
    expect(page.box().tagName).toBe("TEXTAREA");
    expect(page.box().value).toBe(PROPOSAL_TEXT);
    expect(page.$(`label[for="${page.box().id}"]`)?.textContent).toContain("Description of services");
    const notes = page.$(`#${page.box().getAttribute("aria-describedby")}`)!;
    expect(notes.getAttribute("aria-live")).toBe("polite");
    expect(page.fillButton().disabled).toBe(false);
    expect(page.$("#sxs-services-confirm-row")!.hidden).toBe(true);
  });

  it("requires its own tick for a flagged description, and again after any edit", async () => {
    const page = openPage(TEMPLATE, { 1: { resolved: resolved(), services: services({ status: "review", reviewReasons: ["Confirm the image count."] }) } });
    await page.start();
    await page.choose(1);
    expect(page.notes()).toContain("Confirm the image count.");
    expect(page.fillButton().disabled).toBe(true);
    page.tick(page.confirm());
    expect(page.fillButton().disabled).toBe(false);
    page.type(page.box(), "Something else entirely.");
    expect(page.confirm().checked).toBe(false);
    expect(page.fillButton().disabled).toBe(true);
  });

  it("unticks the description when the session type is changed under it, keeping the text", async () => {
    const page = openPage(TEMPLATE, { 1: { resolved: resolved(), services: services({ status: "review", reviewReasons: ["Check."] }) } });
    await page.start();
    await page.choose(1);
    page.tick(page.confirm());
    page.type(page.$<HTMLInputElement>('input[data-key="SESSION_TYPE"]')!, "Engagement");
    expect(page.confirm().checked).toBe(false);
    expect(page.fillButton().disabled).toBe(true);
    expect(page.notes()).toMatch(/session type was changed/);
    expect(page.box().value).toBe(PROPOSAL_TEXT);
  });

  it("still re-splits the retainer when the total is edited", async () => {
    const page = openPage(TEMPLATE, { 1: { resolved: resolved(), services: services() } });
    await page.start();
    await page.choose(1);
    page.type(page.$<HTMLInputElement>('input[data-key="TOTAL_FEE"]')!, "$900");
    expect(page.$<HTMLInputElement>('input[data-key="RETAINER"]')!.value).toBe("$450.00");
  });
});

describe("old responses and failed lookups", () => {
  it("leaves the description empty, says why, and never falls back to the template's sentence", async () => {
    const legacy = `<div contenteditable="true"><p>${OLD_SENTENCE}</p><p>Total: [TOTAL_FEE]</p></div>`;
    const page = openPage(legacy, { 1: { resolved: resolved() }, 2: { resolved: resolved(), services: { text: 7, status: "ready" } } });
    await page.start();
    await page.choose(1);
    expect(page.box().value).toBe("");
    expect(page.notes()).toMatch(/No description of services was suggested/);
    page.fill();
    expect(page.doc.body.textContent).toContain(OLD_SENTENCE);
    expect(page.doc.body.textContent).toContain("Total: $825.00");
    await page.back();
    await page.choose(2);
    expect(page.box().value).toBe("");
    expect(page.notes()).toMatch(/No description of services was suggested/);
  });

  it("says the thread could not be checked and fills no total", async () => {
    const page = openPage(TEMPLATE, { 1: new Error("Could not read the email thread") });
    await page.start();
    await page.choose(1);
    expect(page.box().value).toBe("");
    expect(page.notes()).toMatch(/could not be checked/);
    expect(page.$<HTMLInputElement>('input[data-key="TOTAL_FEE"]')!.value).toBe("");
  });
});

describe("fill", () => {
  it("replaces a placeholder split across inline nodes, keeps line breaks, and leaves the rest of the contract alone", async () => {
    const page = openPage(TEMPLATE, { 1: { resolved: resolved(), services: services() } });
    await page.start();
    await page.choose(1);
    page.fill();
    const item = page.$("#contract li")!;
    expect(item.textContent).toBe(PROPOSAL_TEXT.replace("\n", ""));
    expect(item.querySelectorAll("br")).toHaveLength(1);
    expect(page.$("#contract h2")!.textContent).toBe("Description of Services");
    expect(page.$("#contract p")!.innerHTML).toBe("Total: $825.00 <em>non-refundable</em>.");
    expect(page.status()).toMatch(/Filled 2 fields.*Description of services filled/);
  });

  it("fills an edited description exactly: markup-like text, dollar patterns and quotes stay literal", async () => {
    const page = openPage(TEMPLATE, { 1: { resolved: resolved(), services: services() } });
    await page.start();
    await page.choose(1);
    const typed = `Proposal coverage <script>alert(1)</script> & "portraits".\nCosts $& and $1 [TOTAL_FEE] stay as typed.`;
    page.type(page.box(), typed);
    expect(page.fillButton().disabled).toBe(true);
    page.tick(page.confirm());
    page.fill();
    const item = page.$("#contract li")!;
    expect(item.querySelector("script")).toBeNull();
    expect(item.textContent).toBe(typed.replace("\n", ""));
    expect(item.querySelectorAll("br")).toHaveLength(1);
  });

  it("leaves the placeholder when the description is blank, and says so", async () => {
    const page = openPage(TEMPLATE, { 1: { resolved: resolved(), services: services() } });
    await page.start();
    await page.choose(1);
    page.type(page.box(), "   \n ");
    expect(page.fillButton().disabled).toBe(false);
    page.fill();
    expect(page.$("#contract li")!.textContent).toBe(TOKEN);
    expect(page.status()).toMatch(/Filled 1 field\..*was left in the contract/);
  });

  it("reports a template with no placeholder separately from the fields it did fill", async () => {
    const legacy = `<div contenteditable="true"><p>${OLD_SENTENCE}</p><p>Total: [TOTAL_FEE]</p></div>`;
    const page = openPage(legacy, { 1: { resolved: resolved(), services: services() } });
    await page.start();
    await page.choose(1);
    page.fill();
    expect(page.status()).toMatch(/Filled 1 field\./);
    expect(page.status()).toMatch(/NOT filled.*replace the sentence.*\[DESCRIPTION_OF_SERVICES\]/);
    expect(page.doc.body.textContent).toContain(OLD_SENTENCE);
  });

  it("never duplicates or overwrites on a second Fill", async () => {
    const page = openPage(TEMPLATE, { 1: { resolved: resolved(), services: services() } });
    await page.start();
    await page.choose(1);
    page.fill();
    page.fill();
    expect(page.$("#contract li")!.textContent).toBe(PROPOSAL_TEXT.replace("\n", ""));
    expect(page.status()).toMatch(/already filled/);
    page.type(page.box(), "A different description.");
    page.tick(page.confirm());
    page.fill();
    expect(page.$("#contract li")!.textContent).toBe(PROPOSAL_TEXT.replace("\n", ""));
    expect(page.status()).toMatch(/has changed here since/);
  });

  it("fills every placeholder, mid-sentence ones included, and keeps the text around them", async () => {
    const html = `<div contenteditable="true" id="contract"><p>Scope: ${TOKEN} (see above).</p><p><i></i>Again: ${TOKEN}</p></div>`;
    const page = openPage(html, { 1: { resolved: resolved(), services: services() } });
    await page.start();
    await page.choose(1);
    page.fill();
    const [first, second] = [...page.doc.querySelectorAll("#contract p")];
    expect(first.textContent).toBe(`Scope: ${PROPOSAL_TEXT.replace("\n", "")} (see above).`);
    expect(second.textContent).toBe(`Again: ${PROPOSAL_TEXT.replace("\n", "")}`);
    expect(page.doc.querySelectorAll("#contract br")).toHaveLength(2);
  });

  it("fills a description-only template and ignores other editable areas and the panel", async () => {
    const html = `<div contenteditable="true" id="note">Internal note</div><div contenteditable="true" id="contract"><p>${TOKEN}</p></div>`;
    const page = openPage(html, { 1: { resolved: resolved(), services: services() } });
    await page.start();
    await page.choose(1);
    page.fill();
    expect(page.$("#note")!.textContent).toBe("Internal note");
    expect(page.$("#contract p")!.textContent).toBe(PROPOSAL_TEXT.replace("\n", ""));
  });

  it("fills nothing when two separate editable areas hold placeholders", async () => {
    const html = `<div contenteditable="true" id="a">${TOKEN}</div><div contenteditable="true" id="b">Total: [TOTAL_FEE]</div>`;
    const page = openPage(html, { 1: { resolved: resolved(), services: services() } });
    await page.start();
    await page.choose(1);
    page.fill();
    expect(page.$("#a")!.textContent).toBe(TOKEN);
    expect(page.$("#b")!.textContent).toBe("Total: [TOTAL_FEE]");
    expect(page.status()).toMatch(/More than one editable area/);
  });
});

describe("one booking at a time", () => {
  it("keeps a manual description for its own client only, and never shows it to another", async () => {
    const page = openPage(TEMPLATE, {
      1: { resolved: resolved(), services: services() },
      2: { resolved: resolved("engagement"), services: services({ text: "Engagement photography session.", identity: "engagement" }) },
    });
    await page.start();
    await page.choose(1);
    page.type(page.box(), "Alex's own wording.");
    await page.back();
    await page.choose(2);
    expect(page.box().value).toBe("Engagement photography session.");
    await page.back();
    await page.choose(1);
    expect(page.box().value).toBe("Alex's own wording.");
    expect(page.fillButton().disabled).toBe(true);
  });

  it("drops a late answer for a client the panel has left", async () => {
    let release: (value: Record<string, unknown>) => void = () => {};
    const slow = new Promise<Record<string, unknown>>((resolve) => { release = resolve; });
    const page = openPage(TEMPLATE, { 1: slow, 2: { resolved: resolved("engagement"), services: services({ text: "Engagement photography session.", identity: "engagement" }) } });
    await page.start();
    page.click(1);
    await page.back();
    await page.choose(2);
    release({ resolved: resolved(), services: services() });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(page.box().value).toBe("Engagement photography session.");
  });

  it("keeps an edit when the booking's facts change, flags it, and offers the new suggestion", async () => {
    const replies: Record<number, Reply> = { 1: { resolved: resolved(), services: services() } };
    const page = openPage(TEMPLATE, replies);
    await page.start();
    await page.choose(1);
    page.type(page.box(), "My wording.");
    await page.back();
    replies[1] = { resolved: resolved(), services: services({ text: "Proposal photography session. New terms.", identity: "changed" }) };
    await page.choose(1);
    expect(page.box().value).toBe("My wording.");
    expect(page.notes()).toMatch(/details changed after you edited/);
    expect(page.fillButton().disabled).toBe(true);
    (page.$("#sxs-services-reset") as HTMLElement).click();
    expect(page.box().value).toBe("Proposal photography session. New terms.");
    expect(page.fillButton().disabled).toBe(false);
  });
});
