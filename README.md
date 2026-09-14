# SkillSetu · Ayush Academia–Industry Career Bridge

SkillSetu bridges Ayush (Ayurveda, Yoga & Naturopathy, Unani, Siddha, Homoeopathy) students and early-career professionals with verified industry opportunities. It combines a **career passport** (AI-parsed resume, verified skill map, readiness score), an **in-house career matching engine**, **evidence-based skill verification**, and **instant gigs** for hands-on experience.

> ⚙️ **Architecture note:** The platform previously depended on an external mediator deployment for AI matching. That deployment proved unreliable (intermittent `FUNCTION_INVOCATION_FAILED`), so SkillSetu now runs its own **deterministic matching engine** (`src/lib/matching.ts` + `api/lib/matching.js`). No external mediator is required at runtime.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · TypeScript 5.9 · Vite 7 · Tailwind CSS v4 |
| Backend | Vercel-style serverless functions (`api/*.js`, ESM, default-export handler) |
| Database | Supabase (PostgreSQL) — anon key on client, service-role key **server-only** |
| Testing | Vitest 5 (40 tests across normalization · assessments · matching) |
| External data | TrustJob.in verified-jobs API (server-side proxy via `api/jobs-feed.js`) |

## Getting Started

```bash
npm install
npm run dev            # Vite dev server on :5173 with local API plugin
npm test               # vitest run — 40 tests
npm run build          # production build (type-check + vite build)
```

### Local Development (no Vercel needed)

`api-dev-plugin.js` is a Vite middleware that intercepts every `/api/*` request and dynamically imports the matching serverless handler. It loads env vars from `vercel.json` so Supabase secrets work locally. Edit a handler file, restart the dev server, new code is live.

Open `http://localhost:5173/api/courses` in your browser to smoke-test.

## Repository Map

```
api/                          Serverless handlers (Vercel-style, ESM)
  lib/matching.js             In-house matching engine (server mirror)
  lib/assessments.js          Assessment bank + scoring (server mirror)
  lib/normalization.js        Skill/city normalization (server mirror)
  career-match.js             GET career match (auth -> profile -> match -> respond)
  career-assessments.js       start/submit assessment (server scoring)
  jobs-feed.js                Verified jobs proxy + internal opportunities
  skill-gap.js                Platform skill-gap overview
  skills/verify.js            Evidence-based skill verification (POST)
  profile-prefs.js            Match preferences (GET/PUT)
  students.js                 Student CRUD (target_role, prefs fields)
  profiles.js                 Profile CRUD (exposes target_role)
  student-skills.js           Skill CRUD (incl. state for verification)

src/
  lib/matching.ts             Frontend matching engine (source of truth)
  lib/assessments.ts          6 assessment question-banks + scoring
  lib/normalization.ts        SKILL_ALIASES, LOCATION_ALIASES, normalizers
  lib/engine.ts               API client helpers + shared types
  context/CareerMatchContext  Match state; transparent client fallback
  components/CareerMatchSection  Categories, improve plan, gaps, fallback badge
  pages/                      Home, Profile, Opportunities, Company, College
                              Ministry, OpportunityMap, SkillGap, Login

api-dev-plugin.js             Vite middleware serving api/*.js locally
vercel.json                   Env vars (secrets) + route rewrites
```

## Career Match Flow

Student profile → `api/career-match` (auth) → fetch verified jobs → `matchJobs()` → `verifySkills()` → `computeSkillGaps()` → categorize (Strong / Good / Stretch) → improve plan.

**Transparent fallback:** If the server is unreachable, `CareerMatchContext` runs the same engine client-side from data already in `AppContext` and marks the result with `usedFallback` ("In-house engine · computed locally").

**Weighting:** skill match 40% · location 20% · role 15% · experience 15% · verification 10%.

## Skill Verification

`POST /api/skills/verify` accepts `evidence_type` + `evidence_text`/`evidence_url`. States: `verified`, `pending`, `suggested`. States feed into match confidence (capped at `VERIFY_CONFIDENCE_CEIL`) and appear on the Profile evidence table.

## Assessments

Six in-house assessments: Python Core · JavaScript Core · SQL Basics · React Basics · Data Analysis Basics · Ayush Clinical Basics.

`POST /api/career-assessments` with `action: "start"` returns questions; `action: "submit"` scores answers server-side and persists the outcome.

## Tests

```bash
npm test
```

| Suite | Tests | Covers |
|---|---|---|
| normalization.test.ts | 11 | Skill/city alias resolution, list normalization, text extraction |
| assessments.test.ts | 11 | Scoring, levels, pass thresholds, outcomes |
| matching.test.ts | 18 | Verification, weighted scoring, categories, gaps, improve plan, breakdown |

## Deployment

1. Push to GitHub → import in Vercel (framework: **Vite**).
2. Add env vars from `vercel.json` in project settings.
3. `vercel.json` rewrites `/api/*` to the handler files.
4. Deploy — all secrets stay server-side; browser talks only to `/api/*` on your own origin.

## License

Proprietary — © Ayush Academia–Industry Career Bridge.