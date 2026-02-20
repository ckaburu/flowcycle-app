# ADR 0006: Notification Preference Storage and Adapter Pattern

## Status
Accepted

## Context
v0.4 adds per-profile notification preferences and cycle-aware scheduling. We need to decide: (1) where to store preferences, (2) how to isolate platform notification APIs from domain logic.

## Decisions

**D1: Store `NotificationPreference` in Realm.**
- Cascade delete with profiles (atomic transaction).
- Encrypted at rest (same 64-byte AES-256 key as all other Realm data).
- Single source of truth for profile-scoped data.
- Schema migration v1 → v2 is additive: Realm auto-creates the new object type.

**D2: `NotificationAdapter` interface for platform isolation.**
- Domain and reconciliation layers never import Expo.
- `ExpoNotificationAdapter` is the sole Expo-dependent implementation.
- `MemoryNotificationAdapter` enables full-stack testing without mocks.
- Three methods: `schedule(id, fireDate, title, body)`, `cancel(id)`, `cancelAll()`.

**D3: Deterministic notification IDs (`fc-remind-{profileId}-{fireDateIso}T{HH:mm}`).**
- Eliminates need for key→ID mapping storage.
- Guarantees idempotency via Expo's identifier-based replacement.
- Same inputs → same IDs → no duplicates.
- Fire timestamp is encoded in the ID for debuggability.

**D4: Domain returns N reminders, MVP schedules first.**
- `buildNotificationPlan(maxReminders)` is future-proof for multi-cycle forecasting.
- No domain redesign needed when `maxReminders` increases.
- MVP constrains to `maxReminders = 1`.

**D5: Three-layer architecture.**
- **Domain** (`notificationPlan.ts`): pure TS, no side effects, time-injected.
- **Reconciliation** (`reconcileNotifications.ts`): adapter-injected, computes diff, calls adapter.
- **Infrastructure** (`expoNotificationAdapter.ts`, `syncNotifications.ts`): Expo-specific or AsyncStorage-specific.

**D6: Fire-and-forget sync pattern.**
- `syncNotifications(repo, adapter, logger?)` is called after every mutation (cycle log, profile select, bootstrap).
- Failures are caught and logged, never surfaced to the user.
- DEV-only `devSyncLogger` provides structured `[NotifSync]` console output.

## Consequences
- Realm schema migration v1 → v2 is additive and low risk. Rollback: delete Realm file (re-created on next open, preferences lost but cycle data re-entered).
- `MemoryRepo` implements 4 new methods: `getNotificationPreference`, `setNotificationPreference`, `deleteNotificationPreference`, `listNotificationPreferences`.
- `notifications.ts` retains only permission + test helpers; scheduling moves to adapter.
- Reconciliation is fully testable without Expo mocks (49 new tests total).
- `deleteProfile` cascades to `NotificationPreference` in both Realm and Memory repos.
