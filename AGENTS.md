# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

SkillSetu — Ayush Academia–Industry Career Bridge. React 19 + TypeScript + Vite frontend, Vercel-style serverless API in `api/*.js`, Supabase backend.

## Critical facts (do not break)

1. **No external mediator dependency.** The old mediator is legacy. The career-match flow is 100% in-house: `api/career-match.js` → `api/lib/matching.js`. Do not "restore" mediator calls.
2. **Dual engine invariant.** `src/lib/matching.ts` is the source of truth. `api/lib/matching.js` (and `assessments.js`, `normalization.js`) are hand-mirrored ESM copies. When changing the TS engine, **mirror the change in the JS files** and run `node --check` on them.
3. **Secrets stay server-side.** Only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` reach the browser. Service-role key lives in `vercel.json` + server env only. Never add `VITE_`/`NEXT_PUBLIC_` prefixes to server secrets.
4. **Serverless handlers shape:** `api/*.js` are ESM with `export default async function handler(req, res)`. The dev plugin (`api-dev-plugin.js`) imports them with `pathToFileURL` on Windows — keep the default-export contract, don't add local middleware deps.
5. **Auth:** Protected endpoints read `req.headers.authorization` (Supabase JWT) and verify via `api/auth-helpers.js`. 401 = happy path for anonymous requests; tests should expect it.

## Common tasks

- **Add a test:** Vitest config is `vitest.config.ts`, include pattern `src/**/*.test.ts`. Run `npm test`.
- **Change match logic:** Edit `src/lib/matching.ts` → update its tests → mirror to `api/lib/matching.js` → `node --check api/lib/matching.js` → restart dev server (plugin caches).
- **Local API debugging:** hitting `http://localhost:5173/api/<name>` directly in a browser tab is the fastest smoke test. `401 Sign in required`/`{"error":"Sign in required."}` means the route works.
- **PostgREST joins:** `opportunities.companies(name)` style joins can fail (PGRST200) — the resilient pattern is try join → catch → individual `company_id` lookups (`api/jobs-feed.js`).

## Gotchas

- Windows + dynamic import of `api/*.js` requires `pathToFileURL()` — do not "simplify" this.
- `api-dev-plugin.js` cache-invalidates on file mtime; dev server must be restarted after adding a **new** handler file.
- Build is type-checked (`npm run build`); fix TS errors before editing the JS mirrors blindly.