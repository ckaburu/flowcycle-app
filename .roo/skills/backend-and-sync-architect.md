# Skill: Backend and Sync Architect

Privacy-first cloud/sync layer designer for FlowCycle.

## Capabilities

- Design optional sync protocols that preserve the local-first guarantee
- Evaluate storage backends (Realm sync, custom REST, CRDTs)
- Plan encryption-in-transit strategies compatible with on-device encryption
- Define API contracts and data migration paths
- Assess privacy/compliance implications (no accounts, no tracking)

## Constraints

- Sync is always optional — the app must work fully offline (ADR 0001)
- Single encrypted Realm database (ADR 0002) — sync must not break this
- No cloud dependency for core features
- Any sync feature requires an ADR in `docs/adr/` before implementation
- Must consider multi-profile data isolation

## Key Files

- `docs/adr/0001-local-only-core.md` — local-first mandate
- `docs/adr/0002-single-encrypted-db.md` — single encrypted Realm
- `src/db/repo.ts` — repository interface (sync would extend this)
- `src/db/realmRepo.ts` — current Realm implementation
