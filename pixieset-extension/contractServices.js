// SoloXSnaps → PixiSet Autofill: the contract's Description of Services.
// /api/extension/detect-date writes it, as `services`, from the same booking
// facts as the price; this file only checks that payload, shows it in an
// editable box, and puts the reviewed text where the template says
// [DESCRIPTION_OF_SERVICES]. No package rule lives in the browser: when the
// server sends nothing, the box is empty and the photographer writes it.

const SERVICES_TOKEN = "[DESCRIPTION_OF_SERVICES]";
const SERVICES_MAX_CHARS = 1200;
const SERVICES_MAX_IDENTITY_CHARS = 200;
const SERVICES_MISSING_NOTE = "No description of services was suggested for this booking. Write it here by hand.";
const SERVICES_UNCHECKED_NOTE = "The email thread could not be checked, so no description of services is suggested. Write it here by hand.";
const SERVICES_TEMPLATE_HELP = 'In the Pixieset contract template, replace the sentence "[Minimum of 30 edited images delivered within two weeks through an online gallery]" with [DESCRIPTION_OF_SERVICES].';
const SERVICES_WARNING_COLOR = "#a36a12";

// What the photographer typed, per inquiry, for as long as this page lives:
// reopening the same client keeps their wording, and no other client sees it.
const servicesEdits = new Map();
// The description box on screen right now, and the text this page already put into the contract.
let servicesView = null;
let servicesFilled = null;

// A description with nothing suggested: the box starts empty and says why.
function unresolvedServices(note) {
  return { text: "", status: "unresolved", reviewReasons: [note], identity: "" };
}

// The server's `services`, checked field by field. Anything that is not one
// (an older API, a malformed payload) is unresolved, never guessed at.
function normalizeServices(raw) {
  const valid = raw && typeof raw === "object" && typeof raw.text === "string" && typeof raw.identity === "string"
    && (raw.status === "ready" || raw.status === "review") && Array.isArray(raw.reviewReasons);
  if (!valid) return unresolvedServices(SERVICES_MISSING_NOTE);
  const reviewReasons = raw.reviewReasons.filter(m => typeof m === "string" && m).slice(0, MAX_RESOLVED_MESSAGES).map(m => m.slice(0, MAX_MESSAGE_CHARS));
  const text = raw.text.slice(0, SERVICES_MAX_CHARS).trim();
  // "ready" is only believed for text with nothing flagged beside it.
  const status = raw.status === "ready" && text && !reviewReasons.length ? "ready" : "review";
  return { text, status, reviewReasons, identity: raw.identity.slice(0, SERVICES_MAX_IDENTITY_CHARS) };
}

function buildServicesPreview(inquiryId, services) {
  const stored = servicesEdits.get(String(inquiryId));
  // An edit made against facts that have since changed is kept, and flagged.
  const factsChanged = Boolean(stored) && (stored.identity !== services.identity || stored.suggested !== services.text);
  servicesView = { inquiryId: String(inquiryId), services, typeChanged: false, factsChanged };
  // The line break after the tag is the one HTML drops, so the text's own first line survives.
  return `
    <div class="sxs-services">
      <label class="sxs-field-label" for="sxs-services-text">Description of services <span aria-hidden="true">${SERVICES_TOKEN}</span></label>
      <textarea id="sxs-services-text" class="sxs-services-input" rows="5" maxlength="${SERVICES_MAX_CHARS}" aria-describedby="sxs-services-notes">\n${esc(stored ? stored.text : services.text)}</textarea>
      <div id="sxs-services-notes" class="sxs-services-notes sxs-warning" aria-live="polite"></div>
      <button type="button" id="sxs-services-reset" class="sxs-services-reset" hidden>Use the suggested description</button>
      <label class="sxs-confirm-row" id="sxs-services-confirm-row" hidden><input type="checkbox" id="sxs-services-confirm" /> I've checked this description of services</label>
    </div>`;
}

