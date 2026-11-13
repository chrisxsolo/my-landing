// SoloXSnaps → PixiSet Autofill: the flat facts /api/extension/detect-date
// returns, as the contract preview reads them when the API sends no resolved
// draft (see contractResolved.js).

function detectedTotal(d) {
  return d.total_fee != null && Number.isFinite(Number(d.total_fee)) ? Number(d.total_fee) : null;
}

// The inquiry plus what /api/extension/detect-date settled. Every field the
// payload lacks keeps the inquiry's own value, so an older API response (no
// Rush preview charge, no total kind) prices exactly as before. The shoot
// location from the thread stays separate from the school.
function enrichInquiryFromFacts(inq, d = {}) {
  // A yearless date on the form means the first such day after the form was sent, not after today.
  const submitted = inq.created_at && !Number.isNaN(Date.parse(inq.created_at)) ? businessDate(new Date(inq.created_at)) : undefined;
  return {
    ...inq,
    _sessionDate: formatSessionDate(d.date) || (d.readable && (formatSessionDate(d.readable) || d.readable))
      || formatSessionDate(inq.date_in_mind, submitted) || inq.date_in_mind || "TBD",
    _sessionTime: d.time || "TBD",
    _location: d.location || "",
    _serviceType: d.session_type || null,
    _agreedTotal: detectedTotal(d),
    _totalKind: typeof d.total_kind === "string" ? d.total_kind : null,
    _rushPreview: normalizeRushPreviewCharge(d.rush_preview_charge),
  };
}

// One line under the title: how sure the thread is, the service, the figure it wrote and any add-on.
function detectedStatusLine(d) {
  const confidence = d.confidence === "high" ? "✓ Confirmed in email" : d.confidence === "medium" ? "~ Likely from email" : "~ From inquiry form";
  const bits = [confidence];
  if (d.session_type) bits.push(SERVICE_LABELS[d.session_type] || d.session_type);
  const total = detectedTotal(d);
  if (total != null) bits.push(`$${total} ${d.total_kind === "agreed_total" ? "agreed" : "quoted"} in email`);
  const rush = normalizeRushPreviewCharge(d.rush_preview_charge);
  if (rush && rush.kind === "add") bits.push(`${rush.label} +${fmt(rush.amountCents / 100)}`);
  return bits.join(" · ");
}

