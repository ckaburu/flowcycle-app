# Encryption Verification Checklist

Manual steps to verify that Realm encryption is working correctly in a development build.

## Prerequisites
- Android emulator running (`Pixel_API_36` or physical device)
- Development build installed (`npx expo run:android`)
- `adb` available on PATH (`$ANDROID_HOME/platform-tools`)

## 1. Verify Realm File Exists

```bash
adb shell run-as com.ckaburu.flowcycleapp ls -la files/
```

Expected: A file named `flowcycle.realm` (and possibly `.lock` / `.management` files).

## 2. Verify Realm File Is Encrypted (Not Readable as Plain Text)

```bash
adb shell run-as com.ckaburu.flowcycleapp cat files/flowcycle.realm | head -c 64 | xxd
```

Expected: Random-looking binary data. If the file were unencrypted, you would see Realm's magic header bytes or readable schema strings.

## 3. Verify Key Is in SecureStore

```bash
adb shell run-as com.ckaburu.flowcycleapp cat shared_prefs/com.ckaburu.flowcycleapp.SecureStore.xml
```

Expected: An XML entry with key `flowcycle_realm_key` containing a 128-character hex string (representing the 64-byte encryption key). The value itself is encrypted by Android Keystore, so you'll see the SecureStore wrapper — but the entry should exist.

> **Note**: On newer Android versions, SecureStore may use EncryptedSharedPreferences, which means the file contents are encrypted. The presence of the file and key name is sufficient to confirm the key was stored.

## 4. Verify Key Survives App Restart

1. Open the app and create a profile.
2. Force-kill the app: `adb shell am force-stop com.ckaburu.flowcycleapp`
3. Reopen the app.
4. Expected: The profile you created is still visible — the key was retrieved from SecureStore and used to decrypt the Realm.

## 5. Verify Missing-Key Guard

> **⚠️ Destructive test** — only do this on emulator or test device.

1. Open the app and create a profile (so a Realm file exists).
2. Clear SecureStore but keep the Realm file:
   ```bash
   adb shell run-as com.ckaburu.flowcycleapp rm shared_prefs/com.ckaburu.flowcycleapp.SecureStore.xml
   ```
3. Force-kill and reopen the app.
4. Expected: The app logs an error:
   ```
   Missing encryption key "flowcycle_realm_key" for existing Realm at "flowcycle.realm".
   ```
   The app should show the loading state and not crash — the error is caught in `App.tsx` bootstrap.

## 6. Verify Fresh Install Creates New Key

1. Uninstall the app: `adb uninstall com.ckaburu.flowcycleapp`
2. Reinstall: `npx expo run:android`
3. Open the app and create a profile.
4. Repeat step 3 above — verify a new key exists in SecureStore.
5. Verify the new Realm file is created and the profile data is accessible.

## Summary

| Check | What It Proves |
|---|---|
| Realm file exists | Database is created on first use |
| File is not readable as plain text | Encryption is active |
| Key in SecureStore | Key persists across sessions |
| App restart preserves data | Key retrieval and decryption work |
| Missing key blocks access | Guard prevents silent data loss |
| Fresh install creates new key | Key generation works end-to-end |

---

# v0.4 Meaningful Notifications — Ship Readiness Report

Verified: 2026-02-19 (branch `feature/encryption`)

## Gate Checks

| # | Gate | Result | Notes |
|---|------|--------|-------|
| 1 | `git status` clean | ✅ | `nothing to commit, working tree clean` |
| 2 | `npm test` green | ✅ | 12 suites, 132 passed, 3 todo, 0 failures |
| 3 | `tsc --noEmit` clean | ✅ | No type errors |
| 4 | All 10 commits present | ✅ | `cf58202`→`2ce69c5` |

## Task 1 — Current State

All 10 v0.4 commits on `feature/encryption`:

