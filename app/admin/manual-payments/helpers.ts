import type { InquiryOption, PaymentRow } from "./types";

export const INPUT = "h-9 w-full min-w-0 rounded-none border-0 bg-transparent px-2 text-xs font-semibold outline-none";
export const TH = "sticky top-0 z-10 border-b border-r px-2 py-2 text-left text-[10px] font-black uppercase tracking-widest";
export const TD = "border-b border-r align-middle";
export const METHODS = ["Venmo", "Zelle", "PayPal", "Cash App", "Pixieset", "Cash", "manual", "other"];
export const PAYMENT_TYPES = [
  { value: "deposit_1", label: "Deposit" },
  { value: "deposit_2", label: "Final" },
  { value: "full", label: "Full" },
  { value: "other", label: "Other" },
];

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function parseToIsoDate(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const cleaned = value.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function emptyRows(count: number): PaymentRow[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `${Date.now()}-${index}`,
    inquiry_id: null,
    client_name: "",
    client_email: "",
    amount: "",
    method: "Venmo",
    payment_type: "deposit_1",
    paid_at: today(),
    session_date: "",
    invoice: "",
    note: "",
  }));
}

export function rowsFromInquiries(list: InquiryOption[]): PaymentRow[] {
  return list.map((inquiry, index) => ({
    key: `inquiry-${inquiry.id}-${index}`,
    inquiry_id: inquiry.id,
    client_name: inquiry.name,
    client_email: inquiry.email,
    amount: "",
    method: "Venmo",
    payment_type: "deposit_1",
    paid_at: inquiry.deposit_paid_at?.slice(0, 10) ?? inquiry.payment_detected_at?.slice(0, 10) ?? "",
    session_date: parseToIsoDate(inquiry.session_date ?? inquiry.date_in_mind),
    invoice: "",
    note: "",
  }));
}

export function displayMoney(amount: string, cents?: number) {
  if (cents && cents > 0) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }
  return amount ? `$${amount.replace(/^\$/, "")}` : "$0";
}

export function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}
