# Changelog

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
