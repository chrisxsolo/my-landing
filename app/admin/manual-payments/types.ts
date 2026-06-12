export type InquiryOption = {
  id: number;
  name: string;
  email: string;
  session_type: string | null;
  session_date: string | null;
  date_in_mind: string | null;
  message: string | null;
  school: string | null;
  location: string | null;
  people: string | null;
  payment_status: string | null;
  payment_note: string | null;
  payment_detected_at: string | null;
  deposit_paid_at: string | null;
  created_at: string;
};

// Fields shared with rows persisted in the payments table.
type PaymentRowCore = {
  inquiry_id: number | null;
  client_name: string;
  client_email: string;
  amount: string;
  method: string;
  payment_type: string;
  paid_at: string;
  session_date: string;
  invoice: string;
  note: string;
};

export type PaymentRow = PaymentRowCore & {
  key: string;
  // Per-schedule amounts, pre-populated from saved payments (exact figures)
  // or from the inferred session total (suggestions the user can edit).
  d1: string;
  d2: string;
  full: string;
  d1Paid: boolean;
  d2Paid: boolean;
  /** Where the full total came from: saved payments, pricing, note… */
  totalSource: string;
  /** True once the user edits the row — only touched/selected rows bulk-save. */
  touched: boolean;
};

export type SavedPayment = PaymentRowCore & {
  id: number;
  amount_cents: number;
  source: string;
  status: string;
};
