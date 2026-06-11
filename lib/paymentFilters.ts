// Pure filter/sort/search/export helpers for payment rows returned by
// GET /api/admin/payments. Kept framework-free so they are unit-testable.

export type PaymentRow = {
  id: number;
  inquiry_id: number | null;
  client_name: string;
  client_email: string;
  amount: string;
  amount_cents: number;
  method: string;
  payment_type: string;
  invoice: string;
  note: string;
  source: string;
  status: string; // active | voided | refunded
  paid_at: string;
  session_date: string | null;
  fee_cents: number;
  refund_cents: number;
  imported_at: string | null;
  reconciliation_status: string;
  source_txn_id: string;
  inquiry_session_type?: string | null;
};

export type PaymentSortKey = "date" | "amount" | "client" | "imported";

export type PaymentFilterState = {
  search: string;
  method: string; // normalized label, "" = all
  paymentType: string; // "" = all
  recon: string; // reconciliation_status, "" = all
  sessionType: string; // inquiry_session_type, "" = all
  minCents: number | null;
  maxCents: number | null;
  sortKey: PaymentSortKey;
  sortDir: "asc" | "desc";
};

export const DEFAULT_PAYMENT_FILTERS: PaymentFilterState = {
  search: "",
  method: "",
  paymentType: "",
  recon: "",
  sessionType: "",
  minCents: null,
  maxCents: null,
  sortKey: "date",
  sortDir: "desc",
};

export function normalizePaymentMethod(method: string): string {
  if (!method) return "other";
  const lower = method.toLowerCase();
  if (lower === "venmo") return "Venmo";
  if (lower === "zelle") return "Zelle";
  if (lower === "paypal") return "PayPal";
  if (lower === "cash app" || lower === "cash") return "Cash App";
  if (lower === "pixieset") return "Pixieset";
  return "other";
}

function rowMatchesSearch(row: PaymentRow, needle: string): boolean {
  const haystack = [row.client_name, row.client_email, row.invoice, row.note]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function sortValue(row: PaymentRow, key: PaymentSortKey): number | string {
  if (key === "amount") return row.amount_cents;
  if (key === "client") return row.client_name.toLowerCase();
  if (key === "imported") return row.imported_at ?? "";
  return row.paid_at ?? "";
}

export function applyPaymentFilters(rows: PaymentRow[], f: PaymentFilterState): PaymentRow[] {
  const needle = f.search.trim().toLowerCase();
  const filtered = rows.filter(row => {
    if (needle && !rowMatchesSearch(row, needle)) return false;
    if (f.method && normalizePaymentMethod(row.method) !== f.method) return false;
    if (f.paymentType && row.payment_type !== f.paymentType) return false;
    if (f.recon && row.reconciliation_status !== f.recon) return false;
    if (f.sessionType && (row.inquiry_session_type ?? "") !== f.sessionType) return false;
    if (f.minCents !== null && row.amount_cents < f.minCents) return false;
    if (f.maxCents !== null && row.amount_cents > f.maxCents) return false;
    return true;
  });

  const dir = f.sortDir === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    const av = sortValue(a, f.sortKey);
    const bv = sortValue(b, f.sortKey);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

const CSV_COLUMNS: { header: string; value: (row: PaymentRow) => string | number }[] = [
  { header: "id", value: r => r.id },
  { header: "client_name", value: r => r.client_name },
  { header: "client_email", value: r => r.client_email },
  { header: "amount_cents", value: r => r.amount_cents },
  { header: "amount", value: r => r.amount },
  { header: "fee_cents", value: r => r.fee_cents },
  { header: "refund_cents", value: r => r.refund_cents },
  { header: "method", value: r => r.method },
  { header: "payment_type", value: r => r.payment_type },
  { header: "status", value: r => r.status },
  { header: "reconciliation_status", value: r => r.reconciliation_status },
  { header: "paid_at", value: r => r.paid_at },
  { header: "session_date", value: r => r.session_date ?? "" },
  { header: "imported_at", value: r => r.imported_at ?? "" },
  { header: "source", value: r => r.source },
  { header: "source_txn_id", value: r => r.source_txn_id },
  { header: "invoice", value: r => r.invoice },
  { header: "session_type", value: r => r.inquiry_session_type ?? "" },
  { header: "note", value: r => r.note },
];

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function paymentsToCsv(rows: PaymentRow[]): string {
  const header = CSV_COLUMNS.map(c => c.header).join(",");
  const lines = rows.map(row => CSV_COLUMNS.map(c => csvEscape(c.value(row))).join(","));
  return [header, ...lines].join("\n");
}

const DUPLICATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function payerKey(row: PaymentRow): string {
  return (row.client_email || row.client_name).toLowerCase().trim();
}

// Groups of 2+ ACTIVE rows with the same payer and amount paid within 3 days
// of each other. Surfaced as suspects for human review — never auto-deleted.
export function findDuplicateSuspects(rows: PaymentRow[]): PaymentRow[][] {
  const buckets = new Map<string, PaymentRow[]>();
  for (const row of rows) {
    if (row.status !== "active") continue;
    const key = `${payerKey(row)}|${row.amount_cents}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  const groups: PaymentRow[][] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort(
      (a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime(),
    );
    let current: PaymentRow[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].paid_at).getTime();
      const next = new Date(sorted[i].paid_at).getTime();
      if (next - prev <= DUPLICATE_WINDOW_MS) {
        current.push(sorted[i]);
      } else {
        if (current.length >= 2) groups.push(current);
        current = [sorted[i]];
      }
    }
    if (current.length >= 2) groups.push(current);
  }
  return groups;
}
