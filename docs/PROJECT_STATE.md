# FlowCycle App — Project State

> Authoritative session-to-session snapshot. Read this before making changes.
> Update after every milestone or significant change.

**Last updated**: 2026-02-25 (v0.4.3 released, Milestone 3 complete)

---

## Current Status

| Field | Value |
|---|---|
| Version | 0.4.3 (stable, released) |
| Branch | `main` |
| Tests | 198 passed, 3 todo (Realm-specific manual), 0 failures |
| Types | `tsc --noEmit` clean |
| Tags | `v0.4.0-rc1`, `v0.4.1`, `v0.4.2`, `v0.4.3` |
| EAS builds | `76a2ef96` (v0.4.0-rc1, preview) |
| Milestone 3 | COMPLETE — UX Implementation (v0.4.3) |
| Next action | Milestone 4 — UX Refinement (beauty + clarity + reduced friction) |

## Architecture

```
App.tsx (bootstrap + gate hierarchy: loading → lock → onboarding → main app)
├── src/db/           Repository pattern: repo.ts (interface), realmRepo.ts (active), memoryRepo.ts (test), sqliteRepo.ts (retained fallback)
├── src/domain/       Pure logic: cycleMath, notificationPlan, reconcileNotifications, syncNotifications, AppState, LockState, OnboardingState
├── src/screens/      11 screens (Dashboard, Profiles, CycleLog, Settings, Lock, Onboarding×5, SetupPin)
├── src/navigation/   TabNavigator (Dashboard | Profiles | Settings) with nested native stacks
├── src/ui/           Design system: tokens, 13 components (AppText, AppButton, CycleDayRing, PinPad, etc.)
├── src/hooks/        useAppLock, useDashboardData
└── src/utils/        date.ts, notificationAdapter.ts (interface), expoNotificationAdapter.ts
```

### Notifications (v0.4)

Three-layer architecture — domain never imports Expo:

| Layer | File | Responsibility |
|---|---|---|
| Domain | `notificationPlan.ts` | Pure: forecast reminders, compute set-diff plan |
| Reconciliation | `reconcileNotifications.ts` | Adapter-injected: cancel stale, schedule new, filter past |
| Infrastructure | `expoNotificationAdapter.ts`, `syncNotifications.ts` | Expo API + orchestrator |

- ID format: `fc-remind-{profileId}-{fireDateIso}T{HH:mm}`
- Tracked IDs persisted in AsyncStorage (`flowcycle.trackedNotificationIds`)
- 9 sync trigger points: bootstrap, foreground resume, quick-log, add-cycle, edit-cycle, delete-cycle, toggle pref, days-before change, profile switch
- Concurrency guard: module-level `syncInFlight` boolean drops overlapping calls

### Timezone Behavior (v0.4.1)

| Aspect | Implementation |
|---|---|
| "Today" derivation | Local calendar date (`getFullYear/Month/Date`) in `syncNotifications.ts` |
| Cycle arithmetic | UTC (`Date.UTC`, `getUTCFullYear/Month/Date`) in `cycleMath.ts` — unchanged |
| Fire time | 9 AM local (`new Date(y, m, d, 9)`) in `reconcileNotifications.ts` — unchanged |
| ID generation | Uses UTC-derived `fireDateIso` — timezone-independent, deterministic |
| Foreground re-sync | `AppState.addEventListener("change")` in `App.tsx` triggers `syncNotifications()` on background→active transition |
| Timezone change detection | Via foreground re-sync only — no `TIMEZONE_CHANGED` broadcast listener |

### Reliability Guarantees (Milestone 1)

| Guarantee | Mechanism |
|---|---|
| Reboot persistence | Expo's `BOOT_COMPLETED` receiver re-schedules from `SharedPreferences` — no app open required |
| Battery/Doze | `setExactAndAllowWhileIdle` (Doze-piercing); fallback to `setAndAllowWhileIdle` on API 31+ without exact alarm permission |
| Timezone changes | Foreground re-sync on `AppState` background→active transition; local `todayIso` derivation |
| Concurrency | `syncInFlight` boolean drops overlapping async calls |
| Idempotency | Deterministic IDs + set-diff reconciliation; duplicate calls produce empty plans |
| Force-stop recovery | Bootstrap sync on next app open re-schedules from Realm data |
| App update | Expo's `MY_PACKAGE_REPLACED` receiver re-schedules all alarms |

