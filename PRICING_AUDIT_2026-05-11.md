# SoloXSnaps — Pricing Audit Report
**Date:** 2026-05-11  
**Scope:** Website pricing pages vs. Obsidian business vault (source of truth)  
**Files reviewed:**
- `app/(professional)/pricing/grads/page.tsx`
- `app/(professional)/pricing/families/page.tsx`
- `lib/pricing.ts`
- `app/components/GraduationRateEstimator.tsx`
- `02 Pricing/Graduation Pricing.md`
- `02 Pricing/Family Pricing.md`
- `02 Pricing/Couples Pricing.md`
- `02 Pricing/Add Ons.md`
- `02 Pricing/Travel Fees.md`
- `02 Pricing/Pricing Matrix.md`
- `02 Pricing/Group Pricing.md`
- `01 SOPs/Client Policies.md`
- `01 SOPs/Cancellation & Refund Policy.md`
- `01 SOPs/Reschedule Policy.md`
- `07 Client Experience/Delivery Expectations.md`
- `07 Client Experience/Editing Policy.md`
- `04 Website/Travel Fee Engine.md`

---

## Severity Key

| Label | Meaning |
|-------|---------|
| 🔴 CRITICAL | Incorrect price or fee visible to clients |
| 🟠 SIGNIFICANT | Policy or messaging mismatch that could set wrong expectations |
| 🟡 GAP | Information exists on one side only — needs canonicalization |
| 🔵 INTERNAL | Inconsistency within the Obsidian vault itself |

---

## 🔴 CRITICAL — Incorrect Numbers Shown to Clients

### 1. Travel Fee Minimum — Grad Page
**Website (`/pricing/grads` info card):**
> "Locations outside 20 miles from SF may include a **$20–$75** travel fee."

**Vault (`Travel Fees.md`, `Pricing Matrix.md`, `Travel Fee Engine.md`):**
| Location | Fee |
|----------|-----|
| CSUEB (Hayward) | $30 |
| UC Berkeley | $35 |
| Santa Clara / SCU | $70 |
| SJSU (San Jose) | $75 |

**Problem:** The stated minimum of $20 is wrong. The lowest documented flat fee is **$30 (CSUEB)**. No $20 fee exists anywhere in the vault.

**Fix:** Change grad page travel card to:
```
"Locations outside SF may include a $30–$75 travel fee."
```

---

### 2. Travel Fee Range — Family Page (Different and Also Wrong)
**Website (`/pricing/families` info card):**
> "Locations outside 20 miles from SF may include a **$20–$50** travel fee."

**Vault:** Same flat fee schedule applies to all sessions. Max fee is **$75 (SJSU)**, not $50. Minimum is $30, not $20.

**Problem:** The family page uses a completely different (and lower) fee ceiling than the grad page, with no vault basis for this distinction. A client comparing both pages would see contradictory travel fees.

**Fix:** Standardize both pages to:
```
"Locations outside SF may include a $30–$75 travel fee."
```
Or link both cards to the same constant so they can't drift apart again. Consider extracting these strings into `lib/pricing.ts`.

---

### 3. Champagne / Celebratory Elements — Price Disconnect
**Website (`/pricing/grads` add-ons list):**
> "Celebratory elements — On request"

**`lib/pricing.ts` (rate estimator logic):**
```ts
export const ADDON_CHAMPAGNE = 15
```

**Problem:** The static pricing page says "On request" (implying no set price), but the `GraduationRateEstimator` component uses a hard-coded **$15** for this add-on. A client could see $0 on the static page, then $15 added in the estimator. This is a live contradition on the same page.

Additionally, this add-on does **not appear anywhere in the Obsidian vault** — not in `Add Ons.md`, not in `Pricing Matrix.md`. It has never been canonicalized.

**Fix (choose one):**
- If the price is $15: add it to `Add Ons.md` and update the static page to show "$15"
- If it's truly negotiable: remove `ADDON_CHAMPAGNE` from the estimator or set it to $0 and label it "Contact for pricing"
- Recommended: set a real price, document it in the vault, and make the static page and estimator agree

---

