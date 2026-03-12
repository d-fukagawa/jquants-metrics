# Components Guide

- Use server-side Hono JSX only.
- Use `class` and `for` attributes (not React attribute names).
- Do not use browser-only APIs (`window`, `document`) in component code.
- Do not introduce client-side hooks (`useState`, `useEffect`).
- Keep chart math deterministic and testable where practical.
