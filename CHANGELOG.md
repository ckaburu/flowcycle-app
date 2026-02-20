# Changelog

## Unreleased (v0.4.1)
- Fixed timezone bug: `todayIso` now uses local calendar date instead of UTC, aligning past-date filtering with the reconciliation layer's local-time fire dates.
- Added foreground re-sync: `syncNotifications()` runs on every background→active AppState transition, catching timezone changes, midnight rollovers, and Doze alarm resets.
- Added concurrency guard: module-level `syncInFlight` boolean drops overlapping sync calls.
- Memoized `ExpoNotificationAdapter` instance in `App.tsx` (single allocation, shared across bootstrap and foreground sync).
- DEV-only notification harness (5s / 30s test scheduling).
- Cancel-all test utility.
- Added ADR 0007: local timezone sync decisions.
- Added timezone and foreground sync verification checklist (Task G).

## v0.4-meaningful-notifications
- Added three-layer notification architecture: Domain → Reconciliation → Infrastructure.
- Added `NotificationPreference` to `Repository` interface with `MemoryRepo`, `RealmRepo`, and `SQLiteRepo` implementations.
- Added `NotificationPreferenceSchema` to Realm with schema version 2 (additive migration, no data transformation).
- Added `NotificationAdapter` interface with `MemoryNotificationAdapter` (testing) and `ExpoNotificationAdapter` (production).
- Added `notificationPlan.ts` domain module: deterministic ID generation (`fc-remind-{profileId}-{dateIso}`), multi-cycle forecasting (MVP-constrained to `maxReminders=1`).
- Added `reconcileNotifications.ts` reconciliation layer: diff-based scheduling with past-fire-date filtering, structured `SyncLogger` interface.
- Added `syncNotifications.ts` orchestrator: single entry point coordinating repo → domain → reconciliation → adapter.
- Added `devSyncLogger` for DEV-only structured logging with `[NotifSync]` prefix.
- Added Notifications section to `SettingsScreen` with period reminder toggle and cycle day display.
- Wired fire-and-forget `syncNotifications` into `App.tsx` bootstrap, `SettingsScreen` toggle, `DashboardScreen` quick-log, and `CycleLogScreen` add-cycle.
- Added ADR 0006: notification preference storage and adapter pattern decisions.
- Added migration tests: 3 automated (MemoryRepo contract proxy) + 3 manual (Realm-specific).

## v0.3-5-navigation-restructure
- Added bottom tab navigation with three tabs: Dashboard, Profiles, Settings.
- Added `@react-navigation/bottom-tabs` dependency.
- Added `ListItem` and `SectionHeader` reusable UI components.
- Added central navigation type hierarchy (`src/navigation/types.ts`) with `TabParamList`, `DashboardStackParamList`, `ProfilesStackParamList`, `SettingsStackParamList`.
- Added `TabNavigator` with nested native stacks per tab.
- Added `SettingsScreen` as settings hub with PIN set/change/remove via `ListItem` navigation.
- Updated `DashboardScreen` to use `CompositeScreenProps` for cross-tab navigation.
- Moved Security section from `ProfilesScreen` to `SettingsScreen`.
- Removed navigation buttons from `CycleLogScreen` (tab bar handles navigation).
- Deleted `SummaryScreen.tsx` (replaced by `DashboardScreen` in v0.3-4).
- Deleted `navigationTypes.ts` (replaced by `src/navigation/types.ts`).

## v0.3-4-dashboard
- Added `DashboardScreen` as the new initial route with cycle day ring, profile avatar, and quick-log.
- Added `CycleDayRing` component with View-based progress arc and overflow indicator.
- Added `ProfileAvatar` component with deterministic color assignment.
- Added `loadDashboardData` pure domain function with unit tests.
- Added `quickLogCycleStart` idempotent domain function with unit tests.
- Added `useDashboardData` hook with `useFocusEffect` refresh.
- Added `colors.warning` design token (#E6A23C).
- Deprecated `SummaryScreen` (marked for deletion in v0.3-5).

## v0.3-3-onboarding
- Added three-step onboarding flow: Welcome → Create First Profile → PIN Prompt.
- Added `OnboardingState` module with AsyncStorage persistence.
- Added `OnboardingFlow` state-machine wrapper component.
- Added `WelcomeScreen`, `CreateFirstProfileScreen`, `PinPromptScreen`, `OnboardingPinSetup` screens.
- Added gate hierarchy in `App.tsx`: `isReady → hasPinSet && isLocked ? LockScreen : !onboardingCompleted ? OnboardingFlow : MainApp`.
- Added ADR 0004: onboarding flow design decisions.

## v0.3-2-app-lock
- Added PIN-based app lock with SHA-256 hashing and random salt via `expo-crypto`.
- Added exponential backoff lockout (30s → 60s → 120s → 300s cap) after 3+ failed attempts.
- Added optional biometric unlock via `expo-local-authentication`.
- Added `LockState` module with `expo-secure-store` credential persistence.
- Added `useAppLock` hook for background timeout (30s) re-lock.
- Added `LockScreen` with `PinPad` component and lockout timer display.
- Added `SetupPinScreen` for PIN set/change/remove flows.
- Added comprehensive `lockState.test.ts` unit tests.
- Added ADR 0005: app lock design decisions.

## v0.3-1-design-system
- Added design token module (`src/ui/tokens.ts`) with colors, typography, spacing, radii, and elevation.
- Added foundational UI components: `AppText`, `AppButton`, `AppInput`, `AppCard`, `ScreenContainer`, `EmptyState`, `ErrorBanner`, `LoadingIndicator`.
- Added `PinPad` component for PIN entry.
- All components follow design system tokens for consistent theming.

## v0.2-encrypted-storage
- Migrated primary storage from SQLite to Realm with 64-byte AES-256 encryption.
- Added `expo-crypto` for secure key generation (fills full 64-byte buffer required by Realm).
- Added `expo-secure-store` for persisting the encryption key in the Android Keystore.
- Encryption key is stored as hex-encoded string (safe for SecureStore's UTF-8 constraint).
- Added guard: app refuses to open if an existing Realm file is found but the key is missing from SecureStore.
- SQLite repository (`sqliteRepo.ts`) retained as fallback — switchable via factory in `src/db/index.ts`.
- Memory repository (`memoryRepo.ts`) retained for unit testing.
- All existing tests pass against memory repo.
- Added ADR 0002: single encrypted database (one file, partitioned by `profile_id`).

## v0.1-spike-core
- Added offline profile and cycle log flows for local tracking.
- Added summary calculations (cycle day, typical cycle length, next estimate) with deterministic unit tests.
- Added local notification scheduling utilities and Summary screen actions for development builds.
- Added a repository boundary with a strict interface and both memory and SQLite implementations.
- Added lightweight navigation with persisted active profile state.
