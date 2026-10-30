// SoloXSnaps → PixiSet Autofill: writing a reviewed invoice draft into the
// Pixieset invoice editor. Every value goes through setNativeValue, which
// uses the element's native setter and fires bubbling input + change events
// so Pixieset's React state picks it up.

const INVOICE_SELECTORS = {
  itemName: 'input[placeholder*="Item name" i], input[name*="item_name" i], input[name*="itemName" i]',
  rowContainer: 'tr, [class*="line-item" i], [class*="lineitem" i], [class*="item-row" i], [class*="invoice-item" i], [class*="itemrow" i]',
  description: 'input[placeholder*="escription"], textarea[placeholder*="escription"], input[name*="description" i], textarea[name*="description" i]',
  quantity: 'input[placeholder*="Qty" i], input[placeholder*="Quantity" i], input[name*="quantity" i], input[name*="qty" i]',
  price: 'input[placeholder*="0.00"], input[name*="price" i], input[name*="rate" i], input[name*="amount" i]',
  note: 'textarea[placeholder*="Thank you" i], textarea[placeholder*="note" i], textarea[name*="note" i], textarea[name*="message" i], textarea[name*="memo" i]',
  dueDate: 'input[placeholder*="Due" i], input[name*="due" i], input[aria-label*="Due" i]',
};

const ADD_ITEM_PATTERN = /add\s+(line\s+)?item|add\s+another\s+item|^\+\s*item/i;
const TRAVEL_ITEM_NAME = "Travel Fee";
const NEW_ROW_TIMEOUT_MS = 2500;

function dollarsFromCents(cents) {
  return (Number(cents) / 100).toFixed(2);
}

/** "2027-05-16" → "05/16/2027", the US form Pixieset's date fields take. */
function dueDateForPixieset(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[2]}/${m[3]}/${m[1]}` : null;
}

/** Each line item on the page, as its own set of inputs. */
function findInvoiceRows(doc = document) {
  return [...doc.querySelectorAll(INVOICE_SELECTORS.itemName)].map(name => {
    const row = name.closest(INVOICE_SELECTORS.rowContainer) || name.parentElement || doc;
    return {
      name,
      description: row.querySelector(INVOICE_SELECTORS.description),
      quantity: row.querySelector(INVOICE_SELECTORS.quantity),
      price: row.querySelector(INVOICE_SELECTORS.price),
    };
  });
}

function findAddItemButton(doc = document) {
  return [...doc.querySelectorAll("button, a[role='button'], [role='button']")]
    .find(b => ADD_ITEM_PATTERN.test(String(b.textContent || "").trim()) && !b.disabled) || null;
}

function waitFor(check, timeoutMs) {
  return new Promise(resolve => {
    const started = Date.now();
    const tick = () => {
      const result = check();
      if (result) return resolve(result);
      if (Date.now() - started >= timeoutMs) return resolve(null);
      setTimeout(tick, 100);
    };
    tick();
  });
}

function fillRow(row, { name, description, quantity, priceCents }) {
  let filled = 0;
  if (row.name) { setNativeValue(row.name, name); filled++; }
  if (row.description && description !== null) { setNativeValue(row.description, description); filled++; }
  if (row.quantity) { setNativeValue(row.quantity, String(quantity)); filled++; }
  if (row.price) { setNativeValue(row.price, dollarsFromCents(priceCents)); filled++; }
  return filled;
}

/** The second row for a travel fee: an existing blank one, or one Add Item creates. */
async function ensureSecondRow(doc) {
  const rows = findInvoiceRows(doc);
  if (rows[1]) return rows[1];
  const button = findAddItemButton(doc);
  if (!button) return null;
  button.click();
  return waitFor(() => findInvoiceRows(doc)[1] || null, NEW_ROW_TIMEOUT_MS);
}

/**
 * Fills the invoice editor from a draft the user has reviewed. Returns what
 * was filled and anything the page did not offer a field for.
 */
async function fillInvoiceFromDraft(draft, doc = document) {
  const skipped = [];
  let filled = 0;
  const rows = findInvoiceRows(doc);
  if (!rows[0]) return { filled, skipped: ["line items"] };

  filled += fillRow(rows[0], {
    name: draft.session.itemName, description: draft.session.description,
    quantity: draft.session.quantity, priceCents: draft.pricing.baseCents,
  });

  const travel = draft.pricing.travel;
  if (travel.kind === "verified" && travel.amountCents > 0) {
    const second = await ensureSecondRow(doc);
    if (second) {
      filled += fillRow(second, {
        name: TRAVEL_ITEM_NAME, description: travel.place ? `Travel to ${travel.place}` : null,
        quantity: 1, priceCents: travel.amountCents,
      });
    } else {
      skipped.push("travel fee row (no Add Item control found)");
    }
  }

  const note = doc.querySelector(INVOICE_SELECTORS.note);
  if (note) { setNativeValue(note, draft.note); filled++; } else skipped.push("note");

  const due = dueDateForPixieset(draft.dueDate);
  if (due) {
    const dueInput = doc.querySelector(INVOICE_SELECTORS.dueDate);
    if (dueInput) { setNativeValue(dueInput, due); filled++; } else skipped.push("due date");
  }

  return { filled, skipped };
}
