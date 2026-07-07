// SoloXSnaps → PixiSet Autofill content script
// Injects a floating panel on studio.pixieset.com pages.
// Fetches recent inquiries from Supabase and fills in invoice/contract fields.

const API_BASE   = "https://www.soloxsnaps.com";
const API_SECRET = "898b46208d6a8e27b1f65f052f7a4d82a47dc9294eed1a7d037b0d8c3abc7032";

// ── SCHOOL NAME EXPANSION ─────────────────────────────────────────────────────
const SCHOOL_FULL_NAMES = {
  "uc-berkeley":  "UC Berkeley",
  "sjsu":         "San Jose State University",
  "sf-state":     "San Francisco State University",
  "usf":          "University of San Francisco",
  "csueb":        "California State University, East Bay",
  "santa-clara":  "Santa Clara University",
  "stanford":     "Stanford University",
};

function detectSchoolKey(schoolText = "") {
  const s = schoolText.toLowerCase();
  if (s.includes("berkeley"))                          return "uc-berkeley";
  if (s.includes("san jose") || s.includes("sjsu"))   return "sjsu";
  if (s.includes("sf state") || s.includes("san francisco state")) return "sf-state";
  if (s.includes("usf") || s.includes("university of san francisco")) return "usf";
  if (s.includes("east bay") || s.includes("csueb"))  return "csueb";
  if (s.includes("santa clara"))                       return "santa-clara";
  if (s.includes("stanford") || s.includes("palo alto")) return "stanford";
  return null;
}

function expandSchoolName(schoolText = "") {
  const key = detectSchoolKey(schoolText);
  return key ? SCHOOL_FULL_NAMES[key] ?? schoolText : schoolText;
}

// ── PRICING (mirrors lib/pricingCatalog.ts) ──────────────────────────────────
const GRAD_HOURLY_RATE = 350;
const GROUP_RATES = { 2: 300, 3: 275, 4: 250, 5: 225 };
const GROUP_RATE_6_PLUS = 200;
const TRAVEL_FEES = {
  "sf-state": 0, "usf": 0, "sf-other": 0,
  "uc-berkeley": 35, "csueb": 30, "sjsu": 75, "santa-clara": 70, "stanford": 45,
};

// Flat per-session rates for non-graduation services
const SERVICE_FLAT_RATES = {
  "family":          350, // Family Session (30 min)
  "extended-family": 500, // Extended Family Session (60 min)
  "couples":         450, // 1-Hour Couples Session
  "engagement":      650,
  "proposal":        750,
};

const SERVICE_LABELS = {
  "family":          "Family Session",
  "extended-family": "Extended Family Session",
  "couples":         "Couples Session",
  "engagement":      "Engagement Session",
  "proposal":        "Proposal Session",
  "graduation":      "Graduation Session",
};

function detectServiceType(inq) {
  // Email-detected type wins if it's one we price
  const fromEmail = String(inq._serviceType || "").toLowerCase();
  if (SERVICE_FLAT_RATES[fromEmail] != null || fromEmail === "graduation") return fromEmail;

  const t = `${inq.session_type || ""} ${inq.message || ""}`.toLowerCase().replace(/-/g, " ");
  if (t.includes("proposal"))        return "proposal";
  if (t.includes("engagement"))      return "engagement";
  if (t.includes("couple") || t.includes("anniversary")) return "couples";
  if (t.includes("extended family")) return "extended-family";
  if (t.includes("family"))          return "family";
  return "graduation";
}

