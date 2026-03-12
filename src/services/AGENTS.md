# Services Guide

- Implement services as pure functions.
- Accept `Db` and explicit arguments; do not touch HTTP context.
- Convert Drizzle `numeric` values to numbers before calculation.
- Handle edge cases (`null`, zero-division, empty arrays).
- Keep upsert logic idempotent with `onConflictDoUpdate`.
- Add `*.test.ts` updates for each behavior change.
