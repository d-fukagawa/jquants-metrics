Investigate and fix the reported bug in this project.

Process:
1. Reproduce and isolate the failing behavior.
2. Trace from `src/routes` -> `src/services` -> `src/db`/`src/jquants`.
3. Apply a root-cause fix (no symptom-only patch).
4. Add or update tests that would fail before the fix.
5. Run relevant tests and report results.

Project constraints:
- Cloudflare Workers runtime (`c.env`, no Node-only APIs).
- JQuants API v2 + `x-api-key`.
- Drizzle `numeric` conversion before arithmetic.
