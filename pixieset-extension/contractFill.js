// SoloXSnaps → PixiSet Autofill: the contract preview (click-to-edit fields
// with the retainer re-split) and the [PLACEHOLDER] replacement inside
// Pixieset's contenteditable contract body.

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
  return rows.map(([k, v]) => `
    <div class="sxs-field-row">
      <span class="sxs-field-label">[${k}]</span>
      <input class="sxs-field-input" data-key="${k}" value="${esc(v)}" spellcheck="false" />
    </div>
  `).join("");
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

function fillContract(inq, price) {
  // Prefer values from the (possibly user-edited) preview inputs
  const edited = readContractPreview();
  const money = (raw, fallback) => {
    const n = parseMoney(raw);
    return n != null ? fmt(n) : fmt(fallback);
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
    { pattern: /\[TOTAL_FEE\]/g,        value: money(edited.TOTAL_FEE, price.subtotal) },
    { pattern: /\[RETAINER\]/g,         value: money(edited.RETAINER, price.deposit) },
    { pattern: /\[REMAINING\]/g,        value: money(edited.REMAINING, price.remaining) },
    { pattern: /\[FINAL_DATE\]/g,       value: edited.FINAL_DATE || sessionDate },
  ];

  const editableArea = document.querySelector('[contenteditable="true"]');
  if (!editableArea) { showFillStatus(0); return; }

  let filled = 0;

  // Replace [$XXXX]-style plain text nodes
  const walker = document.createTreeWalker(editableArea, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

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
  showFillStatus(filled);
}