| # | Hash | Message |
|---|------|---------|
| 1 | `cf58202` | feat(v0.4): add NotificationPreference to Repository interface and MemoryRepo |
| 2 | `43c2aa5` | feat(v0.4): add NotificationPreferenceSchema to Realm + schemaVersion 2 |
| 3 | `2fa4032` | feat(v0.4): add NotificationAdapter interface + MemoryNotificationAdapter |
| 4 | `3b1f3f4` | feat(v0.4): add notificationPlan.ts domain module with tests |
| 5 | `f70e9cd` | feat(notifications): add reconcileNotifications with adapter-based + idempotency tests |
| 6 | `7c18a5a` | feat(notifications): add syncNotifications orchestrator + devSyncLogger + tests |
| 7 | `c06648f` | feat(notifications): add ExpoNotificationAdapter |
| 8 | `74726f5` | feat(notifications): add Notifications section to SettingsScreen |
| 9 | `af45933` | feat(notifications): wire syncNotifications into App.tsx and action points |
| 10 | `2ce69c5` | docs: add ADR 0006, migration tests, and CHANGELOG for v0.4 |

## Task 2 — Sync Trigger Verification

All required `syncNotifications()` call sites confirmed:

| Trigger Point | File | Lines | Pattern |
|---|---|---|---|
| App bootstrap | `App.tsx` | 80-86 | fire-and-forget |
| Quick-log period | `DashboardScreen.tsx` | 54-58 | fire-and-forget |
| Add cycle start | `CycleLogScreen.tsx` | 83-87 | fire-and-forget |
| Toggle preference | `SettingsScreen.tsx` | 91-95 | awaited |
| Days-before change | `SettingsScreen.tsx` | 111-115 | awaited |
| Profile switch | `ProfilesScreen.tsx` | 83-87 | fire-and-forget |

**Note:** No `deleteProfile` UI exists in any screen. The `deleteProfile()` method is defined on the `Repository` interface and called only in tests. When a delete-profile UI is added (future milestone), `syncNotifications` must be wired after the call.

## Task 3 — Deterministic IDs

| Aspect | Implementation | Verdict |
|---|---|---|
| ID format | `fc-remind-{profileId}-{fireDateIso}T{HH:mm}` | ✅ Includes fire timestamp for correct reconciliation |
| Uniqueness | One reminder per profile per predicted cycle start date | ✅ |
| Fire time | `parseIsoLocalDateAtNine()` → 09:00 local time | ✅ Applied at scheduling layer |
| Generator | `makeReminderId()` in `notificationPlan.ts:48-53` | ✅ Pure function |

The ID format is `fc-remind-{profileId}-{fireDateIso}T{HH:mm}` — includes the full fire timestamp. This ensures that if a user changes their notification time-of-day preference, the ID changes and reconciliation correctly cancels the old schedule and creates a new one. The fire date is `daysBefore` days before the predicted target date.

## Task 4 — Set-Diff Reconciliation

`computeNotificationPlan()` in `notificationPlan.ts:124-158` uses true set-diff:

```
desiredIds  = Set(desiredItems.map(item => item.id))
existingSet = Set(existingIds)
toSchedule  = desiredItems.filter(item => !existingSet.has(item.id))   // new only
toCancel    = existingIds.filter(id => !desiredIds.has(id))            // stale only
```

**Verdict:** ✅ True set-diff. Not cancel-all/reschedule-all. Idempotent — running with same inputs produces empty toSchedule and toCancel.

## Task 5 — Emulator Sanity

Manual checklist (requires dev-client, NOT Expo Go):

- [ ] Build and install: `npx expo run:android`
- [ ] Create profile, log ≥2 cycle starts
- [ ] Enable notifications in Settings → toggle ON
- [ ] Check `adb logcat | grep NotifSync` for sync log output
- [ ] Kill app, reopen → bootstrap sync fires (logcat)
- [ ] Quick-log from dashboard → sync fires
- [ ] Disable notifications → sync fires (cancels all)
- [ ] Re-enable → sync fires (schedules new)

## Final Verdict

| Area | Status |
|---|---|
| Code completeness | ✅ All 10 commits landed |
| Test suite | ✅ 132 passed, 0 failures |
| Type safety | ✅ tsc clean |
| Sync triggers | ✅ All 6 wired correctly |
| Deterministic IDs | ✅ Matches plan spec |
| Set-diff reconciliation | ✅ True set-diff, idempotent |
| Git state | ✅ Clean working tree |
| Emulator sanity | ⏳ Manual step (checklist above) |