function calcPrice(inquiry) {
  const service = detectServiceType(inquiry);
  const people = parseInt(inquiry.people || "1") || 1;
  let sessionBase, travelFee = null, schoolKey = null;

  if (SERVICE_FLAT_RATES[service] != null) {
    sessionBase = SERVICE_FLAT_RATES[service];
  } else {
    sessionBase = people <= 1
      ? GRAD_HOURLY_RATE
      : (GROUP_RATES[people] ?? GROUP_RATE_6_PLUS) * people;
    schoolKey = detectSchoolKey(inquiry._school || inquiry.school || inquiry.message || "");
    if (schoolKey != null && TRAVEL_FEES[schoolKey] != null) travelFee = TRAVEL_FEES[schoolKey];
  }

  // A price quoted/agreed in the email thread overrides the calculator
  const agreed = Number.isFinite(inquiry._agreedTotal) ? inquiry._agreedTotal : null;
  if (agreed != null) { sessionBase = agreed; travelFee = null; }
  const subtotal = sessionBase + (travelFee ?? 0);
  const deposit  = subtotal / 2;

  return {
    sessionBase, travelFee,
    subtotal, deposit, remaining: subtotal - deposit,
    people, schoolKey, service, priceFromEmail: agreed != null,
  };
}

function fmt(n) { return `$${Number(n).toFixed(2)}`; }

// ── PANEL UI ─────────────────────────────────────────────────────────────────
let panel = null;

function getPageType() {
  const path = location.pathname;
  if (path.endsWith("/invoices/create") || path.endsWith("/invoices/new")) return "invoice-create";
  if (path.includes("/invoices/")) return "invoice";
  if (path.endsWith("/contracts/create") || path.endsWith("/contracts/new")) return "contract-create";
  if (path.includes("/contracts/")) return "contract";
  return "other";
}

