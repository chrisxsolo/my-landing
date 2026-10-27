---
name: no-travel-fee-in-guides
description: Campus/location guides never state a travel fee
metadata:
  type: feedback
---

Never add a travel fee to any campus or location guide page (`/grads/*`, their `/spots` guides, or new guides).

**Why:** Chris asked twice (Berkeley, then SJSU on 2026-10-27). The fee lives on the pricing page, estimators, and FAQ, not the guides.

**How to apply:** Don't add travel-fee lines, notes, or "may add a travel fee" copy to guide data or the shared school template. `tests/unit/schoolGuidesNoTravelFee.test.ts` enforces this for every campus.