**v0.4 is ship-ready** pending manual emulator sanity check.

---

# v0.4.0 Internal Beta — Device Verification

## Build Info

| Field | Value |
|---|---|
| Version | 0.4.0 |
| Build ID | `a375aa22-6b49-4f37-bc9f-66f0348eea7b` |
| Profile | preview (distribution: internal) |
| Platform | Android |
| Git commit | `2ce69c5` |
| Status | ✅ FINISHED |
| APK | https://expo.dev/artifacts/eas/mbHiyfH6cRJNFPXaVC1ToT.apk |

## Task D — Manual Device Verification Checklist

### D1. Fresh Install

- [ ] Download APK from EAS build artifacts
- [ ] Install on physical device (or emulator)
- [ ] App launches without crash
- [ ] No ANR or white-screen on cold start

### D2. Onboarding Flow

- [ ] Welcome screen appears on first launch
- [ ] "Get Started" navigates to Create First Profile
- [ ] Enter profile name → profile created successfully
- [ ] PIN setup prompt appears
- [ ] Set 6-digit PIN → completes onboarding
- [ ] Dashboard screen appears with new profile

### D3. Core Features

- [ ] Dashboard shows cycle day ring (empty state if no data)
- [ ] Quick-log period button works → logs cycle start
- [ ] Cycle day ring updates after logging
- [ ] Navigate to Profiles tab → profile visible
- [ ] Navigate to Cycle Log → logged entry visible
- [ ] Navigate to Settings → all sections render

### D4. Notifications

- [ ] Settings → "Period Reminders" toggle visible
- [ ] Enable toggle → permission prompt appears
- [ ] Grant permission → toggle stays ON
- [ ] "Days Before" picker visible when enabled
- [ ] Change days-before value → no crash
- [ ] Disable toggle → notifications cleared (check system tray)
- [ ] Re-enable toggle → notifications re-scheduled
- [ ] Settings → Version shows "0.4.0"

### D5. App Lock

- [ ] Settings → "App Lock" section visible
- [ ] PIN already set from onboarding
- [ ] Background app (30s+) → lock screen appears on return
- [ ] Enter correct PIN → unlocks
- [ ] Enter wrong PIN → error message, counter increments
- [ ] Lockout activates after threshold failures

### D6. Data Persistence

- [ ] Force-close app completely
- [ ] Reopen → lock screen (if PIN set)
- [ ] Unlock → dashboard shows previously logged data
- [ ] Profile, cycle starts, notification preferences all persisted

---

## Task E — Emulator Validation via ADB

### Prerequisites

```bash
# Ensure emulator is running
adb devices
# Should show emulator-5554 or similar

# Download APK from EAS
curl -L -o flowcycle-app-0.4.0.apk "https://expo.dev/artifacts/eas/mbHiyfH6cRJNFPXaVC1ToT.apk"

# Install APK
adb install flowcycle-app-0.4.0.apk
```

### E1. Clean Install

```bash
# Clear any previous data
adb shell pm clear com.ckaburu.flowcycleapp

# Launch app
adb shell am start -n com.ckaburu.flowcycleapp/.MainActivity
```

- [ ] App launches successfully
- [ ] Onboarding flow starts (Welcome screen)

### E2. Onboarding via Emulator

- [ ] Complete Welcome → Create Profile → PIN setup
- [ ] Dashboard appears after onboarding
- [ ] No crashes in logcat during onboarding

### E3. Log Period

- [ ] Tap quick-log button on Dashboard
- [ ] Cycle day ring updates
- [ ] Navigate to Cycle Log → entry visible with correct date

### E4. Enable Notifications

- [ ] Settings → Enable "Period Reminders" toggle
- [ ] Notification permission dialog appears
- [ ] Grant permission
- [ ] Toggle stays ON

```bash
# Verify scheduled notifications (Expo channel)
adb shell dumpsys notification | grep -A 5 "com.ckaburu.flowcycleapp"
```

- [ ] Notification channel "default" exists for app

### E5. Disable Notifications

- [ ] Settings → Disable "Period Reminders" toggle
- [ ] Toggle stays OFF
- [ ] No lingering scheduled notifications

