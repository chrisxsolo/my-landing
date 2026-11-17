// SoloXSnaps → PixiSet Autofill: the contract preview (click-to-edit fields
// with the retainer re-split) and the [PLACEHOLDER] replacement inside
// Pixieset's contenteditable contract body. The Description of Services
// box and its placeholder live in contractServices.js.

function buildContractPreview(inq, price) {
  const rows = [
    ["SESSION_TYPE",     (SERVICE_LABELS[price.service] || "Photo Session").replace(/ Session$/, "")],
    ["SESSION_DATE",     inq._sessionDate || inq.date_in_mind || "TBD"],
    ["SESSION_TIME",     inq._sessionTime || "TBD"],
    ["SESSION_LOCATION", expandSchoolName(inq._location || inq.school || "") || "Bay Area, CA"],
    ["TOTAL_FEE",        fmt(price.subtotal)],
    ["RETAINER",         fmt(price.deposit)],
    ["REMAINING",        fmt(price.remaining)],
    ["FINAL_DATE",       inq._sessionDate || inq.date_in_mind || "TBD"],
  ];
  const hint = price.reviewHint
    ? `<div class="sxs-field-row sxs-warning sxs-price-hint">${esc(price.reviewHint)}</div>`
    : "";
  // How the total was reached (an add-on the thread settled): information, not a warning.
  const note = price.priceNote
    ? `<div class="sxs-field-row sxs-price-hint sxs-price-note">${esc(price.priceNote)}</div>`
    : "";
  // A date that is requested, undecided or only on the form is filled in for review and says so.
  const dateText = contractDateNote(inq);
  const dateNote = dateText ? `<div class="sxs-field-row sxs-warning sxs-date-note">${esc(dateText)}</div>` : "";
  const confirm = contractNeedsConfirmation(inq, price)
    ? `<label class="sxs-confirm-row"><input type="checkbox" id="sxs-contract-confirm" /> I've checked the flagged items</label>`
    : "";
  return hint + note + dateNote + rows.map(([k, v]) => `
    <div class="sxs-field-row">
      <span class="sxs-field-label">[${k}]</span>
      <input class="sxs-field-input" data-key="${k}" value="${esc(v)}" spellcheck="false" />
    </div>
  `).join("") + confirm;
}

function parseMoney(v) {
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// When the total is edited, re-split retainer/remaining 50/50.
// When the retainer is edited, remaining = total − retainer.
function wireContractPreview() {
  const get = key => document.querySelector(`#sxs-preview-rows input[data-key="${key}"]`);
  const total = get("TOTAL_FEE"), retainer = get("RETAINER"), remaining = get("REMAINING");
  if (!total || !retainer || !remaining) return;

  total.addEventListener("input", () => {
    const t = parseMoney(total.value);
    if (t == null) return;
    retainer.value  = fmt(t / 2);
    remaining.value = fmt(t / 2);
  });
  retainer.addEventListener("input", () => {
    const t = parseMoney(total.value);
    const r = parseMoney(retainer.value);
    if (t == null || r == null) return;
    remaining.value = fmt(t - r);
  });
}

function readContractPreview() {
  const vals = {};
  document.querySelectorAll('#sxs-preview-rows input[data-key]').forEach(el => {
    vals[el.dataset.key] = el.value.trim();
  });
  return vals;
}

const CONTRACT_TOKEN_RE = /\[(?:SESSION_(?:TYPE|DATE|TIME|LOCATION)|TOTAL_FEE|RETAINER|REMAINING|FINAL_DATE|DESCRIPTION_OF_SERVICES)\]|portrait\s+session\s+of\s/i;

// The contract body: the one editable area outside this panel that holds a
// placeholder (or the "portrait session of …" line). No such area, or more
// than one, is reported: an arbitrary editable box is never filled.
function locateContractEditor() {
  const holders = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter(el => typeof el.textContent === "string" && !(el.closest && el.closest("#sxs-panel")) && CONTRACT_TOKEN_RE.test(el.textContent));
  // An editable area nested in another is one editor, counted at its innermost.
  const innermost = holders.filter(el => !holders.some(other => other !== el && el.contains(other)));
  if (innermost.length > 1) return { editor: null, problem: "ambiguous" };
  return { editor: innermost[0] || null, problem: innermost.length ? null : "none" };
}

// What each placeholder becomes: the (possibly edited) preview value first.
function contractReplacements(inq, price) {
  const edited = readContractPreview();
  // An edited figure, else the calculated one, else the placeholder stays
  // put (a group the rate card does not price has no calculated figure).
  const money = (raw, fallback, placeholder) => {
    const n = parseMoney(raw);
    if (n != null) return fmt(n);
    return fallback == null ? placeholder : fmt(fallback);
  };

  const sessionDate     = edited.SESSION_DATE || inq._sessionDate || inq.date_in_mind || "TBD";
  const sessionTime     = edited.SESSION_TIME || inq._sessionTime || "TBD";
  const sessionLocation = edited.SESSION_LOCATION || expandSchoolName(inq._location || inq.school || "") || "Bay Area, CA";
  const sessionType = edited.SESSION_TYPE || (SERVICE_LABELS[price.service] || "Photo Session").replace(/ Session$/, "");

  const replacements = [
    { pattern: /\[SESSION_TYPE\]/g,     value: sessionType },
    { pattern: /\[SESSION_DATE\]/g,     value: sessionDate },
    { pattern: /\[SESSION_TIME\]/g,     value: sessionTime },
    { pattern: /\[SESSION_LOCATION\]/g, value: sessionLocation },
    { pattern: /\[TOTAL_FEE\]/g,        value: money(edited.TOTAL_FEE, price.subtotal, "[TOTAL_FEE]") },
    { pattern: /\[RETAINER\]/g,         value: money(edited.RETAINER, price.deposit, "[RETAINER]") },
    { pattern: /\[REMAINING\]/g,        value: money(edited.REMAINING, price.remaining, "[REMAINING]") },
    { pattern: /\[FINAL_DATE\]/g,       value: edited.FINAL_DATE || sessionDate },
  ];
  return { replacements, sessionType };
}

function fillContract(inq, price) {
  const { replacements, sessionType } = contractReplacements(inq, price);
  const { editor, problem } = locateContractEditor();
  if (problem === "ambiguous") { showContractFillStatus(0, { state: "ambiguous" }); return; }

  let filled = 0;
  const textNodes = editor ? contractTextNodes(editor) : [];
  for (const node of textNodes) {
    let text = node.nodeValue;
    let changed = false;
    for (const { pattern, value } of replacements) {
      const next = text.replace(pattern, () => value);
      if (next !== text) { text = next; changed = true; filled++; }
    }
    if (changed) {
      node.nodeValue = text;
      node.parentElement?.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  filled += replaceContractSessionType(textNodes, sessionType);
  // Last, so nothing typed into the description is read as another placeholder.
  showContractFillStatus(filled, fillServicesToken(editor));
}
