# Admin Analytics Day Navigation

## Goal

Add calendar-day browsing to the Darkroom analytics tab so yesterday can be compared with the day before it, with navigation through the previous seven completed days.

## Interface

- Add a `Day` option beside Today, 7d, 30d, and Week.
- Selecting Day initially shows yesterday.
- Previous and next arrow controls move one full calendar day at a time.
- Browsing stops at seven days ago and yesterday; today remains available through the existing Today option.
- The selected calendar date appears between the arrows.
- Trend labels and stat-card comparison values reference the immediately preceding full calendar day.

## Date Behavior

Day ranges use local calendar boundaries from 12:00:00.000 AM through 11:59:59.999 PM. The comparison range is the complete calendar day immediately before the selected day. Existing Today, 7d, 30d, and Week behavior remains unchanged.

## Implementation Boundaries

- Extract the date-range calculation into a small testable helper instead of expanding the already-large analytics component.
- Update the analytics component to render and operate the Day navigator.
- Continue using the existing analytics API response; no API response, database schema, Supabase policy, or Vercel configuration changes are required.

## Error Handling

Existing loading and API error behavior remains unchanged. Navigation controls enforce the seven-day boundary and do not issue additional requests because the current analytics fetch already includes sufficient history.

## Verification

- Unit-test yesterday, a historical selected day, comparison boundaries, and the seven-day navigation limits.
- Run the focused unit test, lint the affected files, and run the production-style Next.js build with webpack.
- Verify in the browser that Day defaults to yesterday, arrows respect limits, and counts/trend labels update for the selected date.
