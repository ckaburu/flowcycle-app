# FlowCycle App — Project State

> Authoritative session-to-session snapshot. Read this before making changes.
> Update after every milestone or significant change.

**Last updated**: 2026-02-20 (v0.4 code complete, pending device validation)

---

## Current Status

| Field | Value |
|---|---|
| Version | 0.4.0 (`app.json`, `package.json`) |
| Branch | `feature/encryption` (sole active branch) |
| Uncommitted | 9 files: notification ID-format fix, version bump, verification docs, Settings version display |
| Tests | 133 passed, 3 todo (Realm-specific manual), 0 failures |
| Types | `tsc --noEmit` clean |
| EAS builds | `a375aa22` (original), `d97e3446` (post ID-fix) — both `preview` profile, Android |
| Next action | Commit uncommitted changes → Samsung physical validation → distribute APK |

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
- 6 sync trigger points: bootstrap, quick-log, add-cycle, toggle pref, days-before change, profile switch

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
| v0.4 notifications | Code complete | 3-layer architecture, 10 commits, 133 tests passing |

## ADRs

| # | Title | Key Decision |
|---|---|---|
| 0001 | Local-Only Core | No accounts, all data on-device |
| 0002 | Single Encrypted DB | One Realm file, partitioned by `profile_id` |
| 0003 | Hex Encoding | Hex over base64 for SecureStore key persistence |
| 0004 | Onboarding Flow | State-machine wrapper, AsyncStorage flag, gate hierarchy |
| 0005 | App Lock | SHA-256+salt PIN, exponential backoff, optional biometric |
| 0006 | Notification Preferences | Realm storage, adapter pattern, deterministic IDs, 3-layer arch |

## Known Issues

| Issue | Detail |
|---|---|
| No delete-cycle-start UI | Can add but not remove entries |
| No delete-profile UI | `deleteProfile()` exists on repo interface, called only in tests; needs `syncNotifications` wiring when UI added |
| 3 manual-only Realm migration tests | JSI unavailable in Jest; `it.todo()` in `realmRepo.migration.test.ts` |
| `expo-sqlite` still in plugins | Loaded but not active (`app.json:31`) |
| Doc bug in verification.md | Encryption checklist step 3 references `flowcycle_realm_key` but code uses `realm_encryption_key_v1` |
| Root `PROJECT_STATE.md` stale | Gitignored local file from Roo era; superseded by this file |

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