**Known limitations:**
- If the user changes timezone but never reopens the app, the previously scheduled alarm fires at 9 AM in the **old** timezone. The next app open corrects this.
- No `TIME_SET` listener — manual system time changes are caught on next foreground.
- Foreground sync is fire-and-forget; if it fails, the next user action triggers another sync.

### Data Integrity (Milestone 2 — v0.4.2)

Repository-layer invariants enforced on all 3 implementations (Realm, Memory, SQLite):

| Invariant | Mechanism |
|---|---|
| Uniqueness | `(profileId, startDateIso)` duplicate check on `addCycleStart()` and `updateCycleStart()` — throws `DuplicateCycleStartError` |
| Future-date rejection | `assertNotFutureDate()` on `addCycleStart()` and `updateCycleStart()` — throws `FutureDateError` |
| Canonical sort | `computeCycleLengths()` is the sole sort point in the computation pipeline — `[...dates].sort()` at entry |
| Prediction threshold | `typicalCycleLength()` requires >= 2 intervals (3 cycle starts) before returning non-null |
| Mutation → sync | Every cycle mutation (add, edit, delete) triggers `syncNotifications()` fire-and-forget |

Mutation operations:

| Operation | Method | Validation |
|---|---|---|
| Add | `addCycleStart(profileId, dateIso)` | ISO format, not future, not duplicate |
| Edit | `updateCycleStart(id, newDateIso)` | ISO format, not future, not duplicate (excluding self) |
| Delete | `deleteCycleStart(id)` | Idempotent (no-op if not found) |

UI wiring (CycleLogScreen):
- Edit: inline date picker with Save/Cancel actions
- Delete: deferred undo pattern (5s window, flush on blur/background)
- Error display: `ErrorBanner` with typed domain error messages (`DuplicateCycleStartError`, `FutureDateError`)
- Post-mutation: shared `fireAndForgetSync()` helper triggers notification reconciliation
- Cycle metadata: `computeEntryMeta()` displays cycle number + interval per entry card

### UX System (Milestone 3 — v0.4.3)

| Feature | Implementation |
|---|---|
| Tab icons | Feather stroke icons via `@expo/vector-icons` replacing emoji labels |
| Profile accents | 2px left border on profile cards using `AVATAR_PALETTE`; 8px active dot |
| Avatar palette | 6 colors darkened to 3.0–3.17:1 contrast ratio vs white (WCAG AA non-text) |
| Profile context | ProfileAvatar in CycleLog header; profile name in Settings toggle label |
| Deferred undo | `DeferredDelete` class: 5s timer, flush on blur/background/new request, idempotent |
| Native date picker | `@react-native-community/datetimepicker`; local-timezone `localDateToIso`/`isoToLocalDate` |
| Cycle captions | `Cycle #N · X days` below each entry date; `computeEntryMeta()` pure function |

### Encryption

| Aspect | Value |
|---|---|
| Database | Realm, 64-byte AES-256, `flowcycle.realm` |
| Key storage | `expo-secure-store`, key name `realm_encryption_key_v1` |
| Key encoding | Hex (128 chars), `bytesToHex`/`hexToBytes` in `realmRepo.ts:50-72` |
| Schema version | 2 (v1→v2 additive: `NotificationPreference` table) |
| Missing-key guard | Throws error, does not silently wipe |

## Milestones

