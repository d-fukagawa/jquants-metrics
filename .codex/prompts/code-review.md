Review the requested changes in this repository with these priorities:

1. Bugs and behavior regressions first.
2. Runtime compatibility with Cloudflare Workers.
3. Architecture boundaries (routes vs services).
4. Missing or weak tests.

Mandatory checks:
- No `process.env` in runtime code; use `c.env`.
- No Node-only APIs (`fs`, `path`) in Worker code.
- JQuants uses `/v2/` with `x-api-key`.
- Drizzle upsert uses `onConflictDoUpdate`.
- Drizzle `numeric` values are converted with `Number()` before math.
- Hono JSX uses `class`/`for`, not React attribute names.

Output format:
- Findings first, ordered by severity.
- Include concrete file/line references.
- Mention residual risk or testing gaps if no major issue is found.
