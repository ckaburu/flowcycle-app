# FlowCycle — Context Snapshot

> For continuing this project in a new chat session.
> Generated: 2026-02-25

---

## 1. Current Version & Git State

| Field | Value |
|---|---|
| Version | 0.4.3 |
| Branch | `main` (clean working tree) |
| Latest commit | `c91b7c3` — `feat(ux): implement UX system — icons, accents, undo, date picker, captions` |
| Latest tag | `v0.4.3` (annotated, pushed to origin) |
| Remote | `origin` → GitHub (`ckaburu/flowcycle-app`) |
| Tests | 198 passed, 3 todo (Realm JSI manual), 15 suites |
| Types | `tsc --noEmit` clean |

---

## 2. Architecture

```
flowcycle-app/
├── App.tsx                  Bootstrap + gate hierarchy: loading → lock → onboarding → main
├── src/
│   ├── db/                  Repository pattern
│   │   ├── repo.ts          Interface: Repository, Profile, CycleStart, NotificationPreference
│   │   ├── realmRepo.ts     Active implementation (AES-256 encrypted Realm)
│   │   ├── memoryRepo.ts    Test implementation (in-memory, full contract compliance)
│   │   └── sqliteRepo.ts    Retained fallback (not active)
│   ├── domain/              Pure logic (no React, no I/O)
│   │   ├── cycleMath.ts     parseIsoDate, daysBetween, computeCycleLengths, typicalCycleLength,
│   │   │                    estimateNextStart, computeEntryMeta, computeCycleDay
│   │   ├── deferredDelete.ts  Timer-based undo pattern (pure JS, no React deps)
│   │   ├── notificationPlan.ts  Forecast reminders, deterministic IDs, set-diff plan
│   │   ├── reconcileNotifications.ts  Adapter-injected cancel/schedule with past-date filter
│   │   ├── syncNotifications.ts  Orchestrator: repo → domain → reconciliation → adapter
│   │   ├── quickLogCycleStart.ts  Idempotent today-log (created | already_exists)
│   │   ├── AppState.ts      Active profile ID persistence (AsyncStorage)
│   │   ├── LockState.ts     PIN hash+salt, lockout state machine (SecureStore)
│   │   ├── OnboardingState.ts  Completion flag (AsyncStorage)
│   │   └── errors.ts        DuplicateCycleStartError, FutureDateError
│   ├── screens/             11 screens
│   │   ├── DashboardScreen.tsx    CycleDayRing, ProfileAvatar, quick-log, info card
│   │   ├── ProfilesScreen.tsx     Profile list, accent borders, active dot, add profile
│   │   ├── CycleLogScreen.tsx     CRUD with date picker, deferred undo, cycle captions
│   │   ├── SettingsScreen.tsx     Notifications toggle, PIN management, dev tools
│   │   ├── LockScreen.tsx         PIN entry with lockout
│   │   ├── SetupPinScreen.tsx     PIN set/change/remove
│   │   └── Onboarding (4 screens)  Welcome, CreateFirstProfile, PinPrompt, OnboardingPinSetup
│   ├── navigation/
│   │   ├── TabNavigator.tsx   Bottom tabs (Dashboard | Profiles | Settings) + nested stacks
│   │   └── types.ts          TabParamList, DashboardStack, ProfilesStack, SettingsStack
│   ├── ui/                  Design system
│   │   ├── tokens.ts        colors, spacing, typography, radii, elevation
│   │   ├── avatarColor.ts   AVATAR_PALETTE (6 hues, WCAG 3:1 compliant), avatarColorIndex
│   │   ├── AppText, AppButton, AppInput, AppCard, ScreenContainer
│   │   ├── EmptyState, ErrorBanner, LoadingIndicator
│   │   ├── CycleDayRing.tsx   View-based circular progress (two-semicircle rotation)
│   │   ├── ProfileAvatar.tsx  Deterministic color circle with initial
│   │   ├── ListItem.tsx, SectionHeader.tsx  Settings list components
│   │   └── PinPad.tsx        PIN entry grid
│   ├── hooks/
│   │   ├── useAppLock.ts     Background timeout re-lock (30s)
│   │   └── useDashboardData.ts  Focus-aware data loader
│   └── utils/
│       ├── date.ts           isValidIsoDate, assertIsoDate, localDateToIso, isoToLocalDate
│       ├── notificationAdapter.ts  NotificationAdapter interface
│       └── expoNotificationAdapter.ts  Expo Notifications implementation
```