function createPanel() {
  if (panel) return;

  panel = document.createElement("div");
  panel.id = "sxs-panel";
  panel.innerHTML = `
    <div id="sxs-header">
      <span>⚡ SoloXSnaps Autofill</span>
      <button id="sxs-close">✕</button>
    </div>
    <div id="sxs-body">
      <div id="sxs-loading">Loading inquiries…</div>
      <div id="sxs-list" style="display:none">
        <input id="sxs-search" type="text" placeholder="Search by name or email…" autocomplete="off" />
        <div id="sxs-rows"></div>
      </div>
      <div id="sxs-detail" style="display:none"></div>
      <div id="sxs-error" style="display:none"></div>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById("sxs-close").addEventListener("click", () => {
    panel.style.display = "none";
  });

  loadInquiries();
}

function showPanel() {
  if (!panel) { createPanel(); return; }
  panel.style.display = "flex";
  loadInquiries();
}

async function loadInquiries() {
  setView("loading");
  try {
    const res = await fetch(
      `${API_BASE}/api/extension/inquiries`,
      { headers: { "x-extension-secret": API_SECRET } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    renderList(rows);
  } catch (err) {
    showError(`Failed to load: ${err.message}`);
  }
}

function renderList(inquiries) {
  if (!inquiries.length) {
    document.getElementById("sxs-rows").innerHTML = "<p style='color:#888;font-size:12px'>No inquiries found.</p>";
    setView("list");
    return;
  }

  function renderRows(filtered) {
    const rows = document.getElementById("sxs-rows");
    if (!filtered.length) {
      rows.innerHTML = "<p style='color:#888;font-size:12px'>No matches.</p>";
      return;
    }
    rows.innerHTML = filtered.map(inq => {
      const date = new Date(inq.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const price = calcPrice(inq);
      return `
        <div class="sxs-inq-row" data-id="${inq.id}">
          <div class="sxs-inq-name">${esc(inq.name)}</div>
          <div class="sxs-inq-meta">${esc(inq.email)} · ${date}</div>
          <div class="sxs-inq-price">${fmt(price.subtotal)}${price.travelFee ? ` (+${fmt(price.travelFee)} travel)` : ""}</div>
        </div>
      `;
    }).join("");
    rows.querySelectorAll(".sxs-inq-row").forEach(row => {
      row.addEventListener("click", () => {
        const inq = inquiries.find(i => String(i.id) === row.dataset.id);
        if (inq) renderDetail(inq);
      });
    });
  }

  renderRows(inquiries);

  const search = document.getElementById("sxs-search");
  if (search) {
    search.value = "";
    search.oninput = () => {
      const q = search.value.toLowerCase().trim();
      renderRows(q ? inquiries.filter(i => i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q)) : inquiries);
    };
  }

  setView("list");
}

async function renderDetail(inq) {
  const pageType = getPageType();
  const price = calcPrice(inq);
  const detail = document.getElementById("sxs-detail");

  // Show skeleton while detecting date from Gmail
  const isCreatePage = pageType === "contract-create" || pageType === "invoice-create";
  const btnLabel = isCreatePage ? `Fill client name → Next` : `Fill ${pageType} fields`;

  detail.innerHTML = `
    <button id="sxs-back" style="margin-bottom:10px">← Back</button>
    <div class="sxs-section-title">${esc(inq.name)} · ${pageType.replace("-create", "")}</div>
    <div id="sxs-date-status" style="font-size:11px;color:#888;margin-bottom:8px">${isCreatePage ? "" : "🔍 Checking Gmail for confirmed details…"}</div>
    <div id="sxs-preview-rows"></div>
    <button id="sxs-fill" class="sxs-fill-btn" ${isCreatePage ? "" : "disabled"}>${btnLabel}</button>
    <div id="sxs-fill-status"></div>
  `;
  detail.querySelector("#sxs-back").addEventListener("click", () => setView("list"));
  setView("detail");

  // Skip Gmail scan on create pages — we only need the client name there
  let sessionDate   = inq.date_in_mind || "TBD";
  let sessionTime   = "TBD";
  let sessionSchool = inq.school || inq.message || "";
  let serviceType   = null;
  let agreedTotal   = null;

  if (isCreatePage) {
    const previewRows = document.getElementById("sxs-preview-rows");
    if (previewRows) previewRows.innerHTML = `<div class="sxs-field-row"><span class="sxs-field-label">Client</span><span class="sxs-field-val">${esc(inq.name)}</span></div><div class="sxs-field-row"><span class="sxs-field-label">Email</span><span class="sxs-field-val">${esc(inq.email)}</span></div>`;
    const fillBtn = detail.querySelector("#sxs-fill");
    if (fillBtn) { fillBtn.disabled = false; fillBtn.addEventListener("click", () => fillClientInput(inq)); }
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/extension/detect-date`, {
      method: "POST",
      headers: { "x-extension-secret": API_SECRET, "content-type": "application/json" },
      body: JSON.stringify({ inquiry_id: inq.id }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.readable)     sessionDate   = d.readable;
      if (d.time)         sessionTime   = d.time;
      if (d.location)     sessionSchool = d.location;
      if (d.session_type) serviceType   = d.session_type;
      if (d.total_fee != null && Number.isFinite(Number(d.total_fee))) agreedTotal = Number(d.total_fee);
      const confidence = d.confidence === "high" ? "✓ Confirmed in email" : d.confidence === "medium" ? "~ Likely from email" : "~ From inquiry form";
      const bits = [confidence];
      if (serviceType)         bits.push(SERVICE_LABELS[serviceType] || serviceType);
      if (agreedTotal != null) bits.push(`$${agreedTotal} agreed in email`);
      const src = document.getElementById("sxs-date-status");
      if (src) src.textContent = bits.join(" · ");
    }
  } catch {
    const src = document.getElementById("sxs-date-status");
    if (src) src.textContent = "Could not reach Gmail — using inquiry date";
  }

  const enriched     = { ...inq, _sessionDate: sessionDate, _sessionTime: sessionTime, _school: sessionSchool, _serviceType: serviceType, _agreedTotal: agreedTotal };
  const enrichedPrice = calcPrice(enriched); // recalc with detected school for travel fee
  const previewRows  = document.getElementById("sxs-preview-rows");
  if (previewRows) {
    previewRows.innerHTML = pageType === "invoice"
      ? buildInvoicePreview(enriched, enrichedPrice)
      : buildContractPreview(enriched, enrichedPrice);
    if (pageType !== "invoice") wireContractPreview();
  }

  const fillBtn = detail.querySelector("#sxs-fill");
  if (fillBtn) {
    fillBtn.disabled = false;
    fillBtn.addEventListener("click", () => {
      if (pageType === "invoice" || pageType === "invoice-create") fillInvoice(enriched, enrichedPrice);
      else if (pageType === "contract-create") fillClientInput(enriched);
      else fillContract(enriched, enrichedPrice);
    });
  }
}

