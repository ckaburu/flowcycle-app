# ADR 0008 — Cycle Mutation Semantics

**Status**: Proposed
**Date**: 2026-02-24
**Context**: Milestone 2 — Data Integrity & UX Hardening

---

## Context

FlowCycle currently supports adding cycle start entries but not editing or deleting them. The `Repository` interface has `addCycleStart()` but no `deleteCycleStart()` or `updateCycleStart()`. There is also no duplicate prevention at the storage layer — `quickLogCycleStart()` checks for duplicates at the domain layer, but `CycleLogScreen.onAddCycleStart()` does not.

When editing capabilities are added, mutations to cycle data affect the entire prediction chain: `typicalCycleLength()` → `estimateNextStart()` → `buildNotificationPlan()` → notification IDs. This means every mutation must trigger notification resync to maintain alarm accuracy.

## Decisions

### D1: Repository-Layer Duplicate Prevention

**Enforce uniqueness of `(profileId, startDateIso)` at the repository layer in both `addCycleStart()` and `updateCycleStart()`, on both `RealmRepo` and `MemoryRepo`.**

Rationale:
- Currently only `quickLogCycleStart()` checks for duplicates, and only on the Dashboard path
- `CycleLogScreen.onAddCycleStart()` calls `addCycleStart()` directly without dedup
- Moving the guard to the repository makes it impossible to create duplicates from any call site
- The check is a query before insert/update, within the same write transaction (Realm) or synchronous block (Memory)

#### Error Type: `DuplicateCycleStartError`

A domain error class defined in `src/domain/errors.ts`:

```typescript
export class DuplicateCycleStartError extends Error {
  constructor(startDateIso: string) {
    super(`A cycle start already exists for ${startDateIso}.`);
    this.name = "DuplicateCycleStartError";
  }
}
```

Thrown by both `addCycleStart()` and `updateCycleStart()`. Callers use `instanceof` to distinguish:
- **CycleLogScreen**: catches `DuplicateCycleStartError`, displays via `ErrorBanner`
- **quickLogCycleStart()**: pre-checks to avoid the error path entirely (returns `"already_exists"`)

This is a domain error, not a generic `Error`. It enables callers to distinguish validation failures from infrastructure errors (e.g., Realm write failures) without parsing message strings.

Behavior:
- `addCycleStart()`: Query for existing `(profileId, startDateIso)`. If found, throw `new DuplicateCycleStartError(startDateIso)`.
- `updateCycleStart()`: Query for existing `(profileId, newStartDateIso)` **excluding the entry being edited** (by `id`). If found, throw `new DuplicateCycleStartError(newStartDateIso)`. Editing an entry to its own current date is a no-op and must not throw.

### D2: Delete Semantics — Idempotent, No Cascade Beyond Profile

**`deleteCycleStart(id: number)` silently succeeds if the entry does not exist (idempotent). It does not cascade to other entities.**

Rationale:
- Cycle starts are leaf entities — nothing references them by ID
- Idempotent delete prevents errors from stale UI state (e.g., user taps delete twice)
- No cascade needed because notification reconciliation is handled separately via `syncNotifications()`
- `deleteProfile()` already cascades to cycle starts — that relationship is unaffected

### D3: Edit Semantics — Validate, Check Duplicates, Update In-Place

**`updateCycleStart(id: number, newStartDateIso: string)` validates the new date, checks for duplicates (excluding the entry being edited), and updates the `startDateIso` field in place. Throws if the entry does not exist.**

Rationale:
- In-place update preserves the entry's `id` and `createdAt`, maintaining audit trail
- Duplicate check must exclude the entry itself (allowing a no-op "edit" to the same date)
- Throwing on missing entry (unlike delete) because edit implies the user expects the entry to exist
- `createdAt` is not updated — it reflects original creation time, not last modification

### D4: Caller-Side Notification Resync

**Every mutation call site (add, edit, delete) is responsible for triggering `syncNotifications()` as fire-and-forget after the mutation completes.**