### E6. Capture Logcat

```bash
# Start logcat filtered to app
adb logcat -s ReactNativeJS:V *:S

# Exercise the app:
# 1. Toggle notifications on/off
# 2. Log a period
# 3. Switch profiles
# Observe sync log output (DEV mode)
```

- [ ] `[NotifSync]` log lines appear on toggle/log/profile-switch
- [ ] No red-box errors
- [ ] No unhandled promise rejections
- [ ] No native crashes

### E7. Version Verification

- [ ] Settings → Version displays "0.4.0"
- [ ] `adb shell dumpsys package com.ckaburu.flowcycleapp | grep versionName` shows `0.4.0`

### E8. Stress Tests

- [ ] Rapid toggle notifications on/off (5x quickly) → no crash
- [ ] Create second profile → switch between profiles → no crash
- [ ] Background app → foreground → no crash
- [ ] Rotate device (if rotation unlocked) → no crash

---

## Task F — Production Validation (Post ID-Format Fix)

**Build**: `d97e3446-55a6-4cde-a7bd-d72a2c203fa2`
**APK**: https://expo.dev/accounts/ckaburu/projects/flowcycle-app/builds/d97e3446-55a6-4cde-a7bd-d72a2c203fa2
**Change**: Notification ID format now includes fire timestamp: `fc-remind-{profileId}-{fireDateIso}T{HH:mm}`
**Tests**: 133 passed, tsc clean

### Prerequisites

```bash
# Download new APK
curl -L -o flowcycle-app-0.4.0-fix1.apk \
  "$(eas build:view d97e3446-55a6-4cde-a7bd-d72a2c203fa2 --json 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)["artifacts"]["buildUrl"])')"

# Or install directly via device link:
# https://expo.dev/accounts/ckaburu/projects/flowcycle-app/builds/d97e3446-55a6-4cde-a7bd-d72a2c203fa2
```

### F1. Fresh Install

```bash
adb uninstall com.ckaburu.flowcycleapp 2>/dev/null
adb install flowcycle-app-0.4.0-fix1.apk
adb shell am start -n com.ckaburu.flowcycleapp/.MainActivity
```

- [ ] App launches, onboarding flow starts
- [ ] Complete onboarding (profile + PIN)
- [ ] Dashboard visible

### F2. Enable Notifications + Log Periods

- [ ] Settings → Enable "Period Reminders" toggle
- [ ] Grant notification permission
- [ ] Log at least 3 period start dates (spaced ~28 days apart)
- [ ] `[NotifSync]` log lines appear in logcat

```bash
adb logcat -s ReactNativeJS:V *:S | grep NotifSync
```

- [ ] Sync log shows `schedule:fc-remind-{id}-{date}T09:00` format (T + time present)

### F3. Change Notification Time-of-Day

> **Key test for the ID fix**: changing time must cancel old schedule and create new one.

- [ ] Settings → Change "Days Before" value (if exposed) or observe current schedule
- [ ] Note the current scheduled notification ID from logcat
- [ ] Trigger a re-sync (toggle off then on, or log new period)
- [ ] Logcat shows cancel of old ID + schedule of new ID
- [ ] Old and new IDs differ (different fire date or same date with different time suffix)

### F4. Force-Stop → Notification Persistence

```bash
# Force stop the app
adb shell am force-stop com.ckaburu.flowcycleapp

# Check if scheduled alarms persist
adb shell dumpsys alarm | grep -A 2 "com.ckaburu.flowcycleapp"
```

- [ ] Scheduled alarms still present after force-stop
- [ ] Reopen app → dashboard loads, no crash
- [ ] Notification preferences still enabled

### F5. Device Reboot → Notification Persistence

```bash
# Reboot device/emulator
adb reboot
# Wait for boot, then:
adb shell dumpsys alarm | grep -A 2 "com.ckaburu.flowcycleapp"
```

- [ ] After reboot, app still has scheduled notifications (or re-schedules on next open)
- [ ] Open app → sync runs → notifications re-scheduled

### F6. Profile Isolation