### 4. Family Add-On — Second Location Price ($25 vs. $125)
**Website (`/pricing/families` add-ons list):**
> "Additional nearby location — $25"

**Website (`/pricing/grads` add-ons list) and Vault (`Add Ons.md`, `Pricing Matrix.md`):**
> "Second nearby location — $125"

**Problem:** The family page charges **$25** for an additional location; the grad page and the vault's canonical Add Ons.md charge **$125**. A $100 gap with no vault documentation explaining the distinction. Either family sessions genuinely have a different rate (needs to be documented), or this is a typo.

**Fix:** Decide the actual price, document it in `Add Ons.md` with a note if family sessions differ, then update `families/page.tsx` accordingly.

---

## 🟠 SIGNIFICANT — Policy and Messaging Mismatches

### 5. Turnaround Phrasing — Sounds Like a Fixed Promise
**Website (`/pricing/grads`):**
> Chip: "Two-week turnaround"  
> Inclusions list: "Standard two-week turnaround"

**Vault (`Client Policies.md`):**
> "Standard turnaround: **up to 2 weeks** from session date"

**Vault (`Delivery Expectations.md`):**
> "Up to 2 weeks from session date."

**Vault (`Pricing Matrix.md`):**
> "1-2 week standard turnaround"

**Problem:** "Two-week turnaround" sounds like a commitment to exactly 2 weeks. The vault is consistent that the correct client-facing language is "**up to 2 weeks**" — which is more accurate and protects against over-promising during busy seasons. The Pricing Matrix's "1-2 week" adds further ambiguity.

**Fix:** Update grad page chip to "Up to 2-week turnaround" and inclusions line to "Up to two-week standard turnaround". Consider reconciling Pricing Matrix to say "up to 2 weeks" consistently across the vault too.

---

### 6. Remaining Balance Due — Family Page Says "After the Shoot"
**Website (`/pricing/families` booking card):**
> "Remaining balance due **after** the shoot."

**Website (`/pricing/grads` booking card):**
> "Remaining balance due **on shoot day**."

**Vault (`Client Policies.md`):**
> "Remaining balance due **by the day of the session**, before final photo delivery"

**Problem:** The family page's "after the shoot" is materially different from "on shoot day." It could be interpreted as meaning the client can pay after photos are delivered — which contradicts the vault policy and the grad page.

**Fix:** Standardize both pages to match the vault: "Remaining balance due on shoot day."

---

### 7. Deposit Policy — "Non-Refundable But Transferable" Not Stated
**Website (both pricing pages, booking card):**
> "50% deposit to reserve the date."

**Vault (`Client Policies.md`) — explicitly requires this phrasing:**
> "Deposits are non-refundable but transferable."  
> "Do **not** say 'non-refundable' without also saying 'transferable'"

**Problem:** The website never states the deposit is non-refundable or transferable. This isn't necessarily required on a public pricing page, but if the info cards are the first place a client reads about booking terms, the omission could cause friction at invoice time.

**Fix (optional but recommended):** Update booking info cards on both pages to:
> "50% deposit to reserve the date. Deposits are non-refundable but transferable."

---

### 8. "Celebratory Elements" Not Documented in Vault
The grad add-on "Celebratory elements: On request" has no corresponding entry in:
- `Add Ons.md`
- `Pricing Matrix.md`
- `Upsell Logic.md`

This means the email assistant and AI reply generator won't know how to quote or discuss it. If a client asks about this add-on after seeing it on the pricing page, AI-generated replies will have no reference for it.

**Fix:** Add an entry to `Add Ons.md` and `Pricing Matrix.md` with the confirmed price and any relevant upsell rules.

---

## 🟡 GAPS — Information on One Side Only

### 9. Family Pricing — Website Has Real Prices, Vault Is a Placeholder
**Website (`/pricing/families`):**
- Family Session: $350 starting from, 30 min, min 10 edited images
- Extended Family Session: $500 starting from, 60 min, min 30 edited images

**Vault (`Family Pricing.md`):**
```
Update with your actual rate here.
Placeholder: Base Rate: $[your rate]/hour
```

