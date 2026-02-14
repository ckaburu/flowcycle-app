# ADR 0002: Single Encrypted Database

## Status
Accepted

## Context
The app supports multiple profiles on one device and needs straightforward data access patterns for local queries and reminders.

## Decision
Use one encrypted local database file for all app data.

Partition records by `profile_id` at the table level, including cycle history and related profile data.

## Why Not Per-Profile Database Files
- Per-profile files increase file lifecycle complexity (create, rotate, backup, delete, migrate).
- Cross-profile operations become harder and require opening multiple files.
- More file handles and schema management paths increase failure surface.
- A single database provides simpler migrations, indexing, and consistency controls.

## Consequences
- Query logic must always scope by `profile_id`.
- Encryption is applied once at the database layer instead of per-file orchestration.
- Local storage remains manageable as the number of profiles grows.
