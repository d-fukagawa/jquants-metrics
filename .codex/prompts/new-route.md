Create a new route handler that matches this repository style.

Requirements:
- Use `Hono<{ Bindings: Bindings }>()`.
- Keep business logic in `src/services/` (route is orchestration only).
- Read secrets/config from `c.env.*`.
- Register the route in `src/index.tsx`.
- Add/update tests in `src/routes/*.test.ts` or `*.test.tsx`.

References:
- `src/routes/home.tsx`
- `src/routes/stock.tsx`
- `src/routes/sync.ts`