Rationale:
- Consistent with existing pattern: all 6 current sync trigger points are at the UI layer, not the repo layer
- Keeps the repository pure (data access only, no notification awareness)
- Fire-and-forget is safe because `syncNotifications` is idempotent and has a concurrency guard
- If resync fails, the next foreground event or user action retries automatically

Not chosen: Embedding `syncNotifications()` inside repository methods. This would couple the storage layer to notification infrastructure, breaking the current clean layering (repo → domain → infra).

### D5: Confirmation Before Delete, No Undo

**Delete requires a user confirmation dialog. No undo/redo mechanism in MVP.**

Rationale:
- Cycle entries can be re-added manually if deleted by accident
- Undo adds significant complexity (state snapshots, temporary soft-delete) disproportionate to the risk
- Confirmation dialog is the standard mobile pattern for destructive actions
- Can revisit undo in a future UX milestone if user feedback warrants it

### D6: Canonical Sort Ownership

**`computeCycleLengths()` is the single canonical sort point in the entire computation pipeline. It sorts its input internally. No other function sorts date arrays.**

Rationale:
- Currently two callers (`loadDashboardData.ts:52`, `syncNotifications.ts:83`) each apply `.sort()` before passing dates to domain functions. The function signatures name the parameter `sortedStartDatesIsoAsc` / `startDatesIsoAsc` but do not enforce it.
- If a future caller forgets to sort, predictions silently produce incorrect results — the median calculation takes wrong intervals, `lastStart` may not be the most recent date, and notification fire dates shift to wrong days.
- Moving the sort into the lowest-level array consumer makes correctness unconditional while ensuring sorting happens exactly once per pipeline invocation.

#### Sort Ownership Rules

1. **`computeCycleLengths(startDatesIso: string[])`** — the **sole sort point**. Adds `const sorted = [...startDatesIso].sort()` at entry. All sequential iteration uses `sorted`. Parameter renamed from `sortedStartDatesIsoAsc` to `startDatesIso`.

2. **`typicalCycleLength(startDatesIso: string[])`** — delegates to `computeCycleLengths()` which sorts. No sort here. Parameter renamed from `startDatesIsoAsc` to `startDatesIso`.

3. **`buildNotificationPlan()`** — needs `lastStart` (the chronologically most recent date). Uses `O(n)` max-comparison instead of sorting:
   ```typescript
   const lastStartIso = cycleStartDates.reduce((a, b) => (a > b ? a : b));
   ```
   ISO date strings (`YYYY-MM-DD`) compare lexicographically correctly. This avoids a second sort. Parameter renamed from `cycleStartDatesAsc` to `cycleStartDates`.

4. **`loadDashboardData()`** — also needs `lastStart`. Same max-comparison pattern. Removes `.sort()` call.

5. **`syncNotifications()`** — passes unsorted dates to `computeNotificationPlan()` → `buildNotificationPlan()`. Removes `.sort()` call.

6. **`computeCycleDay(todayIso, lastStartIso)`** and **`estimateNextStart(lastStartIso, typLen)`** — scalar inputs, unaffected.

7. **`median(nums)`** — already sorts internally (its own domain, not date arrays).

#### Verification

After this change, `grep -r '\.sort()' src/` should show zero hits for cycle date sorting. The only sort in the pipeline is inside `computeCycleLengths()`.

### D7: Minimum Data Requirements for Prediction

**At least 3 cycle starts (producing 2 intervals) are required before predictions are generated. With 0, 1, or 2 starts, `typicalCycleLength()` returns `null` and no notifications are scheduled.**

Current behavior: `typicalCycleLength()` returns a value with just 2 starts (1 interval). This is a single data point — not a statistical estimate of "typical" length.

New behavior: `typicalCycleLength()` returns `null` when `computeCycleLengths()` produces fewer than 2 intervals.

Implementation: Change the guard in `typicalCycleLength()`:
```typescript
// Before:
if (lengths.length === 0) return null;

// After:
if (lengths.length < 2) return null;
```

#### Behavior by Start Count