// The description as it will be filled: the box's own text, line breaks kept.
function readServicesText() {
  const box = document.getElementById("sxs-services-text");
  return box && typeof box.value === "string" ? box.value.replace(/\r\n?/g, "\n").trim() : "";
}

function servicesEdited() {
  return Boolean(servicesView && servicesEdits.has(servicesView.inquiryId));
}

function servicesNotes() {
  if (!servicesView) return [];
  const notes = [...servicesView.services.reviewReasons];
  if (servicesEdited()) notes.push("You edited this description. It is filled exactly as written here.");
  if (servicesView.factsChanged) notes.push("The booking's details changed after you edited this description. Compare it with the suggested one.");
  if (servicesView.typeChanged) notes.push("The session type was changed after this description was written. Check that it still fits.");
  if (!readServicesText()) notes.push(`The description is empty, so ${SERVICES_TOKEN} is left in the contract.`);
  return notes;
}

// A description that was flagged, edited, or written for a session type that
// has since changed is ticked off on its own, after the last change to it.
function servicesNeedConfirmation() {
  if (!servicesView || !readServicesText()) return false;
  return servicesView.services.status !== "ready" || servicesEdited() || servicesView.typeChanged || servicesView.factsChanged;
}

function servicesFillAllowed() {
  if (!servicesNeedConfirmation()) return true;
  const confirm = document.getElementById("sxs-services-confirm");
  return Boolean(confirm && confirm.checked);
}

// Repaints the notes, the reset button and the confirmation row. `changed`
// means the text or the session type just moved: an earlier tick no longer stands.
function refreshServicesPreview(changed) {
  const notes = document.getElementById("sxs-services-notes");
  const reset = document.getElementById("sxs-services-reset");
  const row = document.getElementById("sxs-services-confirm-row");
  const confirm = document.getElementById("sxs-services-confirm");
  if (!notes || !reset || !row || !confirm || !servicesView) return;
  paintServicesNotes(notes, servicesNotes());
  reset.hidden = !(servicesEdited() && servicesView.services.text);
  row.hidden = !servicesNeedConfirmation();
  if (changed || row.hidden) confirm.checked = false;
}

// The notes are a live region: they are rebuilt only when they actually
// change, so typing in the box does not re-announce them on every key.
function paintServicesNotes(holder, notes) {
  const joined = notes.join("\n");
  if (holder.dataset.shown === joined) return;
  holder.dataset.shown = joined;
  holder.textContent = "";
  if (!notes.length) return;
  const list = document.createElement("ul");
  for (const note of notes) {
    const item = document.createElement("li");
    item.textContent = note;
    list.appendChild(item);
  }
  holder.appendChild(list);
}

function wireServicesPreview(onChange) {
  const box = document.getElementById("sxs-services-text");
  if (!box || !servicesView) return;
  const view = servicesView;
  const update = () => { refreshServicesPreview(true); onChange(); };
  box.addEventListener("input", () => {
    const text = box.value.replace(/\r\n?/g, "\n");
    if (text.trim() === view.services.text) servicesEdits.delete(view.inquiryId);
    else servicesEdits.set(view.inquiryId, { text, suggested: view.services.text, identity: view.services.identity });
    update();
  });
  document.getElementById("sxs-services-reset").addEventListener("click", () => {
    servicesEdits.delete(view.inquiryId);
    view.factsChanged = false;
    box.value = view.services.text;
    update();
  });
  document.getElementById("sxs-services-confirm").addEventListener("change", onChange);
  const type = document.querySelector('#sxs-preview-rows input[data-key="SESSION_TYPE"]');
  const writtenFor = type ? type.value.trim() : "";
  if (type) type.addEventListener("input", () => { view.typeChanged = type.value.trim() !== writtenFor; update(); });
  refreshServicesPreview(false);
}

function contractTextNodes(editor) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

