# jquants-metrics: Codex Working Guide

## Goal
- Build and maintain a Japanese stock screening/analysis app using Hono + Cloudflare Pages + Drizzle + Neon + JQuants API v2, supplemented by EDINET data.

## First Read
- `CLAUDE.md`
- `doc/contracts/README.md` — public surface contracts (do not break)
- `src/routes/CLAUDE.md`
- `src/services/CLAUDE.md`
- `src/db/CLAUDE.md`
- `src/components/CLAUDE.md`

## Non-Negotiable Constraints
- Cloudflare Workers runtime: do not use `process.env`, `fs`, or other Node-only APIs (scripts/ runs on Node and may use `process.env`).
- Use `c.env.*` in routes; keep services as pure functions (`db` + arguments only).
- JQuants API must be v2 and authenticated with `x-api-key`.
- Drizzle `numeric` fields are strings: convert with `Number()` before arithmetic.
- Upsert must be idempotent with `onConflictDoUpdate`.
- Hono JSX uses `class`/`for` (not React `className`/`htmlFor`).
- Do not break public surface defined in `doc/contracts/`. Breaking changes (DB rename, API shape change, CLI rename, secret rename, cron time change) must stop and ask the user.

## Commands
- `bin/verify` — single quality gate (lint + typecheck + test + build). Run before finishing.
- `bin/lint`, `bin/test`, `bin/setup` — granular entrypoints.
- Windows / PowerShell without `/bin/bash`: use `npm run verify` as the exact `bin/verify` replacement.
  - `bin/lint` → `npm run lint` then `npm run typecheck`
  - `bin/test` → `npm test`
  - `bin/setup` → `npm ci`
- `npm run dev` — local dev server.
- `npm run build` — production build.
- `npm run preview` — wrangler pages dev (production-like).
- `npm run db:generate` / `db:migrate` / `db:studio` — Drizzle.

## Workflow
- Prefer `rg`/`rg --files` for fast code search.
- Use parallel tool execution for independent reads/searches/tests whenever safe.
- Keep route handlers thin; move business logic to `src/services/`.
- Add or update tests for behavior changes.
- After code changes, run relevant tests before finishing.

## Documentation
- `doc/` is committed documentation for lasting project and application decisions, including functional policy and implementation policy. Content must be organized and safe to publish.
- Do not put plans, schedules, task tracking, unreviewed notes, or content unsuitable for publication in `doc/`.
- `tmp/` is the uncommitted workspace for plans, schedules, unpublished material, and anything not yet organized. It stays outside Git.
- Move material from `tmp/` to `doc/` only after it is organized, expected to remain useful, and safe to publish.
- Store actual credentials only in the designated secret stores and ignored secret files, not in either documentation directory.
- Document purpose, rationale, and lasting policies; avoid duplicating lists or concrete values available in code and configuration.
- Treat code, configuration, migrations, workflows, and tests as the source of truth for concrete interfaces and defaults.
- Keep `doc/contracts/` limited to compatibility boundaries that are not obvious from those sources.

## Directory Notes
- For route work: read `src/routes/AGENTS.md`.
- For service work: read `src/services/AGENTS.md`.
- For DB work: read `src/db/AGENTS.md`.
- For UI component work: read `src/components/AGENTS.md`.
