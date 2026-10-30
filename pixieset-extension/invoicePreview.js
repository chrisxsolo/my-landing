// SoloXSnaps → PixiSet Autofill: the editable invoice review shown before
// anything touches Pixieset. Edits are read back into the draft on fill.

const TRAVEL_LABELS = {
  verified: "Approved fee",
  included: "Included (San Francisco)",
  unknown: "Unknown — needs a fee",
  none: "None",
};

const LOCATION_SOURCE_LABELS = {
  email: "confirmed in email",
  inquiry: "from the inquiry",
  school: "assumed: the school's campus",
  unknown: "not known",
};

const DATE_LABELS = { confirmed: "confirmed in email", tentative: "tentative", unknown: "unknown" };

function previewRow(label, html) {
  return `<div class="sxs-field-row"><span class="sxs-field-label">${label}</span>${html}</div>`;
}

function previewValue(text) {
  return `<span class="sxs-field-val">${esc(text)}</span>`;
}

function previewInput(key, value, extra = "") {
  return `<input class="sxs-field-input" data-invoice-key="${key}" value="${esc(value)}" spellcheck="false" ${extra}/>`;
}

function previewTextarea(key, value) {
  return `<textarea class="sxs-field-input sxs-note-input" data-invoice-key="${key}" rows="3" spellcheck="false">${esc(value)}</textarea>`;
}

function previewTotal(draft) {
  return draft.pricing.totalCents === null ? "— (confirm the flagged items)" : fmtCents(draft.pricing.totalCents);
}

function previewTravelAmount(travel) {
  return travel.kind === "unknown" ? "" : fmtCents(travel.amountCents ?? 0);
}

function previewMessages(draft) {
  const reasons = draft.reviewReasons.map(r => `<li class="sxs-review-reason">${esc(r)}</li>`).join("");
  const warnings = draft.warnings.map(w => `<li class="sxs-warning">${esc(w)}</li>`).join("");
  if (!reasons && !warnings) return "";
  return `<ul class="sxs-messages">${reasons}${warnings}</ul>`;
}

function previewConfirmation(draft) {
  if (draft.status !== "review") return "";
  return `<label class="sxs-confirm-row"><input type="checkbox" id="sxs-review-confirm" /> I've checked the flagged fields</label>`;
}

function buildInvoicePreview(draft) {
  const { client, session, pricing } = draft;
  const statusText = draft.status === "ready" ? "✓ Ready to fill" : "⚠ Needs review";
  const travelSource = `${TRAVEL_LABELS[pricing.travel.kind] ?? pricing.travel.kind}${pricing.travel.place ? ` · ${pricing.travel.place}` : ""}`;
  return [
    `<div class="sxs-status sxs-status-${draft.status}">${statusText}</div>`,
    previewMessages(draft),
    previewRow("Client", previewValue(client.name)),
    previewRow("Email", previewValue(client.email)),
    previewRow("Item", previewInput("itemName", session.itemName)),
    previewRow("Description", previewInput("description", session.description)),
    previewRow("Quantity", previewValue(String(session.quantity))),
    previewRow("Base price", previewInput("baseCents", fmtCents(pricing.baseCents))),
    previewRow("Location", previewInput("location", session.location ?? "")),
    previewRow("Location source", previewValue(LOCATION_SOURCE_LABELS[session.locationSource] ?? session.locationSource)),
    previewRow("School", previewValue(session.school ?? "—")),
    previewRow("Travel", previewValue(travelSource)),
    previewRow("Travel fee", previewInput("travelCents", previewTravelAmount(pricing.travel), 'placeholder="enter a fee"')),
    previewRow("Total", `<span class="sxs-field-val" id="sxs-invoice-total">${esc(previewTotal(draft))}</span>`),
    previewRow("Session date", previewValue(`${session.date ?? "—"} (${DATE_LABELS[session.dateConfidence]})`)),
    previewRow("Session time", previewValue(session.time ?? "—")),
    previewRow("Due date", previewInput("dueDate", draft.dueDate ?? "", 'placeholder="left unchanged"')),
    previewRow("Note", previewTextarea("note", draft.note)),
    previewConfirmation(draft),
  ].join("");
}

function parseCents(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const n = Number(text.replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function readPreviewField(root, key) {
  const el = root.querySelector(`[data-invoice-key="${key}"]`);
  return el ? String(el.value ?? "").trim() : null;
}

/** Travel after the panel's edits: a typed fee is a line, a cleared fee is no line. */
function reviewedTravel(original, travelCents, location) {
  if (travelCents !== null && travelCents > 0) {
    return { kind: "verified", amountCents: travelCents, place: location || original.place };
  }
  if (original.kind === "verified") return { kind: "none", amountCents: 0, place: original.place };
  if (original.kind === "unknown") return travelCents === 0 ? { kind: "none", amountCents: 0, place: original.place } : original;
  return original;
}

/** The draft as edited in the panel. */
function readInvoicePreview(draft, root = document) {
  const text = key => readPreviewField(root, key) ?? "";
  const baseCents = parseCents(text("baseCents")) ?? draft.pricing.baseCents;
  const travel = reviewedTravel(draft.pricing.travel, parseCents(text("travelCents")), text("location"));
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(text("dueDate")) ? text("dueDate") : null;
  return {
    ...draft,
    session: { ...draft.session, itemName: text("itemName") || draft.session.itemName, description: text("description"), location: text("location") || null },
    pricing: {
      ...draft.pricing,
      baseCents,
      travel,
      totalCents: travel.kind === "unknown" ? null : baseCents + (travel.amountCents ?? 0),
    },
    note: text("note") || draft.note,
    dueDate,
  };
}

/** Whether the panel allows a fill right now: ready drafts always, review drafts once confirmed. */
function invoiceFillAllowed(draft, root = document) {
  if (draft.status === "ready") return true;
  const box = root.querySelector("#sxs-review-confirm");
  return Boolean(box && box.checked);
}
