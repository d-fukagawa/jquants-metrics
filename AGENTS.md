# jquants-metrics Agent Guide

Maintain the Japanese stock screening and analysis app built with Hono, Cloudflare Pages, Drizzle, Neon, JQuants API v2, and EDINET data.

## Working Context

- Inspect `git status` and the relevant implementation and tests before editing. Preserve unrelated working-tree changes.
- For changes under `src/routes/`, `src/services/`, `src/db/`, or `src/components/`, read that directory's `AGENTS.md`. Its scoped rules take precedence for those files. Do not preload unrelated guides.
- Code, configuration, migrations, workflows, and tests define current behavior. Read `doc/contracts/README.md` before changing a public surface.

## Must Preserve

- Stop and ask before a breaking public-surface change, including renaming or removing a DB field, API shape, CLI entry, secret, or cron schedule.
- Cloudflare runtime code must not use `process.env`, `fs`, or other Node-only APIs. Routes use `c.env.*`; Node scripts under `scripts/` may use `process.env`.
- Services accept `db` and explicit arguments and do not access the Hono context.
- Use JQuants API v2 with `x-api-key` authentication.
- Convert Drizzle `numeric` strings with `Number()` before arithmetic. Handle `null` and zero explicitly.
- Keep synchronized writes idempotent with `onConflictDoUpdate`. Store stock codes as five-character strings such as `"72030"`.
- Hono JSX uses `class` and `for`. Server-rendered components must not use browser-only APIs or React hooks.
- Start schema changes in `src/db/schema.ts`; generate migrations with `npm run db:generate` and do not hand-edit generated migrations.

## Validation

- Add meaningful tests for behavior changes; do not add tests that only repeat the implementation.
- Run focused checks while iterating. For a code or configuration change, finish with `bin/verify`, or `npm run verify` on Windows/PowerShell.
- For documentation-only changes, run `git diff --check` and validate changed references. Use the full gate when documentation changes commands, configuration, or executable examples.
- Do not repeat passing checks unless later changes can affect them.

## Documentation

- `doc/` contains committed, organized, durable project, feature, and implementation policy that is safe to publish.
- Keep plans, schedules, task tracking, drafts, unpublished material, and unorganized notes in ignored `tmp/`. Promote content to `doc/` only after it is organized, durable, and safe to publish.
- Keep credentials in designated secret stores or ignored secret files, never in documentation.
- Document purpose, rationale, and lasting policy. Link to source files instead of copying inventories or change-prone values. Keep `doc/contracts/` limited to compatibility boundaries not evident from the source of truth.
