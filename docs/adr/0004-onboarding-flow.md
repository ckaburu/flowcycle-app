# ADR 0004: Onboarding Flow and First-Launch Detection

## Status
Accepted

## Context
FlowCycle needs a first-launch experience that creates the user's initial profile and optionally sets a PIN. Without onboarding, users land on an empty Profiles screen with no guidance. The onboarding must integrate with the existing AppLock gate without causing the LockScreen to flash before onboarding on first launch.

## Decision
Implement a **state-machine wrapper component** (`OnboardingFlow`) that renders step components with `onNext` callbacks. This is not a nested navigator — it lives outside the `Stack.Navigator` entirely.

### First-launch detection
- A single AsyncStorage key `flowcycle.onboardingCompleted` (value `"true"` or absent) gates the flow.
- Read at boot via `loadOnboardingCompleted()` into a module-level cache, same pattern as `AppState.ts`.
- Written once via `completeOnboarding()` at the end of the final onboarding step.

### Root gate hierarchy
App.tsx evaluates gates in strict order (first match wins):

1. `!isReady` → `LoadingIndicator`
2. `hasPinSet && isLocked` → `LockScreen`
3. `!onboardingCompleted` → `OnboardingFlow`
4. else → `NavigationContainer` (main app)

The `hasPinSet` guard ensures the LockScreen only renders when a PIN actually exists. On first launch (no PIN), the lock gate is skipped and onboarding renders immediately.

### Onboarding steps
1. **WelcomeScreen** — app intro, "Get Started" button.
2. **CreateFirstProfileScreen** — name input, creates profile, saves `activeProfileId`.
3. **PinPromptScreen** — "Secure your data with a PIN?" with set/skip options.
4. **OnboardingPinSetup** — PinPad enter + confirm, calls `setPin()`.

Steps 3–4 are optional (user can skip PIN). After the final step, `completeOnboarding()` writes the AsyncStorage flag.

### Crash recovery (idempotent re-entry)
If the app crashes after profile creation but before `completeOnboarding()`:
- `CreateFirstProfileScreen` detects existing profiles on mount and auto-advances.
- `PinPromptScreen` detects existing PIN via `isPinSet()` and auto-completes.
- If PIN was set, next launch shows LockScreen (correct — `hasPinSet && isLocked`), then resumes onboarding after unlock.

## Consequences
- First launch goes directly to onboarding with no lock flash.
- Returning users with a PIN see LockScreen before main app (unchanged behavior).
- One new AsyncStorage key. No new npm dependencies.
- One minor addition to `LockState.ts`: `hasPinSet` field on `LockStateData` (populated by existing `initLockState()`).
- Onboarding screens use only existing design system components.
- No changes to existing screens or navigation routes.
