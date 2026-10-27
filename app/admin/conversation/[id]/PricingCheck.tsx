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
  checkDraftQuote, correctDraftPricing, type PricingEnforcement, type QuoteInput,
} from "@/lib/ai/quotePricing";

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

  return (
    <div className="px-3 py-2 rounded-xl text-xs space-y-2"
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
          {mismatches.map((m) => (
            <p key={`${m.kind}-${m.excerpt}`} className="leading-snug">
              Draft says {money(m.stated)} {m.kind === "travel" ? "travel" : "total"}
              {m.expected > 0 ? `; should be ${money(m.expected)}.` : "; no travel amount is verified for this location."}
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