**Vault (`Pricing Matrix.md` — Family section):**
```
TODO: confirm active family pricing and inclusions.
```

**Problem:** The vault — declared as the canonical source of truth — has no family pricing defined. The website is the only place these prices exist. If pricing changes, there's no vault doc to update, and AI systems have no reference for family pricing.

**Fix:** Update `Family Pricing.md` and `Pricing Matrix.md` with the real prices:
- Family Session (mini): $350 flat, up to 30 min, 1 location, min 10 edited images
- Extended Family Session: $500 flat, up to 60 min, 1 location, min 30 edited images

---

### 10. Family Add-Ons — "Extended Family Members" Not in Vault
**Website (`/pricing/families` add-ons):**
> "Extended family members — $50–$75"

**Vault (`Add Ons.md`):**  
No mention of extended family member add-on pricing.

**Fix:** Add to `Add Ons.md` with a note distinguishing family vs. grad session scope.

---

### 11. Group Package — No Image Count Minimum Stated
**Website (`/pricing/grads` — Group Grad Package):**
> "Professionally edited images per person" (no quantity)

**Grad individual package:** 50+ edited images stated  
**Vault:** No per-person image minimum defined for group sessions

**Problem:** Group clients don't know how many images they'll receive per person, while individual clients see "50+". This asymmetry likely increases pre-booking questions and could hurt group conversion.

**Fix:** Decide on a group minimum per person (e.g., 20+ per person) and add it to both `Group Pricing.md` and the website package inclusions.

---

### 12. Couples Pricing — No Website Page, Vault Is Also a Placeholder
**Website:** No `/pricing/couples` page exists.  
**Vault (`Couples Pricing.md`):** Placeholder only — no real prices.

This is consistent (both are missing), so there's no active mismatch. But it's a conversion gap — couples interested in booking have no clear path.

**Action:** When ready to offer couples sessions publicly, build the vault doc first, then the page.

---

## 🔵 INTERNAL VAULT — Inconsistency Within Obsidian

### 13. Travel Fee Starting Point — SF Zoo vs. SF State
**`Travel Fees.md`:**
> "Starting point: San Francisco Zoo."

**`Travel Fee Engine.md`:**
> "San Francisco Zoo"

**`Pricing Matrix.md`:**
> "Calculated at $0.70/mile round trip from **SF State**."

**Problem:** Two vault files say SF Zoo; the Pricing Matrix says SF State. These are different locations with different mileage to outlying campuses.

**Fix:** Update `Pricing Matrix.md` to say "San Francisco Zoo" to match the two more detailed files. SF Zoo should be treated as canonical since it's specified in both the Travel Fees and Travel Fee Engine docs.

---

## Recommended Fix Order

| Priority | Issue | File(s) to Change |
|----------|-------|-------------------|
| 1 | Travel fee minimum wrong on both pages | `grads/page.tsx`, `families/page.tsx` |
| 2 | Family/grad travel fee ceiling disagree | `families/page.tsx` |
| 3 | Champagne: estimator says $15, page says On request | `pricing.ts`, `grads/page.tsx`, `Add Ons.md` |
| 4 | Second location: $25 (family) vs $125 (grad/vault) | `families/page.tsx`, `Add Ons.md` |
| 5 | Remaining balance "after the shoot" vs "on shoot day" | `families/page.tsx` |
| 6 | Turnaround: "two-week" → "up to two-week" | `grads/page.tsx` |
| 7 | Deposit non-refundable/transferable not stated | Both pricing pages |
| 8 | Family pricing not in vault | `Family Pricing.md`, `Pricing Matrix.md` |
| 9 | Extended family members add-on not in vault | `Add Ons.md` |
| 10 | Celebratory elements not in vault | `Add Ons.md`, `Pricing Matrix.md` |
| 11 | Group image count undefined | `Group Pricing.md`, `grads/page.tsx` |
| 12 | Pricing Matrix says "SF State" for travel origin | `Pricing Matrix.md` |

---

*Do not edit code until pricing decisions on items 3, 4, 11, and 12 are confirmed. Everything else can be fixed without a business decision.*