| Milestone | Status | Key Deliverables |
|---|---|---|
| v0.1-spike-core | Done | Repo interface, SQLite+memory, cycle math, navigation, notifications utils |
| v0.2-encrypted-storage | Done | Realm encrypted repo, expo-crypto, expo-secure-store, verification checklist |
| v0.3-1 design-system | Done | Tokens, 8 foundational components |
| v0.3-2 app-lock | Done | PIN + biometric, exponential backoff, SecureStore |
| v0.3-3 onboarding | Done | 4-step flow, crash-recovery, AsyncStorage flag |
| v0.3-4 dashboard | Done | CycleDayRing, ProfileAvatar, quick-log |
| v0.3-5 navigation | Done | Bottom tabs, nested stacks, Settings hub |
| v0.4 notifications | Done | 3-layer architecture, 10 commits, 139 tests passing |
| v0.4.1 timezone-sync | Done | Local todayIso, foreground re-sync, concurrency guard. `TIMEZONE_CHANGED` broadcast intentionally deferred (ADR 0007). |
| **Milestone 1** | **COMPLETE** | **Notification Reliability — v0.4 + v0.4.1. All reliability guarantees verified.** |
| v0.4.2 data-integrity | Done | Repo-layer uniqueness + future-date enforcement, edit/delete cycle starts, canonical sort, prediction threshold, 166 tests |
| **Milestone 2** | **COMPLETE** | **Data Integrity & Cycle Editing — v0.4.2. All mutation invariants enforced across 3 repo implementations. Emulator regression PASS (2026-02-25).** |
| v0.4.3 ux-impl | Done | Feather icons, profile accents, deferred undo, native date picker, cycle captions, 198 tests |
| **Milestone 3** | **COMPLETE** | **UX Implementation — v0.4.3. Design system applied across all screens. WCAG-compliant palette. Deferred undo + native date picker in CycleLog.** |
| **Milestone 4** | **NEXT** | **UX Refinement — beauty + clarity + reduced friction. No algorithmic insights.** |

## ADRs

| # | Title | Key Decision |
|---|---|---|
| 0001 | Local-Only Core | No accounts, all data on-device |
| 0002 | Single Encrypted DB | One Realm file, partitioned by `profile_id` |
| 0003 | Hex Encoding | Hex over base64 for SecureStore key persistence |
| 0004 | Onboarding Flow | State-machine wrapper, AsyncStorage flag, gate hierarchy |
| 0005 | App Lock | SHA-256+salt PIN, exponential backoff, optional biometric |
| 0006 | Notification Preferences | Realm storage, adapter pattern, deterministic IDs, 3-layer arch |
| 0007 | Local Timezone Sync | Local todayIso, foreground re-sync, no broadcast receivers (yet) |
| 0008 | Cycle Mutation Semantics | Repo-layer uniqueness (D1), typed domain errors (D2-D3), idempotent delete (D4), canonical sort ownership (D6), prediction threshold >= 2 intervals (D7), future-date rejection (D8) |

## Known Issues

| Issue | Detail |
|---|---|
| No delete-profile UI | `deleteProfile()` exists on repo interface, called only in tests; needs `syncNotifications` wiring when UI added |
| 3 manual-only Realm migration tests | JSI unavailable in Jest; `it.todo()` in `realmRepo.migration.test.ts` |
| `expo-sqlite` still in plugins | Loaded but not active (`app.json:31`) |
| Doc bug in verification.md | Encryption checklist step 3 references `flowcycle_realm_key` but code uses `realm_encryption_key_v1` |
| Root `PROJECT_STATE.md` stale | Gitignored local file from Roo era; superseded by this file |
| ~~No date picker~~ | RESOLVED in v0.4.3 — native `@react-native-community/datetimepicker` replaces text input |

## Tech Stack

| Component | Version |
|---|---|
| Expo SDK | 54.0.33 |
| React Native | 0.81.5 (New Architecture) |
| React | 19.1.0 |
| TypeScript | 5.9.2 (strict) |
| Realm | 20.2.0 |
| Node test runner | Jest 29.7.0 + ts-jest |

## Dev Environment

```
macOS / Apple Silicon
JDK: Azul Zulu 17 | Android SDK: Platform 36 | Emulator: Pixel_API_36
Build: npx expo run:android | Test: npm test | Types: npx tsc --noEmit
Package: com.ckaburu.flowcycleapp
```
