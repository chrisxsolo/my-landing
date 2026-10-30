// SoloXSnaps → PixiSet Autofill content script
// Injects a floating panel on studio.pixieset.com pages.
// Fetches recent inquiries from SoloXSnaps and fills in invoice/contract fields.
//
// Invoices are priced by /api/extension/invoice-draft (the site's own pricing
// catalog and travel resolver); the browser only shows that draft for review
// and writes it into Pixieset. Contract previews still use extensionPricing.js.

const API_BASE   = "https://www.soloxsnaps.com";
const API_SECRET = "898b46208d6a8e27b1f65f052f7a4d82a47dc9294eed1a7d037b0d8c3abc7032";

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

  openPanelFlow();
}

function showPanel() {
  if (!panel) { createPanel(); return; }
  panel.style.display = "flex";
  openPanelFlow();
}

/** On the invoice editor, a client chosen on the previous page is restored; everywhere else, the list. */
async function openPanelFlow() {
  if (getPageType() === "invoice") {
    const selection = await loadInvoiceSelection();
    if (selection) { loadInvoiceDraft(selection.inquiryId, { restored: true }); return; }
  }
  loadInquiries();
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "x-extension-secret": API_SECRET, "content-type": "application/json", ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ? `${body.error} (HTTP ${res.status})` : `HTTP ${res.status}`);
  return body;
}

async function loadInquiries() {
  setView("loading");
  try {
    const [rows, totals] = await Promise.all([apiFetch("/api/extension/inquiries"), loadDraftTotals()]);
    renderList(rows, totals);
  } catch (err) {
    showError(`Failed to load: ${err.message}`);
  }
}

