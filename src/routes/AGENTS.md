# Routes Guide

- Use `Hono<{ Bindings: Bindings }>()`.
- Read env from `c.env.*`, never `process.env`.
- Keep handlers focused on HTTP concerns only.
- Move data/query/calculation logic to `src/services/`.
- Return `c.notFound()` for missing resources.
- Keep sync/auth endpoints protected (`X-Sync-Secret` vs `c.env.SYNC_SECRET`).