| Starts | Intervals | `typicalLength` | `nextEstimate` | `cycleDay` | Notifications |
|---|---|---|---|---|---|
| 0 | 0 | `null` | `null` | `null` | None |
| 1 | 0 | `null` | `null` | Computed (day in current cycle) | None |
| 2 | 1 | `null` (changed from single-interval value) | `null` (changed) | Computed | None (changed) |
| 3 | 2 | `median([a, b])` = `(a+b)/2` | Computed | Computed | Scheduled |
| 4+ | 3 (last 3) | `median([a, b, c])` | Computed | Computed | Scheduled |

Rationale:
- A single interval is not a "typical" length — it's one observation. The median of one value is just that value, providing no regression toward actual cycle patterns.
- With 2 intervals, the median (average of two) begins to smooth out individual variation.
- The `maxN=3` window means the 3 most recent intervals are used. With only 2 intervals available, both are used — this is the minimum for a meaningful estimate.
- The dashboard still shows `cycleDay` with 1 or 2 starts, so users get feedback immediately. Predictions and notifications appear after the third start.

### D8: Future-Date Constraint

**`startDateIso` must not be later than today's local calendar date. Both `addCycleStart()` and `updateCycleStart()` reject future dates at the repository layer.**

#### Error Type: `FutureDateError`

A domain error class defined in `src/domain/errors.ts`:

```typescript
export class FutureDateError extends Error {
  constructor(startDateIso: string) {
    super(`Cycle start date ${startDateIso} is in the future.`);
    this.name = "FutureDateError";
  }
}
```

#### Rationale

A cycle start records a historical event: "my period started on this date." Future dates are nonsensical in this context and create broken predictions:
- `computeCycleDay()` would return 0 or negative (clamped to 1), misleading the user
- `estimateNextStart()` would project from a date that hasn't happened, pushing the prediction further out
- Notification IDs would be based on speculative data, causing unnecessary churn when the actual start occurs

#### Implementation

A pure validation function in `src/domain/errors.ts`:
```typescript
export function assertNotFutureDate(startDateIso: string, todayIso?: string): void {
  const today = todayIso ?? localTodayIso();
  if (startDateIso > today) {
    throw new FutureDateError(startDateIso);
  }
}

function localTodayIso(): string {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
```

- `todayIso` parameter is injectable for deterministic testing (Jest fake timers not needed)
- ISO string comparison (`>`) works correctly for date ordering
- Called by both `addCycleStart()` and `updateCycleStart()` in both repo implementations
- `localTodayIso()` uses the same local-calendar-date derivation as `syncNotifications.ts`

#### Boundary: Today is Allowed

`startDateIso === todayIso` is valid — the user is logging "my period started today." Only strictly future dates (`>`) are rejected. This aligns with the Dashboard's "Log Period Start" button which uses `formatIsoDate(new Date())` — always today, never tomorrow.

---

## Prediction Recalculation Semantics

This section defines how cycle data mutations propagate through the prediction chain. All behaviors are intentional.

### The Prediction Chain

```
cycleStartDates → sort → computeCycleLengths → typicalCycleLength (median of last 3)
                                                       ↓
                                              estimateNextStart(lastStart, typLen) → targetDateIso
                                                       ↓
                                              subtractDays(targetDateIso, daysBefore) → fireDateIso
                                                       ↓
                                              makeReminderId(profileId, fireDateIso) → notification ID
```

Every value in this chain is **derived deterministically** from `cycleStartDates`. There is no cached or persisted prediction state. This means:

### Retroactive Effect of Historical Edits

**Editing any cycle start — including historical entries — retroactively changes the predicted next start date and therefore the notification schedule.**

Example: A user has cycle starts on Jan 1, Jan 29, Feb 26 (intervals: 28, 28). Typical length = 28. Predicted next = Mar 26.

If the user corrects the Jan 29 entry to Jan 31:
- Intervals become: 30, 26. Typical length = median([30, 26]) = 28. Predicted next = Mar 26. (No change in this case — median is stable.)

If the user corrects the Jan 29 entry to Feb 5:
- Intervals become: 35, 21. Typical length = median([35, 21]) = 28. Predicted next = Mar 26. (Still no change — median of 2 values is the mean.)