- [ ] Create second profile (Profile B)
- [ ] Enable notifications for Profile B
- [ ] Log 3 cycle starts for Profile B
- [ ] Logcat shows IDs with Profile B's profileId (different from Profile A)
- [ ] Disable notifications for Profile A
- [ ] Profile B's notifications remain scheduled
- [ ] Profile A's notifications cancelled

```bash
adb logcat -s ReactNativeJS:V *:S | grep "fc-remind"
```

- [ ] IDs contain correct profileId for each profile
- [ ] No cross-profile contamination

### F7. Idempotency Verification

- [ ] Toggle notifications off then on (same data, no changes)
- [ ] Logcat shows second sync has 0 schedule / 0 cancel operations
- [ ] Adapter not called after first sync with unchanged data

### F8. Logcat Capture

```bash
# Full logcat capture during test session
adb logcat -d > flowcycle-validation-f-logcat.txt

# Filter for notification-related lines
grep -E "(NotifSync|fc-remind|schedule|cancel)" flowcycle-validation-f-logcat.txt
```

- [ ] No unhandled promise rejections
- [ ] No red-box errors
- [ ] No native crashes
- [ ] All `[NotifSync]` events have correct ID format with `T{HH:mm}` suffix

---

## v0.4.0-rc1 — Release Candidate Build

| Field | Value |
|---|---|
| Tag | `v0.4.0-rc1` |
| Commit | `49c0cb0` |
| Build ID | `76a2ef96-6e34-45a2-a96c-b68e6a5e591d` |
| Profile | preview (distribution: internal) |
| Platform | Android |
| Status | FINISHED |
| APK | https://expo.dev/artifacts/eas/fDFHsQ3z7RFEaKwfQNdwvk.apk |
| Install link | https://expo.dev/accounts/ckaburu/projects/flowcycle-app/builds/76a2ef96-6e34-45a2-a96c-b68e6a5e591d |
| Built | 2026-02-20 |

### What's in this RC (vs previous builds)

- Notification ID format includes fire timestamp (`fc-remind-{profileId}-{fireDateIso}T{HH:mm}`)
- Version bumped to 0.4.0 in app.json + package.json
- Settings screen reads version from expo-constants (dynamic)
- 133 tests passing, tsc clean

### Validation

Use **Task F** checklist above with this APK. Replace earlier build references:

```bash
# Download RC APK
curl -L -o flowcycle-app-v0.4.0-rc1.apk \
  "https://expo.dev/artifacts/eas/fDFHsQ3z7RFEaKwfQNdwvk.apk"

# Install
adb uninstall com.ckaburu.flowcycleapp 2>/dev/null
adb install flowcycle-app-v0.4.0-rc1.apk
adb shell am start -n com.ckaburu.flowcycleapp/.MainActivity
```

---

## DEV Test Notification Procedure

Requires a `__DEV__` build (`npx expo run:android`, NOT a preview/production APK).
The Dev Tools section is only visible in DEV builds and will not appear in release APKs.

### Setup

1. Build and run the dev client: `npx expo run:android`
2. Complete onboarding (create profile, skip or set PIN)
3. Log at least 1 period start from the Dashboard

### Test Steps

1. Navigate to **Settings** → scroll to **Dev Tools** section
2. Tap **"Test notification (5s)"** → notification should appear in ~5 seconds
3. Tap **"Test notification (30s)"** → notification should appear in ~30 seconds
4. Tap **"Cancel all notifications"** → clears all scheduled notifications + tracked IDs

### Verification via ADB

```bash
# Check scheduled alarms (should show flowcycle entries after step 2/3)
adb shell dumpsys alarm | grep -A 3 "com.ckaburu.flowcycleapp"

# After cancel all (step 4), no flowcycle alarms should remain
adb shell dumpsys alarm | grep "com.ckaburu.flowcycleapp"

# Monitor notification events in real-time
adb logcat -s ReactNativeJS:V | grep -i notif
```

### Expected Behavior

| Action | Result |
|---|---|
| Tap 5s button | System notification appears in ~5 seconds with title "FlowCycle Test" |
| Tap 30s button | System notification appears in ~30 seconds with title "FlowCycle Test" |
| Tap Cancel all | All scheduled alarms for the app are cleared |
| Production build | Dev Tools section is not visible |
