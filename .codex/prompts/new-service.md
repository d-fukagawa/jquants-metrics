Create a new service function for this repository.

Requirements:
- Implement as a pure function.
- Accept `Db` and explicit inputs only.
- Do not access `c.env` or request context.
- Convert `numeric` strings to numbers before calculations.
- Prefer clear query composition with Drizzle ORM.
- Add matching tests (`*.test.ts`) including edge cases.

References:
- `src/services/stockService.ts`
- `src/services/financialService.ts`
- `src/services/syncService.ts`
