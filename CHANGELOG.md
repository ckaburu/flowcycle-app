# Changelog

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
