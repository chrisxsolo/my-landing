import { createSupabaseServerClient } from "./supabaseServer";
import {
  normalizeBlockedSenderEmail,
  sanitizeBlockedSenders,
} from "./gmailBlockedSendersShared";

const GMAIL_BLOCKED_SENDERS_KEY = "gmail_blocked_senders";

export { normalizeBlockedSenderEmail, sanitizeBlockedSenders };

export async function getBlockedSenders() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", GMAIL_BLOCKED_SENDERS_KEY)
    .maybeSingle();

  if (!data?.value) return [];

  try {
    return sanitizeBlockedSenders(JSON.parse(data.value));
  } catch {
    return [];
  }
}

async function saveBlockedSenders(senders: string[]) {
  const supabase = createSupabaseServerClient();
  const normalized = sanitizeBlockedSenders(senders);

  await supabase.from("site_settings").upsert(
    {
      key: GMAIL_BLOCKED_SENDERS_KEY,
      value: JSON.stringify(normalized),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  return normalized;
}

export async function addBlockedSender(email: string) {
  const normalizedEmail = normalizeBlockedSenderEmail(email);
  if (!normalizedEmail) throw new Error("Valid sender email is required.");

  const existing = await getBlockedSenders();
  return saveBlockedSenders([...existing, normalizedEmail]);
}

export async function removeBlockedSender(email: string) {
  const normalizedEmail = normalizeBlockedSenderEmail(email);
  if (!normalizedEmail) throw new Error("Valid sender email is required.");

  const existing = await getBlockedSenders();
  return saveBlockedSenders(existing.filter((item) => item !== normalizedEmail));
}