If the user corrects the Jan 29 entry to Feb 15:
- Intervals become: 45, 11. Typical length = median([45, 11]) = 28. Predicted next = Mar 26. (Extreme edits average out with 2 intervals.)

But with 3+ intervals, edits can shift the median:
- Starts: Jan 1, Jan 29, Feb 26, Mar 25 (intervals: 28, 28, 27). Typical = 28.
- Edit Feb 26 → Mar 5: intervals become 28, 35, 20. Typical = median([28, 35, 20]) = 28. (Median stable.)
- Edit Feb 26 → Mar 15: intervals become 28, 45, 10. Typical = median([28, 45, 10]) = 28. (Still stable — median of 3 values.)

**Key property**: The median is resilient to individual outlier edits. Typical length only shifts significantly when the majority of recent intervals change. This is a desirable property for a prediction that should not be overly sensitive to data corrections.

### State Transitions by Mutation Type

| Mutation | Typical Length | Last Start | Next Estimate | Notifications |
|---|---|---|---|---|
| **Add** (new most recent) | Recalculates — new interval added to window | Changes to new entry | Shifts forward/back based on new `typLen` | New ID scheduled; if old prediction stale, old ID cancelled |
| **Add** (historical backfill) | Recalculates — interval window may shift | Unchanged (newer entry still last) | May shift if `typLen` changes | Reconciles if prediction changed |
| **Edit** (most recent) | Recalculates — last interval changes | Changes to edited date | Shifts | Reconciles |
| **Edit** (historical) | Recalculates — one or two intervals change | Unchanged | May shift if `typLen` changes | Reconciles if prediction changed |
| **Delete** (most recent) | Recalculates — last interval removed | Falls back to second-most-recent | Shifts | Reconciles |
| **Delete** (historical) | Recalculates — one interval removed | Unchanged | May shift | Reconciles if prediction changed |
| **Delete** (leaves 2 starts) | `null` (1 interval < minimum 2) | Second-most-recent | `null` | All cancelled |
| **Delete** (leaves 1 start) | `null` (no intervals) | Sole remaining entry | `null` | All cancelled |
| **Delete** (leaves 0 starts) | `null` | `null` | `null` | All cancelled |

### Guarantee

After every mutation, `syncNotifications()` is called. Because all predictions are derived from current data (no cache), the notification plan always reflects the latest state. The set-diff reconciliation ensures minimal alarm churn — only changed IDs are cancelled/scheduled.

## Consequences

### New Files
- `src/domain/errors.ts` — `DuplicateCycleStartError`, `FutureDateError`, `assertNotFutureDate()`

### Repository Interface
- Grows by 2 methods: `deleteCycleStart()`, `updateCycleStart()`
- `addCycleStart()` gains two checks: duplicate `(profileId, startDateIso)` → `DuplicateCycleStartError`, future date → `FutureDateError`
- `updateCycleStart()` gains same two checks (duplicate excludes self)
- `quickLogCycleStart()` duplicate check kept as fast-path optimization (returns `"already_exists"` without error)

### Domain Layer
- `computeCycleLengths()` — sole sort owner, parameter renamed to `startDatesIso`
- `typicalCycleLength()` — returns `null` with < 2 intervals (was: < 1). Users with exactly 2 starts no longer receive predictions.
- `buildNotificationPlan()` — uses `reduce` max-comparison for `lastStart`, no sort
- `loadDashboardData.ts`, `syncNotifications.ts` — `.sort()` calls removed

### Behavioral Changes
- Users with exactly 2 cycle starts: `typicalLength` → `null`, `nextEstimate` → `null`, notifications not scheduled (was: single-interval prediction). Predictions appear after third start.
- Future dates rejected: `addCycleStart("2099-01-01")` → `FutureDateError`. Today is allowed.
- Historical edits retroactively affect predictions — intentional, documented (no cached prediction state)

### Unchanged
- No Realm schema version bump — no new object types, no property changes
- Return type of `listCycleStarts()` unchanged
- `reconcileNotifications.ts`, `estimateNextStart()`, `computeCycleDay()` unchanged
