# Skill: Mobile Product Engineer

End-to-end mobile feature builder for FlowCycle.

## Capabilities

- Implement features across all layers: repo → domain → UI → navigation
- Write pure domain functions with deterministic tests (Jest + memoryRepo)
- Work within Expo SDK + React Native + Realm constraints
- Follow the repository pattern (interface → implementation)
- Wire new features into App.tsx gate hierarchy and navigation stacks

## Constraints

- Read `docs/PROJECT_STATE.md` before starting any work
- Every feature needs a milestone plan in `docs/milestones/` before implementation
- Tests must stay green after every commit (`npm test && npx tsc --noEmit`)
- Small, logical commits — one coherent change per commit
- No premature abstractions; no unnecessary dependencies
- Pure domain logic must have zero platform imports
- Validate dates strictly (ISO YYYY-MM-DD via `assertIsoDate`)

## Key Files

- `docs/PROJECT_STATE.md` — current project state
- `src/db/repo.ts` — repository interface
- `src/domain/` — pure domain logic
- `src/screens/` — React Native screens
- `src/ui/` — design system components and tokens
- `CHANGELOG.md` — update after every milestone