function renderList(inquiries, draftTotals = {}) {
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
      return `
        <div class="sxs-inq-row" data-id="${inq.id}">
          <div class="sxs-inq-name">${esc(inq.name)}</div>
          <div class="sxs-inq-meta">${esc(inq.email)} · ${date}</div>
          <div class="sxs-inq-price">${esc(describeListPrice(draftTotals[String(inq.id)]))}</div>
        </div>
      `;
    }).join("");
    rows.querySelectorAll(".sxs-inq-row").forEach(row => {
      row.addEventListener("click", () => {
        const inq = inquiries.find(i => String(i.id) === row.dataset.id);
        if (inq) onInquiryChosen(inq);
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

function onInquiryChosen(inq) {
  const pageType = getPageType();
  if (pageType === "invoice-create") { renderClientSelect(inq); return; }
  if (pageType === "invoice") { loadInvoiceDraft(inq.id); return; }
  renderDetail(inq);
}

function renderDetailShell(title, status, btnLabel, btnDisabled) {
  const detail = document.getElementById("sxs-detail");
  detail.innerHTML = `
    <button id="sxs-back" style="margin-bottom:10px">← Back</button>
    <div class="sxs-section-title">${title}</div>
    <div id="sxs-date-status" style="font-size:11px;color:#888;margin-bottom:8px">${status}</div>
    <div id="sxs-preview-rows"></div>
    <button id="sxs-fill" class="sxs-fill-btn" ${btnDisabled ? "disabled" : ""}>${btnLabel}</button>
    <div id="sxs-fill-status"></div>
  `;
  detail.querySelector("#sxs-back").addEventListener("click", () => loadInquiries());
  setView("detail");
  return detail;
}

// ── INVOICES ─────────────────────────────────────────────────────────────────

/** Invoice create page: type the client's email and let the user confirm Pixieset's match. */
function renderClientSelect(inq) {
  const detail = renderDetailShell(`${esc(inq.name)} · invoice client`, "", "Select this client in Pixieset", false);
  document.getElementById("sxs-preview-rows").innerHTML =
    `<div class="sxs-field-row"><span class="sxs-field-label">Client</span><span class="sxs-field-val">${esc(inq.name)}</span></div>` +
    `<div class="sxs-field-row"><span class="sxs-field-label">Email</span><span class="sxs-field-val">${esc(inq.email)}</span></div>`;
  detail.querySelector("#sxs-fill").addEventListener("click", () => selectPixiesetClient(inq));
}

async function selectPixiesetClient(inq) {
  const statusEl = document.getElementById("sxs-fill-status");
  const input = document.querySelector('input[placeholder*="name or email"], input[placeholder*="name"]')
    || document.querySelector('input[type="text"]');
  if (!input) { showFillStatus(0); return; }

  await saveInvoiceSelection(inq.id, inq.email);
  await typeIntoInput(input, inq.email);
  await new Promise(r => setTimeout(r, 700));

  const candidates = [...document.querySelectorAll('[role="option"], li, [class*="option" i], [class*="suggestion" i], [class*="result" i]')]
    .map(el => ({ el, text: el.textContent || "" }));
  const match = chooseClientMatch(candidates, inq.email);
  if (!match) {
    statusEl.textContent = `⚠ Pixieset shows no single match for ${inq.email}. Pick the client by hand, then click Next — the invoice page will remember ${inq.name}.`;
    statusEl.style.color = "#e67e22";
    return;
  }
  match.el.click();
  statusEl.textContent = `✓ Selected ${inq.email}. Click Next; the invoice page will load ${inq.name}'s draft.`;
  statusEl.style.color = "#26a69a";
}

async function loadInvoiceDraft(inquiryId, { restored = false } = {}) {
  setView("loading");
  document.getElementById("sxs-loading").textContent = "🔍 Pricing the invoice from the inquiry and Gmail…";
  try {
    const { draft } = await apiFetch("/api/extension/invoice-draft", { method: "POST", body: JSON.stringify({ inquiry_id: inquiryId }) });
    await rememberDraftTotal(inquiryId, draft);
    renderInvoiceDraft(draft, restored);
  } catch (err) {
    showError(`Could not build the invoice draft: ${err.message}`);
  } finally {
    document.getElementById("sxs-loading").textContent = "Loading inquiries…";
  }
}

function renderInvoiceDraft(draft, restored) {
  const status = restored ? "Restored the client you picked on the previous page." : "";
  const detail = renderDetailShell(`${esc(draft.client.name)} · invoice`, status, "Fill invoice", false);
  document.getElementById("sxs-preview-rows").innerHTML = buildInvoicePreview(draft);
  const fillBtn = detail.querySelector("#sxs-fill");
  const syncButton = () => { fillBtn.disabled = !invoiceFillAllowed(draft); };
  syncButton();
  detail.querySelector("#sxs-review-confirm")?.addEventListener("change", syncButton);
  fillBtn.addEventListener("click", () => runInvoiceFill(draft));
}

async function runInvoiceFill(draft) {
  if (!invoiceFillAllowed(draft)) return;
  const reviewed = readInvoicePreview(draft);
  const total = document.getElementById("sxs-invoice-total");
  if (total) total.textContent = reviewed.pricing.totalCents === null ? "—" : fmtCents(reviewed.pricing.totalCents);
  const { filled, skipped } = await fillInvoiceFromDraft(reviewed);
  showFillStatus(filled);
  const statusEl = document.getElementById("sxs-fill-status");
  if (statusEl && skipped.length) statusEl.textContent += ` Not found on this page: ${skipped.join(", ")}.`;
  if (filled > 0) await clearInvoiceSelection();
}

// ── CONTRACTS ────────────────────────────────────────────────────────────────

async function renderDetail(inq) {
  const pageType = getPageType();
  const price = calcPrice(inq);
  const isCreatePage = pageType === "contract-create";
  const btnLabel = isCreatePage ? `Fill client name → Next` : `Fill ${pageType} fields`;
  const detail = renderDetailShell(
    `${esc(inq.name)} · ${pageType.replace("-create", "")}`,
    isCreatePage ? "" : "🔍 Checking Gmail for confirmed details…",
    btnLabel, !isCreatePage,
  );

  if (isCreatePage) {
    document.getElementById("sxs-preview-rows").innerHTML =
      `<div class="sxs-field-row"><span class="sxs-field-label">Client</span><span class="sxs-field-val">${esc(inq.name)}</span></div>` +
      `<div class="sxs-field-row"><span class="sxs-field-label">Email</span><span class="sxs-field-val">${esc(inq.email)}</span></div>`;
    detail.querySelector("#sxs-fill").addEventListener("click", () => fillClientInput(inq));
    return;
  }

  // Skip Gmail scan on create pages — we only need the client name there
  let sessionDate     = formatSessionDate(inq.date_in_mind) || inq.date_in_mind || "TBD";
  let sessionTime     = "TBD";
  // The shoot location from the thread stays separate from the school.
  let sessionLocation = "";
  let serviceType     = null;
  let agreedTotal     = null;

  try {
    const d = await apiFetch("/api/extension/detect-date", { method: "POST", body: JSON.stringify({ inquiry_id: inq.id }) });
    if (d.readable)     sessionDate     = formatSessionDate(d.readable) || d.readable;
    if (d.time)         sessionTime     = d.time;
    if (d.location)     sessionLocation = d.location;
    if (d.session_type) serviceType     = d.session_type;
    if (d.total_fee != null && Number.isFinite(Number(d.total_fee))) agreedTotal = Number(d.total_fee);
    const confidence = d.confidence === "high" ? "✓ Confirmed in email" : d.confidence === "medium" ? "~ Likely from email" : "~ From inquiry form";
    const bits = [confidence];
    if (serviceType)         bits.push(SERVICE_LABELS[serviceType] || serviceType);
    if (agreedTotal != null) bits.push(`$${agreedTotal} agreed in email`);
    document.getElementById("sxs-date-status").textContent = bits.join(" · ");
  } catch (err) {
    console.error("SoloXSnaps detect-date failed", err);
    document.getElementById("sxs-date-status").textContent = `Could not reach Gmail (${err.message}) — using inquiry date`;
  }

  const enriched      = { ...inq, _sessionDate: sessionDate, _sessionTime: sessionTime, _location: sessionLocation, _serviceType: serviceType, _agreedTotal: agreedTotal };
  const enrichedPrice = calcPrice(enriched); // recalc with the detected location for the travel fee
  document.getElementById("sxs-preview-rows").innerHTML = buildContractPreview(enriched, enrichedPrice);
  wireContractPreview();

  const fillBtn = detail.querySelector("#sxs-fill");
  fillBtn.disabled = false;
  fillBtn.addEventListener("click", () => fillContract(enriched, enrichedPrice));
}

// Type each character one at a time — this is what React's synthetic event system responds to
async function typeIntoInput(input, text) {
  input.focus();
  input.select();
  document.execCommand("selectAll");
  document.execCommand("delete");
  for (const char of text) {
    const opts = { key: char, char, keyCode: char.charCodeAt(0), which: char.charCodeAt(0), bubbles: true, cancelable: true };
    input.dispatchEvent(new KeyboardEvent("keydown",  opts));
    input.dispatchEvent(new KeyboardEvent("keypress", opts));
    document.execCommand("insertText", false, char);
    input.dispatchEvent(new KeyboardEvent("keyup", opts));
    await new Promise(r => setTimeout(r, 20));
  }
}

/** Contract create page: type the client's email and move on to the contract. */
async function fillClientInput(inq) {
  const input = document.querySelector('input[placeholder*="name or email"], input[placeholder*="name"]')
    || document.querySelector('input[type="text"]');
  if (!input) { showFillStatus(0); return; }

  const statusEl = document.getElementById("sxs-fill-status");
  await typeIntoInput(input, inq.email);
  if (statusEl) statusEl.textContent = `✓ Typed — now click Next in PixiSet`;

  setTimeout(() => {
    const nextBtn = [...document.querySelectorAll("button")].find(b => /^next$/i.test(b.textContent.trim()));
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.click();
      if (statusEl) statusEl.textContent = "✓ Clicked Next — open Autofill again on the contract page";
    }
  }, 500);
}

// ── VIEWS ─────────────────────────────────────────────────────────────────────

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
