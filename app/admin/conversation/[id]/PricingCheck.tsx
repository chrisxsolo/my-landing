"use client";
// Pricing verification for a Draft AI reply.
//
// The amounts here come from the rate card (the server sends the inputs, this
// re-checks the draft as it is edited), never from the model's prose. When the
// draft states a different travel fee or total, the panel says so and offers
// a one-click correction that changes only those figures.

import { useMemo } from "react";
import { T, Icon, MonoLabel } from "../ui";
import {
  checkDraftQuote, correctDraftPricing, type PricingEnforcement, type QuoteInput, type QuoteMismatch,
} from "@/lib/ai/quotePricing";
import { SPORTS_TEAM_PORTRAIT_PLAYBOOK, sportsTeamOfferOptions } from "@/lib/ai/sportsTeamPortraitPricing";

export type DraftQuote = { input: QuoteInput; stalePrices: number[] };

type Props = {
  draft: string;
  quote: DraftQuote | null;
  onDraft: (next: string) => void;
  /** The admin confirms earlier quoted figures were agreed for this client. */
  onConfirmEarlier: (prices: number[]) => void;
  /** Figures the server already replaced in this draft, shown so the change is visible. */
  pricingFix?: PricingEnforcement | null;
};

const money = (n: number) => (Number.isInteger(n) ? `$${n.toLocaleString("en-US")}` : `$${n.toFixed(2)}`);

/** How a mismatch reads to Chris, by the role the figure plays. */
function describeMismatch(m: QuoteMismatch): string {
  if (m.kind === "travel") {
    return m.expected > 0
      ? `Draft says ${money(m.stated)} travel; should be ${money(m.expected)}.`
      : `Draft says ${money(m.stated)} travel; no travel amount is verified for this location.`;
  }
  if (m.kind === "per_person") {
    const options = sportsTeamOfferOptions();
    const expected = options.find((o) => o.perPerson === m.expected);
    return expected
      ? `Draft says ${money(m.stated)} per person; the ${expected.durationMinutes}-minute package is ${money(m.expected)} per person.`
      : `Draft says ${money(m.stated)} per person, which matches neither the ${options.map((o) => `${o.durationMinutes}-minute`).join(" nor the ")} package. Check which one it describes.`;
  }
  return `Draft says ${money(m.stated)} total; should be ${money(m.expected)}.`;
}

/** What the server changed before the draft arrived, with the model's text on request. */
function ServerCorrections({ fix }: { fix: PricingEnforcement }) {
  return (
    <div className="space-y-1" style={{ color: T.inkFaint }}>
      <p className="leading-snug">
        Corrected before it reached you:{" "}
        {fix.corrections.map((c) => `${money(c.stated)} ${c.kind} to ${money(c.expected)}`).join(", ")}.
      </p>
      {fix.originalDraft && (
        <details>
          <summary className="cursor-pointer">Show the draft as written</summary>
          <pre className="whitespace-pre-wrap mt-1" style={{ fontFamily: "inherit" }}>{fix.originalDraft}</pre>
        </details>
      )}
    </div>
  );
}

export default function PricingCheck({ draft, quote, onDraft, onConfirmEarlier, pricingFix = null }: Props) {
  const check = useMemo(() => (quote ? checkDraftQuote(draft, quote.input) : null), [draft, quote]);
  if (!quote || !check?.quotesPrice) return null;
  const { breakdown, mismatches } = check;
  const stale = quote.stalePrices;
  // Two alternative packages are both valid; the table shows the one the
  // draft names, or the recommended 60-minute option, never their sum.
  const twoOptions = quote.input.playbook === SPORTS_TEAM_PORTRAIT_PLAYBOOK;

  return (
    // Polite live region on the always-mounted card, so a mismatch that appears
    // or changes while Chris types is announced once without interrupting him.
    <div className="px-3 py-2 rounded-xl text-xs space-y-2" aria-live="polite"
      style={{ background: T.inset, border: `1px solid ${mismatches.length ? T.redBorder : T.border}` }}>
      <MonoLabel>Pricing from the rate card</MonoLabel>
      {pricingFix && pricingFix.corrections.length > 0 && <ServerCorrections fix={pricingFix} />}
      {breakdown ? (
        <table className="w-full" style={{ color: T.ink }}>
          <thead>
            <tr style={{ color: T.inkFaint }}>
              <th className="text-left font-medium">Item</th>
              <th className="text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.lines.map((line) => (
              <tr key={line.label}>
                <td>{line.label}</td>
                <td className="text-right tabular-nums">{money(line.amount)}</td>
              </tr>
            ))}
            <tr className="font-semibold" style={{ borderTop: `1px solid ${T.border}` }}>
              <td>Total</td>
              <td className="text-right tabular-nums">{money(breakdown.total)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p style={{ color: T.inkFaint }}>This session has no single rate-card price, so only the travel fee is checked.</p>
      )}
      {mismatches.length > 0 && (
        <div className="space-y-1" style={{ color: T.red }}>
          {mismatches.map((m, i) => (
            <p key={`${m.kind}-${m.stated}-${i}`} className="leading-snug">
              {i === 0 && <strong>Price mismatch: </strong>}{describeMismatch(m)}
            </p>
          ))}
          {mismatches.some((m) => m.expected > 0) && (
            <button type="button" onClick={() => onDraft(correctDraftPricing(draft, check))}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-semibold"
              style={{ background: T.redBg, color: T.red, border: `1px solid ${T.redBorder}` }}>
              <Icon name="check" size={11} /> Use rate-card amounts
            </button>
          )}
        </div>
      )}
      {twoOptions && breakdown && (
        <p className="leading-snug" style={{ color: T.inkSoft }}>
          Two package options are available for this setup. The table shows one; the other is an alternative, not an add-on.
        </p>
      )}
      {stale.length > 0 && (
        <div className="space-y-1" style={{ color: T.inkFaint }}>
          <p className="leading-snug">
            An earlier email quoted {stale.map(money).join(", ")} with an outdated travel fee. Current pricing is used
            unless that quote was agreed for this client.
          </p>
          <button type="button" onClick={() => onConfirmEarlier(stale)}
            className="px-2 py-1 rounded-lg font-semibold" style={{ background: T.neutralBg, color: T.ink, border: `1px solid ${T.border}` }}>
            Earlier quote was agreed
          </button>
        </div>
      )}
    </div>
  );
}
