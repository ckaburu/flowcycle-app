# Flowcycle App

## Run Locally
```bash
npm install
npm test
npx expo start
```

## Notifications Note
Local notification support from `expo-notifications` is limited in Expo Go.  
Use a development build to validate notification behavior (including scheduled reminders).

## Design System

All screens use a shared set of design tokens and UI components from `src/ui/`.

### Tokens (`src/ui/tokens.ts`)

| Token | Example values |
|-------|---------------|
| **Colors** | primary `#D4738C` (Dusty Rose), secondary `#8FB5A3` (Sage Green), background `#FAFAF8` (Warm White) |
| **Spacing** | 4 px grid — `xs` 4, `sm` 8, `md` 16, `lg` 24, `xl` 32, `xxl` 48 |
| **Typography** | heading 24/700, subheading 18/600, body 16/400, caption 13/400, label 14/500, number 32/700 |
| **Radii** | `sm` 4, `md` 8, `lg` 16 |

### Components

| Component | Purpose |
|-----------|---------|
| `ScreenContainer` | SafeAreaView + scroll + background + padding |
| `AppText` | Typography roles via `variant` prop |
| `AppButton` | primary / secondary / ghost / danger, disabled & loading states |
| `AppInput` | TextInput with label & error text |
| `AppCard` | Surface-colored rounded container |
| `ErrorBanner` | Red-tinted dismissible error message |
| `EmptyState` | Centered message + optional hint |
| `LoadingIndicator` | ActivityIndicator with full-screen / inline modes |

Import everything from the barrel: `import { AppText, colors, spacing } from "../ui";`

## Milestone Tags
Create an annotated tag for a milestone:

```bash
git tag -a v0.1-spike-core -m "v0.1-spike-core"
git push origin v0.1-spike-core
```
