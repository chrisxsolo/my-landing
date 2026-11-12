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

function timeUnresolved(draft) {
  return draft.session.timeDetail?.status === "unresolved";
}

// Ticking the box lets the checked fields be filled. It never sets a time:
// an unresolved session time stays unset, and the label says so.
function previewConfirmation(draft) {
  if (draft.status !== "review") return "";
  const text = timeUnresolved(draft)
    ? "I've checked the flagged fields. The session time stays unset and will not be filled."
    : "I've checked the flagged fields";
  return `<label class="sxs-confirm-row"><input type="checkbox" id="sxs-review-confirm" /> ${text}</label>`;
}

function previewSub(text) {
  return text ? `<span class="sxs-field-sub">${esc(text)}</span>` : "";
}

// The session time with where it came from. A calculated golden-hour range
// is labelled as calculated and shows its sunset; an unresolved one shows why
// and offers a retry. An older API response has no timeDetail and shows the
// bare time.
function previewTimeRows(session) {
  const detail = session.timeDetail;
  if (!detail) return previewRow("Session time", previewValue(session.time ?? "—"));
  if (detail.status === "unresolved") {
    const body = `Not set${previewSub(detail.sourceLabel)}${previewSub(detail.unresolvedReason)}`
      + `<button type="button" id="sxs-time-retry" class="sxs-link-btn">Retry the lookup</button>`;
    return previewRow("Session time", `<span class="sxs-field-val sxs-time-unresolved">${body}</span>`);
  }
  const zone = [detail.zoneAbbreviation, detail.timeZone].filter(Boolean).join(" · ");
  const source = detail.status === "none" ? "" : detail.sourceLabel;
  const time = previewRow("Session time", `<span class="sxs-field-val">${esc(session.time ?? "—")}${previewSub(zone)}${previewSub(source)}</span>`);
  if (!detail.sunset) return time;
  const sunset = `<span class="sxs-field-val">${esc(detail.sunset.local)}${previewSub(detail.sunset.source)}${previewSub(detail.sunset.locality)}</span>`;
  return time + previewRow("Sunset", sunset);
}

function previewPackageRow(session) {
  return session.packageNote ? previewRow("Package source", previewValue(session.packageNote)) : "";
}

// What the fill did about the session time. Pixieset's invoice editor has no
// session-time field, so a time is never reported as written.
function invoiceTimeSummary(draft) {
  if (timeUnresolved(draft)) return " Session time is still unresolved and was not filled.";
  if (draft.session.time) return ` Pixieset's invoice has no session-time field, so ${draft.session.time} was not written to it.`;
  return "";
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
    previewPackageRow(session),
    previewRow("Location", previewInput("location", session.location ?? "")),
    previewRow("Location source", previewValue(LOCATION_SOURCE_LABELS[session.locationSource] ?? session.locationSource)),
    previewRow("School", previewValue(session.school ?? "—")),
    previewRow("Travel", previewValue(travelSource)),
    previewRow("Travel fee", previewInput("travelCents", previewTravelAmount(pricing.travel), 'placeholder="enter a fee"')),
    previewRow("Total", `<span class="sxs-field-val" id="sxs-invoice-total">${esc(previewTotal(draft))}</span>`),
    previewRow("Session date", previewValue(`${session.date ?? "—"} (${DATE_LABELS[session.dateConfidence]})`)),
    previewTimeRows(session),
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

/**
 * The session time after the panel's edits. A golden-hour range was worked
 * out for the original location, so editing the location withdraws it rather
 * than carrying a time calculated for somewhere else.
 */
function reviewedTime(session, location) {
  const detail = session.timeDetail;
  if (!detail || detail.status !== "calculated" || (location || null) === (session.location || null)) {
    return { time: session.time, timeDetail: detail };
  }
  return {
    time: null,
    timeDetail: {
      ...detail, status: "unresolved", start: null, end: null, startUtc: null, endUtc: null, sunset: null,
      sourceLabel: "Golden hour requested — time needs confirmation",
      unresolvedReason: "the location was edited after the time was calculated. Reload the draft to work it out again.",
    },
  };
}

/** The draft as edited in the panel. */
function readInvoicePreview(draft, root = document) {
  const text = key => readPreviewField(root, key) ?? "";
  const baseCents = parseCents(text("baseCents")) ?? draft.pricing.baseCents;
  const travel = reviewedTravel(draft.pricing.travel, parseCents(text("travelCents")), text("location"));
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(text("dueDate")) ? text("dueDate") : null;
  return {
    ...draft,
    session: {
      ...draft.session, itemName: text("itemName") || draft.session.itemName, description: text("description"), location: text("location") || null,
      ...reviewedTime(draft.session, text("location")),
    },
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
