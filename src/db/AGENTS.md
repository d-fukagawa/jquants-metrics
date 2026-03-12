# DB Guide

- Keep schema in `src/db/schema.ts`.
- Generate migrations with `npm run db:generate`; do not hand-edit `drizzle/`.
- Apply with `npm run db:migrate`.
- Use `createDb(c.env.DATABASE_URL)` in runtime paths.
- Keep stock code as 5-digit string (example: `"72030"`).
- Use `timestamp(..., { withTimezone: true })` for date-time fields.
