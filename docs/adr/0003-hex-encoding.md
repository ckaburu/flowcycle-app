# ADR 0003: Hex Encoding for Encryption Key Storage

## Status
Accepted

## Context
Realm requires a 64-byte `ArrayBuffer` encryption key. The key is generated once via `expo-crypto` (`getRandomBytes(64)`) and persisted in `expo-secure-store` so it survives app restarts.

`expo-secure-store` stores strings (UTF-8). We need a lossless encoding from raw bytes to a UTF-8-safe string and back.

## Options Considered

### 1. Base64 (rejected)
- Compact (86 characters for 64 bytes).
- React Native's `btoa`/`atob` operate on "binary strings" — each character maps to one byte. However, `expo-secure-store` stores UTF-8 strings, and some `btoa` polyfills in Hermes have inconsistent behaviour with values > 127.
- Risk of silent data corruption if a polyfill or future Hermes update changes encoding assumptions.

### 2. Hex encoding (accepted)
- Simple: each byte becomes two hex characters (`00`–`ff`).
- Output is 128 characters for 64 bytes — slightly larger than base64, well within SecureStore's 2 KB limit.
- No dependency on `btoa`/`atob` or any polyfill.
- Pure JavaScript implementation: trivial to write, review, and test.
- Every character is ASCII `[0-9a-f]` — guaranteed UTF-8 safe.

## Decision
Use hex encoding (`bytesToHex` / `hexToBytes`) for the round-trip between `Uint8Array` and the string stored in `expo-secure-store`.

## Implementation
See `src/db/realmRepo.ts`:
- `bytesToHex(bytes: Uint8Array): string` — maps each byte to a zero-padded 2-char hex string.
- `hexToBytes(hex: string): Uint8Array` — parses pairs of hex characters back to bytes, with length validation.

## Consequences
- Slightly larger stored string (128 chars vs 86 for base64) — negligible given SecureStore's 2 KB limit.
- Zero dependency on polyfills or platform-specific encoding APIs.
- Deterministic and easy to verify manually (e.g., `adb shell` → read SecureStore → confirm 128 hex chars).