### Layer Rules

- **Domain** never imports React, Expo, or UI. All date math uses UTC via `Date.UTC`.
- **Screens** wire domain to UI. Side effects are fire-and-forget where appropriate.
- **Repository** is the only persistence boundary. 3 implementations share identical contract tests.
- **Notifications** use 3-layer architecture: domain (plan) → reconciliation (adapter-injected) → infrastructure (Expo).

---

## 3. Milestones

| # | Name | Version | Status |
|---|---|---|---|
| 1 | Notification Reliability | v0.4.0 + v0.4.1 | COMPLETE |
| 2 | Data Integrity & Cycle Editing | v0.4.2 | COMPLETE |
| 3 | UX Implementation | v0.4.3 | COMPLETE |
| **4** | **UX Refinement** | **v0.4.4** | **NEXT** |

Prior milestones (all COMPLETE): v0.1 spike-core, v0.2 encrypted storage, v0.3-1 design system, v0.3-2 app lock, v0.3-3 onboarding, v0.3-4 dashboard, v0.3-5 navigation.

---

## 4. Product Identity Constraints

**FlowCycle is a quiet instrument.** Observe, record, inform.

| Principle | Implication |
|---|---|
| Determinism > heuristics | No ML predictions, no "smart" suggestions. `typicalCycleLength` is median of last 3 intervals. |
| Auditability > black-box | Every displayed value traceable to stored dates. No hidden state. |
| Multi-profile is core | Parents tracking kids/partners/friends. NOT single-user assumption. Active profile visible on all mutation screens. |
| Local-only | No accounts, no sync, no cloud. All data on-device in encrypted Realm. |
| No "insights" yet | No trend analysis, no mood tracking, no symptom correlation. Future consideration only. |

**Anti-patterns to avoid:**
- Conversational UI ("Hi, {name}" — chatbot tone)
- Heuristic features (auto-detect patterns, suggest actions)
- Single-user assumptions (hiding profile context, defaulting to "my" data)
- Feature creep (adding capabilities outside current milestone scope)

---

## 5. Key Implemented Patterns

### DeferredDelete Lifecycle (`src/domain/deferredDelete.ts`)

Pure JS class managing undoable deletion with timer:

```
request(id) → starts 5s timer, flushes any prior pending
undo()       → cancels timer, restores entry (returns true/false)
flush()      → commits immediately (idempotent, safe from multiple cleanup paths)
```

Screen integration (CycleLogScreen):
- `deferredRef = useRef<DeferredDelete>` with lazy init
- `commitDeleteRef` pattern avoids stale closures in timer callback
- `useFocusEffect` cleanup → `flush()` on blur/unmount
- `AppState` listener → `flush()` on background
- `pendingDeleteId` state hides entry from UI during undo window
- Guard: `visibleEntries.length === 0 && pendingDeleteId === null` prevents false empty state

### Native Date Picker Flow (`CycleLogScreen.tsx`)

```
pickerTarget state: "add" | "edit" | null
  ↓
pickerValue memo: derives Date from current ISO input (localDateToIso/isoToLocalDate)
  ↓
DateTimePicker: mode="date", maximumDate={new Date()}
  ↓
handlePickerChange: captures target, clears picker, updates correct input
```

- `localDateToIso(date)` uses `getFullYear/getMonth/getDate` (local timezone)
- `isoToLocalDate(iso)` uses `new Date(y, m-1, d)` (local midnight)
- These are distinct from `formatIsoDate/parseIsoDate` in cycleMath which use UTC

### Cycle Metadata Computation (`src/domain/cycleMath.ts`)

