export const INQUIRY_SELECT = [
  "id",
  "name",
  "email",
  "phone",
  "session_type",
  "date_in_mind",
  "message",
  "status",
  "created_at",
  "payment_status",
  "payment_note",
  "payment_detected_at",
  "booking_confirmed",
  "session_date",
  "reply_sent_at",
  "invoice_sent_at",
  "contract_sent_at",
  "deposit_paid_at",
  "gallery_delivered_at",
  "instagram",
  "school",
  "preferred_time",
  "people",
  "location",
  "confirmation_sent_at",
  "needs_reply",
  "needs_reply_dismissed_at",
  "last_inbound_at",
  "last_outbound_at",
  "last_message_at",
  "last_message_direction",
  "status_source",
  "gmail_thread_ids",
].join(",");

export type AdminInquiry = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  session_type: string | null;
  date_in_mind: string | null;
  message: string;
  status: string;
  created_at: string;
  payment_status: string | null;
  payment_note: string | null;
  payment_detected_at: string | null;
  booking_confirmed: boolean | null;
  session_date: string | null;
  reply_sent_at: string | null;
  invoice_sent_at: string | null;
  contract_sent_at: string | null;
  deposit_paid_at: string | null;
  gallery_delivered_at: string | null;
  instagram: string | null;
  school: string | null;
  preferred_time: string | null;
  people: string | null;
  location: string | null;
  confirmation_sent_at: string | null;
  needs_reply: boolean | null;
  needs_reply_dismissed_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  status_source: string | null;
  gmail_thread_ids: string[] | null;
};

// Statuses that never surface in the needs-reply queue.
const NEEDS_REPLY_EXEMPT_STATUSES = new Set(["archived", "not_interested", "manual"]);

/**
 * Whether an inquiry belongs in the "Needs reply" queue. Prefers the persisted
 * Gmail-reconciled flag; rows never reconciled fall back to the legacy
 * "no reply stamped yet" heuristic.
 */
export function inquiryNeedsReply(
  inquiry: Pick<AdminInquiry, "status" | "needs_reply" | "reply_sent_at">,
): boolean {
  if (NEEDS_REPLY_EXEMPT_STATUSES.has(inquiry.status)) return false;
  if (typeof inquiry.needs_reply === "boolean") return inquiry.needs_reply;
  return !inquiry.reply_sent_at && inquiry.status !== "responded";
}

export type AdminInquiryCreate = {
  name: string;
  email: string;
  message: string;
  phone?: string | null;
  session_type?: string | null;
  date_in_mind?: string | null;
  status?: string;
  payment_status?: string | null;
  booking_confirmed?: boolean | null;
  session_date?: string | null;
  instagram?: string | null;
  school?: string | null;
  preferred_time?: string | null;
  people?: string | null;
  location?: string | null;
};

export type AdminInquiryPatch = Partial<Pick<
  AdminInquiry,
  | "status"
  | "session_type"
  | "session_date"
  | "preferred_time"
  | "reply_sent_at"
  | "invoice_sent_at"
  | "contract_sent_at"
  | "deposit_paid_at"
  | "gallery_delivered_at"
  | "confirmation_sent_at"
  | "needs_reply"
  | "needs_reply_dismissed_at"
  | "last_inbound_at"
  | "last_outbound_at"
  | "last_message_at"
  | "last_message_direction"
  | "status_source"
>>;

type InquiryResponse = {
  inquiry?: AdminInquiry;
  inquiries?: AdminInquiry[];
  error?: string;
};

async function parseResponse(res: Response): Promise<InquiryResponse> {
  const json = await res.json() as InquiryResponse;
  if (!res.ok) throw new Error(json.error ?? "Inquiry request failed.");
  return json;
}

export async function loadAdminInquiries(): Promise<AdminInquiry[]> {
  const json = await parseResponse(await fetch("/api/admin/inquiries"));
  return json.inquiries ?? [];
}

export async function loadAdminInquiry(id: number): Promise<AdminInquiry | null> {
  const res = await fetch(`/api/admin/inquiries?id=${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  const json = await parseResponse(res);
  return json.inquiry ?? null;
}

export async function createAdminInquiry(input: AdminInquiryCreate): Promise<AdminInquiry> {
  const json = await parseResponse(await fetch("/api/admin/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
  if (!json.inquiry) throw new Error("Inquiry was not returned.");
  return json.inquiry;
}

export async function updateAdminInquiry(id: number, updates: AdminInquiryPatch): Promise<AdminInquiry> {
  const json = await parseResponse(await fetch("/api/admin/inquiries", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, updates }),
  }));
  if (!json.inquiry) throw new Error("Inquiry was not returned.");
  return json.inquiry;
}

export async function deleteAdminInquiry(id: number): Promise<void> {
  await parseResponse(await fetch(`/api/admin/inquiries?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  }));
}
