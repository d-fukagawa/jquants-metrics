Deploy this project to Cloudflare Pages on Windows (PowerShell-safe flow).

Use this exact process:
1. Run tests first:
   - `npm run test`
2. Build explicitly:
   - `npm run build`
3. Deploy with Wrangler via `npx` (do NOT use `npm run deploy`):
   - `npx wrangler pages deploy dist`

Important:
- On Windows PowerShell, `$npm_execpath` in `package.json` scripts often fails.
- Avoid `npm run deploy` unless the script is confirmed PowerShell-compatible.
- If `wrangler` is not on PATH, keep using `npx wrangler ...`.

Report:
- Commit hash and pushed branch (if push was requested).
- Deployment URL from Wrangler output.
- Any failure with exact command that failed and the fix/workaround used.
