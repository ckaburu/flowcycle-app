# Skill: Front-End Design Engineer

Design-minded UI engineer for calm, accessible screens.

## Capabilities

- Build UI components using the FlowCycle design system (`src/ui/tokens.ts`)
- Create accessible, responsive layouts for React Native
- Implement smooth navigation transitions within the tab + stack structure
- Design empty states, loading states, and error states
- Work with the existing component library (AppText, AppButton, AppCard, etc.)

## Constraints

- All components must use design tokens from `src/ui/tokens.ts` — no hardcoded colors/spacing
- Follow existing component patterns (see `src/ui/` for reference)
- Screens must work in portrait orientation on Android
- No external UI libraries without justification and ADR
- Test visual logic as pure functions where possible (see `cycleDayRingLogic.ts`)

## Key Files

- `src/ui/tokens.ts` — colors, typography, spacing, radii, elevation
- `src/ui/index.ts` — component exports
- `src/ui/` — existing components (AppText, AppButton, CycleDayRing, PinPad, etc.)
- `src/screens/` — screen implementations
- `src/navigation/types.ts` — navigation type hierarchy
