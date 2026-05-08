// GET /api/gmail/inbox
//
// Returns recent threads where the latest message is a real person replying
// (not me, not automated/promotional). Used on the home dashboard.

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

export type InboxThread = {
  threadId:     string;
  fromName:     string;
  fromEmail:    string;
  subject:      string;
  snippet:      string;
  timestamp:    number;
  messageCount: number;
  isUnread:     boolean;
};

function parseName(from: string, email: string): string {
  const m = from.match(/^([^<]+)</);
  const name = m ? m[1].trim().replace(/^"|"$/g, "") : "";
  if (name) return name;
  // Fall back to the part before @ in the email
  return email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function parseEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1].toLowerCase() : from.toLowerCase().trim();
}

// Domains and patterns that indicate automated/promotional senders
const SPAM_DOMAINS = [
  "noreply","no-reply","donotreply","do-not-reply","notifications","mailer",
  "newsletter","updates","info@","support@","hello@","team@","bounces.",
  "sendgrid","mailchimp","klaviyo","hubspot","salesforce","marketo",
  "constantcontact","amazonses","sparkpost","postmark","mandrill",
  "squarespace","wix","shopify","stripe","paypal","venmo","zelle",
  "google","facebook","instagram","twitter","linkedin","tiktok","youtube",
  "apple","microsoft","amazon","netflix","spotify","uber","doordash",
];

function isAutomated(fromEmail: string, fromName: string, subject: string): boolean {
  const e = fromEmail.toLowerCase();
  const s = subject.toLowerCase();
  const n = fromName.toLowerCase();

  if (SPAM_DOMAINS.some(d => e.includes(d))) return true;

  // Subjects that scream automated
  if (/unsubscribe|opt.out|view.in.browser|click.here|update.*preference|privacy.policy/.test(s)) return true;
  if (/^\s*(re:|fwd:)?\s*(welcome|confirm|verify|activate|reset|invoice|receipt|order|shipment|delivery|alert|reminder|notification)\b/i.test(subject)) return true;

  // Names that are clearly not people
  if (/team|support|noreply|newsletter|notifications|updates|billing|accounts|admin|system|automated/i.test(n)) return true;

  return false;
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ threads: [], connected: false });

  // Fetch more than needed so we have room to filter out automated ones
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "5");
  const fetchCount = limit * 4;
  const auth    = `Bearer ${tokens.access_token}`;
  const myEmail = tokens.email.toLowerCase();

  // Only inbox, not from me, not promotional/social/updates categories
  const q = `-from:${myEmail} in:inbox -category:promotions -category:social -category:updates -category:forums`;

  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads` +
    `?q=${encodeURIComponent(q)}&maxResults=${fetchCount}`,
    { headers: { Authorization: auth } }
  );

  if (!searchRes.ok) return NextResponse.json({ threads: [], connected: true });

  const searchData = await searchRes.json() as { threads?: { id: string }[] };
  const threadIds  = (searchData.threads ?? []).map(t => t.id);
  if (!threadIds.length) return NextResponse.json({ threads: [], connected: true });

  const results = await Promise.all(
    threadIds.map(async (threadId) => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}` +
          `?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: auth } }
        );
        if (!r.ok) return null;
        return await r.json() as {
          id: string;
          messages: {
            id: string; threadId: string; internalDate?: string; snippet?: string;
            labelIds?: string[];
            payload?: { headers?: { name: string; value: string }[] };
          }[];
        };
      } catch { return null; }
    })
  );

  const threads: InboxThread[] = [];

  for (const thread of results) {
    if (!thread?.messages?.length) continue;
    const last    = thread.messages[thread.messages.length - 1];
    const headers = last.payload?.headers ?? [];
    const h = (n: string) => headers.find(x => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
    const from      = h("From");
    const fromEmail = parseEmail(from);
    const fromName  = parseName(from, fromEmail);
    const subject   = h("Subject");

    if (fromEmail === myEmail) continue;
    if (isAutomated(fromEmail, fromName, subject)) continue;

    const isUnread = thread.messages.some(m => m.labelIds?.includes("UNREAD"));
    threads.push({
      threadId:     thread.id,
      fromName,
      fromEmail,
      subject,
      snippet:      last.snippet ?? "",
      timestamp:    parseInt(last.internalDate ?? "0"),
      messageCount: thread.messages.length,
      isUnread,
    });

    if (threads.length >= limit) break;
  }

  threads.sort((a, b) => b.timestamp - a.timestamp);

  return NextResponse.json({ threads, connected: true, myEmail });
}
