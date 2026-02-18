# ADR 0005: App Lock with PIN and Optional Biometric

## Status
Accepted

## Context
FlowCycle stores sensitive menstrual health data. Users need a way to prevent casual physical access to the app on a shared or lost device. The lock must work fully offline and not depend on any server.

## Decision
Gate the entire app behind a user-set **6-digit numeric PIN** with optional biometric unlock via `expo-local-authentication`.

### PIN storage
- Generate a 16-byte random salt via `expo-crypto`.
- SHA-256 hash the concatenation of salt + PIN.
- Store `{ salt, hash, failedAttempts, lockUntil }` as a single JSON value in `expo-secure-store` under key `pin_credentials_v1`.
- Plaintext PIN is never persisted or logged.

### Why SHA-256 (not PBKDF2/bcrypt/argon2)
- `expo-crypto` provides `digestStringAsync` with no additional native dependencies.
- A 6-digit PIN has only 1,000,000 combinations — no hash algorithm alone prevents brute force.
- Real protection comes from exponential backoff (persisted across restarts) and hardware-backed SecureStore.
- PBKDF2/bcrypt/argon2 would require a new native module with no meaningful security gain given the above.

### Exponential backoff
| Consecutive failures | Lockout |
|---------------------|---------|
| 1–3 | None |
| 4 | 5 seconds |
| 5 | 15 seconds |
| 6 | 60 seconds |
| 7+ | 5 minutes |

`failedAttempts` and `lockUntil` are stored in SecureStore (not memory) so lockout survives app restarts and kills.

### Biometric
- Only available after a PIN is already set.
- On failure or cancel, falls back to PIN entry — biometric preference is never auto-disabled.
- `disableDeviceFallback: true` — the app handles PIN fallback, not the OS.

### Lock triggers
- Cold launch: always locks if PIN is set.
- Background > 30 seconds: locks.
- Quick task switch < 30 seconds: does not lock.
- `lastBackgroundedAt` is held in memory only — if the app is killed, cold launch always triggers lock (correct behavior).

### Forgot PIN recovery
Not supported. If a user forgets their PIN, the only recovery path is clearing app data (reinstall). This is consistent with the privacy-first, offline-only approach — there is no server to reset against.

## Consequences
- Users gain protection against casual physical access.
- No new native dependencies beyond `expo-local-authentication` (biometric).
- PIN is global (not per-profile) — simpler UX and implementation.
- Clock manipulation could bypass `lockUntil`. Acceptable for the casual-access threat model. A monotonic clock guard can be added later if needed.
- SecureStore failure (rare devices/emulators) falls back to unlocked state with a console warning.
