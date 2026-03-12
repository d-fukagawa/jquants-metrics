# jquants-metrics: Codex Working Guide

## Goal
- Build and maintain a Japanese stock screening/analysis app using Hono + Cloudflare Pages + Drizzle + Neon + JQuants API v2.

## First Read
- `CLAUDE.md`
- `doc/plan.md`
- `src/routes/CLAUDE.md`
- `src/services/CLAUDE.md`
- `src/db/CLAUDE.md`
- `src/components/CLAUDE.md`

## Non-Negotiable Constraints
- Cloudflare Workers runtime: do not use `process.env`, `fs`, or other Node-only APIs.
- Use `c.env.*` in routes; keep services as pure functions (`db` + arguments only).
- JQuants API must be v2 and authenticated with `x-api-key`.
- Drizzle `numeric` fields are strings: convert with `Number()` before arithmetic.
- Upsert must be idempotent with `onConflictDoUpdate`.
- Hono JSX uses `class`/`for` (not React `className`/`htmlFor`).

## Commands
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:studio`

## Workflow
- Prefer `rg`/`rg --files` for fast code search.
- Use parallel tool execution for independent reads/searches/tests whenever safe.
- Keep route handlers thin; move business logic to `src/services/`.
- Add or update tests for behavior changes.
- After code changes, run relevant tests before finishing.

## Directory Notes
- For route work: read `src/routes/AGENTS.md`.
- For service work: read `src/services/AGENTS.md`.
- For DB work: read `src/db/AGENTS.md`.
- For UI component work: read `src/components/AGENTS.md`.
