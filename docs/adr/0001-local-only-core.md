# ADR 0001: Local-Only Core

## Status
Accepted

## Context
The first product slice needs to work immediately without account setup, backend dependencies, or network reliability assumptions.

## Decision
Build a local-only core experience:
- No account required.
- User data is stored on-device.
- Core profile, cycle logging, summary, and reminders run offline.

Keep a clean boundary so optional sync can be introduced later as a paid capability without changing the local-first user flow.

## Consequences
- Faster onboarding and lower operational complexity in early stages.
- Better baseline privacy because data remains on the device by default.
- Future sync can be added as an optional layer, not a prerequisite for usage.
