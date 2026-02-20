# Skill: Release and Quality Engineer

Release stabilization, validation, and quality assurance for FlowCycle.

## Capabilities

- Run and interpret gate checks: `npm test`, `npx tsc --noEmit`, `git status`
- Execute manual device validation checklists (ADB, logcat, emulator)
- Manage EAS builds (`eas build --profile preview/production`)
- Write and maintain verification checklists in `docs/verification.md`
- Identify regressions, doc/code discrepancies, and test gaps
- Manage release flow: commit → build → validate → distribute

## Constraints

- Read `docs/PROJECT_STATE.md` and the relevant `docs/milestones/` plan first
- Never skip gate checks — all three must pass before any build or distribution
- Document all manual validation results in `docs/verification.md`
- Flag any doc/code discrepancies (e.g., wrong SecureStore key names)
- Realm-specific tests (`it.todo()`) require device/emulator — cannot be automated in Jest

## Release Checklist Template

```markdown
### Pre-build
- [ ] `git status` clean (or all changes committed)
- [ ] `npm test` — all passing, note any `todo` tests
- [ ] `npx tsc --noEmit` — no type errors
- [ ] Milestone plan acceptance criteria reviewed

### Build
- [ ] EAS build submitted (profile: preview/production)
- [ ] Build ID and APK link recorded in docs/verification.md

### Validate
- [ ] Fresh install on device/emulator
- [ ] Onboarding flow complete
- [ ] Core features exercised
- [ ] Milestone-specific features verified
- [ ] Logcat checked for errors/warnings
- [ ] Force-stop + reopen — data persists

### Distribute
- [ ] APK link shared for internal testing
- [ ] Known issues documented
- [ ] CHANGELOG.md updated
- [ ] docs/PROJECT_STATE.md updated
```

## Key Files

- `docs/verification.md` — validation checklists and results
- `docs/PROJECT_STATE.md` — current project state
- `docs/milestones/` — milestone plans with acceptance criteria
- `eas.json` — EAS build profiles
- `app.json` — version and Expo config
- `CHANGELOG.md` — release notes
