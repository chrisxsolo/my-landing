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

export type PaymentRow = {
  key: string;
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

export type SavedPayment = Omit<PaymentRow, "key"> & {
  id: number;
  amount_cents: number;
  source: string;
  status: string;
};