// Puts the lines after `node` as text and <br> nodes (never HTML), then whatever followed the placeholder.
function appendServicesLines(node, lines, tail) {
  if (!lines.length) { node.nodeValue += tail; return; }
  let anchor = node;
  const after = next => { anchor.parentNode.insertBefore(next, anchor.nextSibling); anchor = next; };
  for (const line of lines) {
    after(document.createElement("br"));
    after(document.createTextNode(line));
  }
  if (tail) after(document.createTextNode(tail));
}

// Replaces the characters [start, end) of the nodes' joined text, wherever
// bold or italic spans cut the placeholder into pieces.
function replaceServicesRange(nodes, start, end, lines) {
  let offset = 0, first = null;
  for (const node of nodes) {
    const value = node.nodeValue, nodeStart = offset;
    offset += value.length;
    if (nodeStart >= end || offset <= start) continue;
    const from = Math.max(0, start - nodeStart), to = Math.min(value.length, end - nodeStart);
    if (first) { node.nodeValue = value.slice(0, from) + value.slice(to); continue; }
    first = node;
    node.nodeValue = value.slice(0, from) + lines[0];
    appendServicesLines(node, lines.slice(1), value.slice(to));
  }
  if (first && first.parentElement) first.parentElement.dispatchEvent(new Event("input", { bubbles: true }));
}

// Fills every [DESCRIPTION_OF_SERVICES] in the editor and reports what
// happened. With no placeholder nothing else in the contract is touched: a
// sentence is never searched for and overwritten.
function fillServicesToken(editor) {
  const text = readServicesText();
  const nodes = editor ? contractTextNodes(editor) : [];
  const joined = nodes.map(node => node.nodeValue).join("");
  const starts = [];
  for (let at = joined.indexOf(SERVICES_TOKEN); at >= 0; at = joined.indexOf(SERVICES_TOKEN, at + SERVICES_TOKEN.length)) starts.push(at);
  if (!starts.length) {
    // Only the contract this page already filled counts: another contract at the same address is a fresh one.
    const same = servicesFilled && servicesFilled.path === location.pathname && (!editor || servicesFilled.editor === editor);
    const before = same ? servicesFilled.text : null;
    if (before !== null) return { state: before === text ? "already" : "changed" };
    return { state: text ? "no-token" : "none" };
  }
  if (!text) return { state: "empty" };
  // Last first, so the offsets of the earlier placeholders still hold.
  for (const start of starts.reverse()) replaceServicesRange(nodes, start, start + SERVICES_TOKEN.length, text.split("\n"));
  servicesFilled = { path: location.pathname, editor, text };
  return { state: "filled" };
}

const SERVICES_FILL_MESSAGES = {
  filled: " Description of services filled.",
  empty: ` ${SERVICES_TOKEN} was left in the contract: the description is empty.`,
  already: " The description of services was already filled on this page.",
  changed: " The description of services was already filled on this page and has changed here since. Edit it in the contract by hand. Or start again from a fresh template.",
  "no-token": ` Description of services NOT filled: this contract has no ${SERVICES_TOKEN} placeholder. ${SERVICES_TEMPLATE_HELP} For this contract, paste the description in by hand.`,
  ambiguous: "⚠ More than one editable area on this page holds contract placeholders, so nothing was filled. Open the contract body on its own and try again.",
};

// The fill's outcome in one line: the other fields first, then the
// description, so a contract with no placeholder for it never reads as done.
function showContractFillStatus(filled, services) {
  const el = document.getElementById("sxs-fill-status");
  if (services.state === "ambiguous") {
    if (el) { el.textContent = SERVICES_FILL_MESSAGES.ambiguous; el.style.color = SERVICES_WARNING_COLOR; }
    return;
  }
  showFillStatus(filled + (services.state === "filled" ? 1 : 0));
  if (!el || !SERVICES_FILL_MESSAGES[services.state]) return;
  el.textContent += SERVICES_FILL_MESSAGES[services.state];
  if (services.state === "no-token" || services.state === "changed") el.style.color = SERVICES_WARNING_COLOR;
}
