// ─────────────────────────────────────────────────────────────────────────────
// POST /api/generate-contract
//
// Scans the email thread for agreed price, session time, and location,
// then fills in the standard portrait photography contract template.
//
// Body:     { inquiry_id }
// Response: { contract: "full contract text..." }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

type MimePart = { mimeType?: string; body?: { data?: string }; parts?: MimePart[] };

function decodeBody(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const padded  = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    return decodeURIComponent(
      Array.from(atob(padded))
        .map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
  } catch { return ""; }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractBestText(part: MimePart): string {
  let plain = ""; let html = "";
  function walk(p: MimePart) {
    if (p.mimeType === "text/plain" && p.body?.data && !plain)
      plain = decodeBody(p.body.data);
    else if (p.mimeType === "text/html" && p.body?.data && !html)
      html = decodeBody(p.body.data);
    (p.parts ?? []).forEach(walk);
  }
  walk(part);
  return plain || stripHtml(html);
}

function ordinal(n: number): string {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function fmtContractDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.toLocaleDateString("en-US", { month: "long" })} ${ordinal(d.getDate())}, ${d.getFullYear()}`;
}

function parseAmount(str: string): number {
  return parseFloat(str.replace(/[^0-9.]/g, "")) || 0;
}

function fmtMoney(n: number): string {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

function buildContract(opts: {
  effectiveDate: string; clientName: string; clientEmail: string;
  sessionType: string; sessionDate: string; sessionTime: string;
  location: string; totalFee: string; retainer: string; remaining: string;
}): string {
  const { effectiveDate, clientName, clientEmail, sessionType, sessionDate, sessionTime, location, totalFee, retainer, remaining } = opts;
  return `Portrait Photography Services Agreement



THIS AGREEMENT is made as of ${effectiveDate} (the "Effective Date") between ${clientName} with a primary contact address of ${clientEmail} ("Client"), and SoloxSnaps ("Photographer").





1. Engagement of Photographer



1.1 Services. Subject to the terms set out herein, Client engages Photographer to provide, and Photographer agrees to provide, the photography services described in this Section 1.1 (the "Services") in connection with the portrait session of ${sessionType} (the "Portrait Session").



Date and time of Portrait Session: ${sessionDate} at ${sessionTime}

Location of Portrait Session: ${location}

Description of Services:

[Minimum of 30 edited images delivered within two weeks through an online gallery]



As part of the Services, the Photographer will produce or take similar action to create materials from Images and provide related deliverables (as set out above) pursuant to the provision of the Services ("Work Product"). "Images" means photographic material, whether still or moving, created by Photographer pursuant to this Agreement and includes digital files and prints upon purchasing request.


1.2 Exclusivity. Client acknowledges and agrees that Photographer will be the exclusive provider of the Services in the Portrait Session, unless otherwise agreed to by the parties in writing.



2. Fees and Payment



2.1 Fees. Client will pay Photographer the fees set out herein in this Section 2.1 ("Fees"), including any applicable federal or state/provincial sales or value-added taxes due on such Fees.



Total Fee for Services: [${totalFee}]

Retainer due upon signing: [${retainer}]

Remaining amount due on [${sessionDate}]: [${remaining}]

2.2 Retainer. Client acknowledges and agrees that the retainer amount set out above is due upon the signing of this Agreement and is not refundable ("Retainer"), so as to fairly compensate Photographer for committing his/her time to provide the Services and turning down other potential projects or clients. Both parties agree that the Retainer will be credited towards the total Fees payable by Client.



3. Client Responsibilities



3.1 Expenses. Client will provide the means of travel or be responsible for reasonable travel expenses incurred by Photographer that are necessary for the performance of the Services or travel that is otherwise requested by Client.

3.2 Waiver. Client (on behalf of himself/herself and any other participant whose image or recording may be captured by the Services) hereby waives all rights and claims, and releases Photographer from any claim or cause of action, whether now known or unknown, relating to the sale, display, license, use and exploitation of Images pursuant to this Agreement.



4. Artistic Release



4.1 Consistency. Photographer will use reasonable efforts to ensure that the Services are produced in a style consistent with Photographer's current portfolio, and Photographer will use reasonable efforts to consult with Client and incorporate any reasonable suggestions.



4.2 Style. Client acknowledges and agrees that:

Client has reviewed Photographer's previous work and portfolio and has a reasonable expectation that Photographer will perform the Services in a similar style

Photographer will use its artistic judgement when providing the Services, and shall have final say regarding the aesthetic judgement and artistic quality of the Services; and

Disagreement with Photographer's aesthetic judgement or artistic ability are not valid reasons for termination of this Agreement or request of any monies returned.



5. Artistic Release



5.1 Consistency. Photographer will use reasonable efforts to ensure that the Services are produced in a style consistent with Photographer's current portfolio, and Photographer will use reasonable efforts to consult with Client and incorporate any reasonable suggestions.



5.2 Style. Client acknowledges and agrees that:

Client has reviewed Photographer's previous work and portfolio and has a reasonable expectation that Photographer will perform the Services in a similar style

Photographer will use its artistic judgement when providing the Services, and shall have final say regarding the aesthetic judgement and artistic quality of the Services; and

Disagreement with Photographer's aesthetic judgement or artistic ability are not valid reasons for termination of this Agreement or request of any monies returned.



6. Term and Termination



6.1 Term. This Agreement will begin on the Effective Date and continue until the latter of (i) the date where all outstanding Fees under this Agreement are paid in full; or (ii) the date where all final Work Product has been delivered ("Term").

6.2 Cancellation. Client may terminate the Agreement ("Cancellation") and/or reschedule the Services ("Rescheduling") by providing Photographer with written notice no later than [5 days] before the original date of the Portrait Session (the "Minimum Notice"). Client acknowledges and agrees that Client is not relieved of any payment obligations for Cancellations and Rescheduling unless the Minimum Notice in accordance with this Article 6 is duly provided or unless the parties otherwise agree in writing.

6.3 Rescheduling. In the event of Rescheduling, Photographer will use commercially reasonable efforts to accommodate Client's change. If Photographer is not able to accommodate Client's change despite using commercially reasonable efforts, the parties agree that such Rescheduling will be deemed as Cancellation by Client and that Photographer will be under no obligation to perform the Services other than on the original date of the Portrait Session.

6.4 No Refund. Client acknowledges and agrees that Cancellation by Client will not result in a refund of any fees paid on or prior to the date of Cancellation by Client.

6.5 Late Arrivals. In the event that the Client arrives late by 15 minutes or more to the Portrait Session, an additional fee of $40 will be applied to the total payment due at the end of the photoshoot.

6.6 Replacement. In the event that Photographer is unable to perform the Services, Photographer, subject to Client's consent, which is not to be reasonably withheld, shall cause a replacement photographer to perform the Services in accordance with the terms of this Agreement. In the event that such consent is not obtained, Photographer shall terminate this Agreement and shall return the Retainer and all fees paid by Client, and thereafter shall have no further liability to Client.

6.7 Deposit Transfer. If either party terminates this contract for any reason and the client still wishes to proceed with the photoshoot, the deposit paid by the client shall be held and may be transferred to another photoshoot to be scheduled at a later date, at the discretion of the photographer. Any additional fees or costs associated with rescheduling or conducting the photoshoot at a later date shall be the responsibility of the client.

6.8 Cancellation Due to Bad Weather. If the photoshoot is cancelled due to inclement weather, the photographer and client will work together to reschedule the session at a later date that is mutually convenient with no cost. In the event that the client wishes to cancel the contract entirely, the deposit paid will be held by the photographer and may be transferred to another photoshoot to be scheduled at a later date, at the discretion of the photographer. The client will be responsible for any additional fees or costs associated with rescheduling or conducting the photoshoot at a later date.



7. Ownership of Work Product by Photographer



7.1 Ownership of Work. Photographer will own all right, title and interest in all Work Product. Client (on behalf of itself and any participants at the Portrait Session) hereby grants Photographer and any of its service providers an exclusive, royalty-free, worldwide, irrevocable, transferable and sublicensable license to use any materials created by Client or attendees, during the performance of the Services, that may be protected by copyright or any intellectual property rights ("Portrait Session Materials") as part of any Work Product or in connection with the marketing, advertising or promotion of Photographer's services, including in connection with Photographer's studio, portfolio, website or social media, in any format or medium. Client acknowledges and affirms that no other person or entity has any rights that may prevent or restrict Photographer from using Portrait Session Materials as provided herein.



8. Limited License to Client



8.1 Personal Use. Photographer hereby grants Client an exclusive, limited, irrevocable, royalty-free, non-transferable and non-sublicensable license to use Work Product for Client's Personal Use, provided that Client does not remove any attribution notices or copyright notices included by Photographer in any Work Product. "Personal Use" includes, but is not limited to, use (i) of photos on Client's personal social media pages or profiles; (ii) in Client's personal creations, such as scrapbooks, albums or personal gifts; (iii) in non-commercial physical display; and (iv) in personal communications, such as family newsletter, email, or holiday card. Client will not make any other use of the Work Product without Photographer's prior written consent, including but not limited to use of the Work Product for commercial sale.



10. General



10.1 Notice. Parties shall provide effective notice ("Notice") to each other via either of the following methods of delivery at the date and time which the Notice is sent:

Photographer's Email: soloxsnaps@gmail.com

Client's Email: ${clientEmail}

10.2 Survival. Articles 7, 8, 9 and 10 will survive termination of this Agreement.

10.3 Governing Law. This Agreement will be governed by the laws of [California/San Francisco County]

10.4 Amendment. This Agreement may only be amended, supplemented or otherwise modified by written agreement signed by each of the parties.

10.5 Entire Agreement. This Agreement constitutes the entire agreement between the parties with respect to the Services and supersedes all prior agreements and understandings both formal and informal.

10.6 Severability. If any provision of this Agreement is determined to be illegal, invalid or unenforceable, in whole or in part, by an arbitrator or any court of competent jurisdiction, that provision or part thereof will be severed from this Agreement and the remaining part of such provision and all other provisions will continue in full force and effect.`;
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { inquiry_id: string | number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { inquiry_id } = body;
  if (!inquiry_id) return NextResponse.json({ error: "inquiry_id required" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const { data: inq } = await supabase
    .from("inquiries").select("*").eq("id", inquiry_id).single();

  if (!inq) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });

  // ── Fetch email thread ────────────────────────────────────────────────────
  let emailContext = "";
  const tokens = await getValidTokens();
  if (tokens) {
    const auth = `Bearer ${tokens.access_token}`;
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
      `?q=${encodeURIComponent(`from:${inq.email} OR to:${inq.email}`)}&maxResults=20`,
      { headers: { Authorization: auth } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json() as { messages?: { id: string }[] };
      const ids = (searchData.messages ?? []).map(m => m.id).slice(0, 12);
      const bodies = await Promise.all(ids.map(async id => {
        try {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
            { headers: { Authorization: auth } }
          );
          if (!r.ok) return "";
          const msg = await r.json() as { payload?: MimePart; snippet?: string };
          return (extractBestText(msg.payload ?? {}) || msg.snippet || "").slice(0, 2000);
        } catch { return ""; }
      }));
      emailContext = bodies.filter(Boolean).map((b, i) => `--- Email ${i + 1} ---\n${b}`).join("\n\n");
    }
  }

  // ── Ask Claude to extract booking details ─────────────────────────────────
  const anthropic = new Anthropic();
  const today = new Date().toISOString().split("T")[0];

  const extractRes = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: `Extract photography booking details from emails. Today is ${today}.
Respond ONLY with valid JSON (no markdown):
{
  "totalFee": "agreed price e.g. '$350' — look for dollar amounts, package prices. null if not found",
  "sessionTime": "meeting time e.g. '4:00pm-5:00pm' or '6pm'. null if not found",
  "location": "meeting spot e.g. 'Legion of Honor, San Francisco'. null if not found",
  "sessionDateReadable": "date in readable form e.g. 'May 24th, 2026'. null if not found"
}
Only extract values explicitly mentioned. Use null for anything unclear.`,
    messages: [{
      role: "user",
      content: `Client: ${inq.name} (${inq.email})
Session type: ${inq.session_type ?? "Graduation"}
Date in mind: ${inq.date_in_mind ?? "not specified"}
Original inquiry: ${inq.message}

Email thread:
${emailContext || "(no email history found)"}`,
    }],
  });

  let extracted = { totalFee: null as string|null, sessionTime: null as string|null, location: null as string|null, sessionDateReadable: null as string|null };
  try {
    const raw = extractRes.content[0].type === "text" ? extractRes.content[0].text.trim() : "{}";
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim());
    extracted = { ...extracted, ...parsed };
  } catch { /* use defaults */ }

  // ── Build contract fields ─────────────────────────────────────────────────
  const effectiveDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  let sessionDate = "[SESSION DATE — fill in]";
  if (inq.session_date)                sessionDate = fmtContractDate(inq.session_date);
  else if (extracted.sessionDateReadable) sessionDate = extracted.sessionDateReadable;
  else if (inq.date_in_mind && inq.date_in_mind.toLowerCase() !== "flexible")
                                       sessionDate = inq.date_in_mind;

  // ── Apply travel fee for known schools ──────────────────────────────────
  // Detect school from the school field, session_type, and message text
  const haystack = [inq.school, inq.session_type, inq.message, inq.email].filter(Boolean).join(" ").toLowerCase();
  function detectTravelFee(text: string): number {
    if (/\bstanford\b/.test(text))                                  return 45;
    if (/\buc berkeley\b|\bberkeley\b|cal bears/.test(text))        return 35;
    if (/\bcsueb\b|cal state east bay|eastbay/.test(text))          return 30;
    if (/\bsjsu\b|san jose state/.test(text))                       return 75;
    if (/\bsanta clara\b|\bscu\b/.test(text))                       return 70;
    return 0;
  }
  const travelFee = detectTravelFee(haystack);

  let totalFeeStr  = extracted.totalFee ?? "[TOTAL FEE — fill in]";
  let totalNum     = parseAmount(totalFeeStr);
  if (totalNum && travelFee) {
    totalNum    += travelFee;
    totalFeeStr  = fmtMoney(totalNum);
  }
  const retainerStr  = totalNum ? fmtMoney(Math.ceil(totalNum / 2))  : "[RETAINER — fill in]";
  const remainingStr = totalNum ? fmtMoney(Math.floor(totalNum / 2)) : "[REMAINING — fill in]";

  const contract = buildContract({
    effectiveDate,
    clientName:   inq.name,
    clientEmail:  inq.email,
    sessionType:  inq.session_type ?? "Graduation",
    sessionDate,
    sessionTime:  extracted.sessionTime ?? "[SESSION TIME — fill in]",
    location:     extracted.location   ?? "[LOCATION — fill in]",
    totalFee:     totalFeeStr,
    retainer:     retainerStr,
    remaining:    remainingStr,
  });

  return NextResponse.json({ contract });
}