function buildInvoicePreview(inq, price) {
  const serviceLabel = SERVICE_LABELS[price.service] || "Photo Session";
  const rows = [
    ["Session item", `${serviceLabel} (${inq.school || "Bay Area"})`],
    ["Price", fmt(price.sessionBase)],
    ...(price.travelFee ? [["Travel Fee", fmt(price.travelFee)]] : []),
    ["Total", fmt(price.subtotal)],
    ["Deposit (50%)", fmt(price.deposit)],
    ["Due date", inq.date_in_mind || "—"],
  ];
  return rows.map(([k, v]) => `
    <div class="sxs-field-row">
      <span class="sxs-field-label">${k}</span>
      <span class="sxs-field-val">${esc(v)}</span>
    </div>
  `).join("");
}

function buildContractPreview(inq, price) {
  const rows = [
    ["SESSION_DATE",     inq._sessionDate || inq.date_in_mind || "TBD"],
    ["SESSION_TIME",     inq._sessionTime || "TBD"],
    ["SESSION_LOCATION", expandSchoolName(inq._school || inq.school || "") || "Bay Area, CA"],
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

// ── FILL LOGIC ────────────────────────────────────────────────────────────────

function fillInvoice(inq, price) {
  let filled = 0;

  // Item name field (first line-item input)
  filled += setInputByPlaceholder("Item name", SERVICE_LABELS[price.service] || "Photo Session");
  filled += setInputByPlaceholder("Item description", `${inq.school || "Bay Area"} · ${inq.date_in_mind || ""}`);

  // Price field — find inputs near a "$" label
  const priceInputs = [...document.querySelectorAll('input[type="text"], input[type="number"]')]
    .filter(el => {
      const label = el.closest("td,div")?.previousElementSibling?.textContent || "";
      const placeholder = el.placeholder || "";
      return label.includes("$") || placeholder.includes("0.00") || el.closest("[class*='price']");
    });

  if (priceInputs[0]) { setNativeValue(priceInputs[0], String(price.sessionBase)); filled++; }

  // Notes
  filled += setTextareaByPlaceholder("Thank you", `Thank you for booking, ${inq.name}! Looking forward to your session.`);

  // Travel fee row — if a second item row exists
  if (price.travelFee) {
    const allItemNames = document.querySelectorAll('input[placeholder="Item name"]');
    if (allItemNames[1]) { setNativeValue(allItemNames[1], "Travel Fee"); filled++; }
    if (priceInputs[1])  { setNativeValue(priceInputs[1], String(price.travelFee)); filled++; }
  }

  showFillStatus(filled);
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
  const sessionLocation = edited.SESSION_LOCATION || expandSchoolName(inq._school || inq.school || "") || "Bay Area, CA";

  const replacements = [
    { pattern: /\[SESSION_DATE\]/g,     value: sessionDate },
    { pattern: /\[SESSION_TIME\]/g,     value: sessionTime },
    { pattern: /\[SESSION_LOCATION\]/g, value: sessionLocation },
    { pattern: /\[TOTAL_FEE\]/g,        value: money(edited.TOTAL_FEE, price.subtotal) },
    { pattern: /\[RETAINER\]/g,         value: money(edited.RETAINER, price.deposit) },
    { pattern: /\[REMAINING\]/g,        value: money(edited.REMAINING, price.remaining) },
    { pattern: /\[FINAL_DATE\]/g,       value: edited.FINAL_DATE || sessionDate },
  ];

  const smartFieldMap = {};

  const editableArea = document.querySelector('[contenteditable="true"]');
  if (!editableArea) { showFillStatus(0); return; }

  let filled = 0;

  // 1. Replace [$XXXX]-style plain text nodes
  const walker = document.createTreeWalker(editableArea, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const node of textNodes) {
    let text = node.nodeValue;
    let changed = false;
    for (const { pattern, value } of replacements) {
      const next = text.replace(pattern, value);
      if (next !== text) { text = next; changed = true; filled++; }
    }
    if (changed) {
      node.nodeValue = text;
      node.parentElement?.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // 2. Replace PixiSet smart field spans (teal underlined clickable elements)
  // These are rendered as <span> or <a> with the label as their text content
  const allSpans = editableArea.querySelectorAll("span, a");
  for (const el of allSpans) {
    const label = el.textContent.trim();
    if (smartFieldMap[label]) {
      el.textContent = smartFieldMap[label];
      el.removeAttribute("data-smart-field");
      el.style.textDecoration = "none";
      el.style.color = "inherit";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      filled++;
    }
  }

  showFillStatus(filled);
}

async function fillClientInput(inq) {
  const input = document.querySelector('input[placeholder*="name or email"], input[placeholder*="name"]')
    || document.querySelector('input[type="text"]');
  if (!input) { showFillStatus(0); return; }

  const statusEl = document.getElementById("sxs-fill-status");

  // Clear existing value first
  input.focus();
  input.select();
  document.execCommand("selectAll");
  document.execCommand("delete");

  // Type each character one at a time — this is what React's synthetic event system responds to
  for (const char of inq.email) {
    const opts = { key: char, char, keyCode: char.charCodeAt(0), which: char.charCodeAt(0), bubbles: true, cancelable: true };
    input.dispatchEvent(new KeyboardEvent("keydown",  opts));
    input.dispatchEvent(new KeyboardEvent("keypress", opts));
    // Use execCommand to actually insert the character into the DOM
    document.execCommand("insertText", false, char);
    input.dispatchEvent(new KeyboardEvent("keyup", opts));
    await new Promise(r => setTimeout(r, 20));
  }

  if (statusEl) statusEl.textContent = `✓ Typed — now click Next in PixiSet`;

  // Attempt to click Next
  setTimeout(() => {
    const nextBtn = [...document.querySelectorAll("button")].find(b => /^next$/i.test(b.textContent.trim()));
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.click();
      if (statusEl) statusEl.textContent = "✓ Clicked Next — open Autofill again on the contract page";
    }
  }, 500);
}

// ── DOM HELPERS ───────────────────────────────────────────────────────────────

function setNativeValue(el, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    el.tagName === "INPUT" ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  if (nativeSetter) nativeSetter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setInputByPlaceholder(placeholder, value) {
  const el = document.querySelector(`input[placeholder*="${placeholder}"]`);
  if (!el) return 0;
  setNativeValue(el, value);
  return 1;
}

function setTextareaByPlaceholder(placeholder, value) {
  const el = document.querySelector(`textarea[placeholder*="${placeholder}"]`);
  if (!el) return 0;
  setNativeValue(el, value);
  return 1;
}

function showFillStatus(count) {
  const el = document.getElementById("sxs-fill-status");
  if (!el) return;
  el.textContent = count > 0
    ? `✓ Filled ${count} field${count !== 1 ? "s" : ""}. Review and adjust as needed.`
    : "⚠ No fillable fields found on this page yet. Scroll to the fields and try again.";
  el.style.color = count > 0 ? "#26a69a" : "#e67e22";
}

function setView(view) {
  document.getElementById("sxs-loading").style.display = view === "loading" ? "block" : "none";
  document.getElementById("sxs-list").style.display    = view === "list"    ? "block" : "none";
  document.getElementById("sxs-detail").style.display  = view === "detail"  ? "block" : "none";
  document.getElementById("sxs-error").style.display   = view === "error"   ? "block" : "none";
}

function showError(msg) {
  const el = document.getElementById("sxs-error");
  el.textContent = msg;
  setView("error");
}

function esc(str = "") {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── TRIGGER BUTTON ────────────────────────────────────────────────────────────

function injectTriggerButton() {
  if (document.getElementById("sxs-trigger")) return;
  const btn = document.createElement("button");
  btn.id = "sxs-trigger";
  btn.textContent = "⚡ Autofill";
  btn.addEventListener("click", showPanel);
  document.body.appendChild(btn);
}

// Inject after a short delay to let PixiSet's React app mount
setTimeout(injectTriggerButton, 1500);

// Also re-inject on SPA navigation (PixiSet uses client-side routing)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(injectTriggerButton, 1500);
  }
}).observe(document.body, { childList: true, subtree: true });