```typescript
computeEntryMeta(entries: {id, startDateIso}[]): Map<id, {cycleNumber, intervalDays}>
```

- Sorts entries by date ascending
- Assigns 1-based cycle number (oldest = #1)
- Computes interval from previous entry (null for first)
- Used in CycleLogScreen via `useMemo(() => computeEntryMeta(cycleStarts), [cycleStarts])`

### Multi-Profile Context Propagation

| Screen | How profile context is shown |
|---|---|
| Dashboard | ProfileAvatar (40px) + greeting in header row |
| Profiles | Active dot (8px) + accent border on selected card |
| CycleLog | ProfileAvatar (24px) + name in subtitle row |
| Settings | Profile name in toggle label: "Period Reminders ({name})" |

Active profile ID persisted in AsyncStorage (`AppState.ts`). Every mutation screen shows which profile is being modified.

---

## 6. Testing State

**198 tests passing** across 15 suites. 3 `.todo` (Realm JSI unavailable in Jest).

| Suite | Tests | Coverage Area |
|---|---|---|
| `repo.test.ts` | ~50 | CRUD, uniqueness, future-date, delete, update (MemoryRepo contract) |
| `cycleMath.test.ts` | ~25 | Cycle day, lengths, median, typical length, predictions, entry meta |
| `deferredDelete.test.ts` | 14 | Timer expiry, undo, flush, double-commit guard, sequential deletes |
| `date.test.ts` | 13 | ISO validation, localDateToIso, isoToLocalDate, round-trips, leap day |
| `syncNotifications.test.ts` | ~15 | Orchestrator with mock adapter |
| `reconcileNotifications.test.ts` | ~15 | Set-diff, past-date filter, idempotency |
| `notificationPlan.test.ts` | ~15 | Forecast, ID generation, plan computation |
| `loadDashboardData.test.ts` | ~10 | Dashboard data derivation |
| `quickLogCycleStart.test.ts` | ~8 | Idempotent log, duplicate detection |
| `lockState.test.ts` | ~15 | PIN verify, lockout, backoff, state machine |
| `onboardingState.test.ts` | ~5 | Completion flag |
| `errors.test.ts` | ~5 | Domain error types |
| `cycleDayRingLogic.test.ts` | ~8 | Ring progress, overflow |
| `avatarColor.test.ts` | ~5 | Hash stability, palette bounds |
| `realmRepo.migration.test.ts` | 3 todo | Realm schema v1→v2 (manual only) |

No screen-level integration tests (no JSDOM/react-native-testing-library). All tests are unit tests for domain, repo, and utility layers.

---

## 7. Known Risks / Open Questions

| Issue | Detail |
|---|---|
| No delete-profile UI | `deleteProfile()` on repo interface, called only in tests. Needs `syncNotifications` wiring when UI added. |
| 3 manual Realm migration tests | JSI unavailable in Jest; `it.todo()` stubs only. |
| `expo-sqlite` still in plugins | Loaded but not active (`app.json` plugins array). |
| Doc bug in verification.md | Encryption checklist step 3 references `flowcycle_realm_key` but code uses `realm_encryption_key_v1`. |
| No screen tests | All testing is unit-level. No component rendering tests. |
| `formatIsoDate` uses UTC, `localDateToIso` uses local | Two date formatting paths exist — must not mix them. `cycleMath` = UTC, date picker = local. |

---

## 8. Milestone 4 — UX Refinement (v0.4.4)

**Theme**: Beauty + clarity + reduced friction. No new features. No algorithmic insights.

### Scope Boundaries

- NO Repository interface changes
- NO new domain logic or data models
- NO heuristic or "smart" features
- NO conversational UI tone
- Neutral, instrument-like language throughout
- Each step passes `tsc` + `npm test` before next

### Execution Plan (6 steps)

**Step 1 — Profiles Screen: Multi-Profile Mental Model**
Files: `ProfilesScreen.tsx`
- Add ProfileAvatar (32px) to each card
- Replace `ID: {id}` with cycle count (`"{N} cycles"` / `"No cycles yet"`) via `Promise.all(profiles.map(p => repo.listCycleStarts(p.id)))` — no repo interface change
- Move Add Profile CTA above card list
- Neutral subheading: `"Select a profile"`

**Step 2 — Dashboard: Calm & Premium**
Files: `DashboardScreen.tsx`, `CycleDayRing.tsx`
- Replace greeting with formatted date (`toLocaleDateString` with try/catch fallback)
- Ring: 180→200dp default, capped at `screenWidth - 2*spacing.xl` via `useWindowDimensions`
- Add "Day" label in ring center
- Info card: increased row padding
- Log button: `secondary` variant (primary only for empty-state CTA)
- Remove "View Cycle Log" ghost button

**Step 3 — Profile Card Visual Refinement**
Files: `ProfilesScreen.tsx`
- Active card: dot + 8% opacity tint (two signals only, no triple emphasis)
- Non-active: border only
- Add `android_ripple` to Pressable
- Pre-validated tints for all 6 palette hues

**Step 4 — CycleLog: Entry Polish**
Files: `CycleLogScreen.tsx`, `tokens.ts`
- 1px divider between header and list
- Date text: `body` → `subheading`
- Edit mode: neutral `surfaceMuted` tint (new token, warm gray `#F5F5F3`) — not info blue
- Undo bar: Feather `rotate-ccw` icon (16dp, `textMuted`) — no stripe

**Step 5 — Global Polish**
Files: `AppButton.tsx`, `EmptyState.tsx`, `ScreenContainer.tsx`
- `android_ripple` on all button variants
- EmptyState: optional Feather icon prop
- Consistent `paddingHorizontal: spacing.screenH` audit

**Step 6 — Release**
- Run tests + tsc
- Update CHANGELOG, PROJECT_STATE, verification.md
- Bump to 0.4.4, commit, tag, push

### Commit Plan

| Step | Message |
|---|---|
| 1 | `feat(profiles): avatar cards, cycle counts, repositioned CTA` |
| 2 | `refine(dashboard): date context, responsive ring, softer actions` |
| 3 | `refine(profiles): active card tint, ripple feedback` |
| 4 | `refine(cycle-log): entry emphasis, neutral edit tint, undo icon` |
| 5 | `refine(ui): ripple feedback, empty state icons, padding audit` |
| 6 | `chore(release): v0.4.4 tests, verification, tag` |

---

## Key Files to Read First

| File | Why |
|---|---|
| `docs/PROJECT_STATE.md` | Authoritative state, architecture, milestones, known issues |
| `src/ui/tokens.ts` | Design system: colors, spacing, typography, radii |
| `src/db/repo.ts` | Repository interface (all data types + methods) |
| `src/domain/cycleMath.ts` | Core computation (dates, cycles, predictions, entry meta) |
| `src/screens/CycleLogScreen.tsx` | Most complex screen (date picker, deferred undo, captions) |
| `src/screens/ProfilesScreen.tsx` | Multi-profile list (next to be refined) |
| `src/screens/DashboardScreen.tsx` | Main screen (next to be refined) |
| `docs/milestones/v0.4.3-ux-system-definition.md` | UX design spec (tokens, typography, patterns) |

## Tech Stack

| Component | Version |
|---|---|
| Expo SDK | 54.0.33 |
| React Native | 0.81.5 (New Architecture) |
| React | 19.1.0 |
| TypeScript | 5.9.2 (strict) |
| Realm | 20.2.0 (encrypted) |
| Jest | 29.7.0 + ts-jest |
| `@react-native-community/datetimepicker` | 8.4.4 |
| `@expo/vector-icons` | 15.0.3 (Feather set) |

## Dev Environment

```
macOS / Apple Silicon
JDK: Azul Zulu 17 | Android SDK: Platform 36 | Emulator: Pixel_API_36
Build: npx expo run:android | Test: npm test | Types: npx tsc --noEmit
Package: com.ckaburu.flowcycleapp
```
