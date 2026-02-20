# ADR 0007: Local Timezone Sync and Foreground Re-reconciliation

## Status
Accepted

## Context

The notification scheduling pipeline (v0.4) has a split timezone model:

- **Domain layer** (`notificationPlan.ts`, `cycleMath.ts`): All date arithmetic uses UTC
  via `Date.UTC()` and `getUTCFullYear/Month/Date`. This is correct — cycle length
  calculations must not drift across DST boundaries.

- **Reconciliation layer** (`reconcileNotifications.ts`): Converts ISO date strings to
  local-time `Date` objects at 09:00 via `new Date(year, month, day, 9, 0, 0, 0)`.
  This is correct — notifications should fire at 9 AM wherever the user is.

- **Orchestrator** (`syncNotifications.ts`): Computes `todayIso` via
  `formatIsoDate(new Date())`, which uses `getUTCFullYear/Month/Date`. This is the bug —
  "today" should reflect the user's local calendar date, not UTC. In UTC-8 after 4 PM
  local, `todayIso` becomes tomorrow's date, causing incorrect past-date filtering.

Additionally, `syncNotifications()` only runs on cold start and explicit user actions.
If the user travels across timezones and resumes the app from background, the previously
scheduled notifications may fire at the wrong local time (e.g., 9 AM in the departure
timezone, not the arrival timezone). A foreground re-sync corrects this.

## Decisions

**D1: Derive `todayIso` using local calendar date, not UTC.**

Replace:
```typescript
const todayIso = formatIsoDate(new Date());  // UTC
```

With a local derivation:
```typescript
const now = new Date();
const yyyy = String(now.getFullYear());
const mm = String(now.getMonth() + 1).padStart(2, "0");
const dd = String(now.getDate()).padStart(2, "0");
const todayIso = `${yyyy}-${mm}-${dd}`;
```

This uses `getFullYear/Month/Date` (local timezone) instead of
`getUTCFullYear/UTCMonth/UTCDate`. The format remains `YYYY-MM-DD`.

`formatIsoDate()` in `cycleMath.ts` is NOT modified. It correctly uses UTC for date
arithmetic (cycle lengths, next-start estimates). Only the "what is today?" question
in the orchestrator changes.

**D2: Add `AppState` foreground listener in `App.tsx` to re-sync on resume.**

When the app transitions from background/inactive to active, call `syncNotifications()`
fire-and-forget. This ensures:

- Timezone changes during background are picked up on resume
- Midnight rollovers while backgrounded are picked up on resume
- Alarm state is refreshed after Android may have cleared alarms (Doze, battery optimization)

The listener is registered once in the bootstrap `useEffect` and cleaned up on unmount.

**D3: Do NOT listen to `TIMEZONE_CHANGED` or `TIME_SET` broadcasts (for now).**

Rationale:
- These are Android-specific intents requiring a native BroadcastReceiver or
  `expo-intent-launcher` / custom native module
- The app is backgrounded during timezone changes — the foreground sync (D2) catches
  the change when the user opens the app
- Adding native broadcast receivers increases complexity and maintenance burden
  disproportionate to the gain
- If future validation shows foreground sync is insufficient (e.g., alarm fires before
  user opens app after travel), a native module can be added incrementally

## Consequences

- `todayIso` now matches the user's wall-clock date in all timezones. The domain
  plan's past-date filter (`fireDateIso >= todayIso`) aligns with the reconciliation
  layer's local-time interpretation of fire dates.
- Foreground sync adds one extra `syncNotifications()` call per app resume. This is
  safe because: (a) the function is idempotent — same inputs produce empty diff, (b)
  deterministic IDs prevent duplicate scheduling, (c) fire-and-forget pattern means
  UI is never blocked.
- No changes to deterministic ID format, reconciliation logic, adapter behavior,
  or domain date arithmetic.
- No new dependencies, no native modules, no schema changes.
