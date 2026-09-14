export interface Student {
  id: number; name: string; email: string; college: string; degree: string;
  year: string; location: string; headline: string; avatar_color: string;
  readiness_score: number; xp: number; streak_days: number; level_text: string;
  resume_text: string; portfolio_url: string;
}

export interface StudentSkill {
  id: number; student_id: number; skill_name: string; category: string;
  level: number; proficiency_pct: number; verified: boolean; source: string;
}

export interface Opportunity {
  id: number | string; title: string; company_id: number; type: string; domain: string;
  location: string; remote: boolean; stipend: string; stipend_num: number;
  duration: string; urgency: string; starts_in: string;
  skills_required: string[]; description: string; openings: number;
  applicants_count: number; status: string; posted_at: string; deadline: string; color: string;
  /** Present when the row comes from the verified external-jobs feed. */
  external?: { source: string; source_url: string; verified: boolean; expires_text?: string };
}

export interface Company { id: number; name: string; sector: string; location: string; size_text: string; rating: number; color: string; about: string; verified: boolean; }
export interface Career {
  id: number; title: string; domain: string; description: string;
  required_skills: { skill: string; level: number; weight: number }[];
  avg_stipend: string; demand_index: number; growth: string; color: string;
}
export interface Course { id: number; title: string; provider: string; duration: string; level_text: string; rating: number; learners: number; skills_covered: string[]; url: string; free: boolean; }
export interface SkillDemand { id: number; skill_name: string; category: string; demand_score: number; growth_pct: number; avg_stipend_boost: string; openings: number; }
export interface Placement { id: number; student_name: string; college: string; company_name: string; role_title: string; package_text: string; year: number; via: string; }
export interface Application { id: number; student_id: number; opportunity_id: number; status: string; match_score: number; cover_note: string; applied_at: string; }
export interface Certificate {
  id: number; cert_code: string; student_id: number; student_name: string;
  opportunity_id: number; opportunity_title: string; company_name: string;
  rating: number; feedback: string; skills_validated: string[]; issued_at: string;
}
export interface TaskWorkspace {
  id: number; application_id: number | null; student_id: number; opportunity_id: number;
  stage: string; file_name: string; notes: string; rating: number | null; feedback: string; updated_at: string;
}

export const OPP_TYPES = [
  { key: 'internship', label: 'Internship', desc: '4–24 week guided programs', icon: 'briefcase', color: '#0d7a5f' },
  { key: 'micro-internship', label: 'Micro-Internship', desc: '1–4 week sprint projects', icon: 'zap', color: '#2563eb' },
  { key: 'same-day-task', label: 'Same-Day Task', desc: 'Start today, ship today', icon: 'bolt', color: '#e8930c' },
  { key: 'part-time', label: 'Part-Time Job', desc: 'Flexible paid roles', icon: 'clock', color: '#7c3aed' },
  { key: 'full-time', label: 'Full-Time Job', desc: 'Placements & offers', icon: 'award', color: '#0e7490' },
  { key: 'challenge', label: 'Industry Challenge', desc: 'Compete & get noticed', icon: 'trophy', color: '#dc2626' },
] as const;

export const oppTypeMeta = (t: string) =>
  OPP_TYPES.find((x) => x.key === t) ?? { key: t, label: t, desc: '', icon: 'briefcase', color: '#0d7a5f' };

export const AVATAR_COLORS = ['#0d7a5f', '#2563eb', '#7c3aed', '#e8930c', '#dc2626', '#0e7490'];

const norm = (s: string) => s.trim().toLowerCase();

export function levelOf(pct: number) {
  return Math.max(1, Math.min(5, Math.round((pct || 0) / 20) || 1));
}

export interface MatchResult {
  score: number;
  matched: string[];
  missing: { skill: string; required: number; current: number }[];
  explanation: string[];
  prep: string[];
  weeksToEligible: number;
}

/** Match a student's skills against an opportunity's required skills. */
export function matchForOpportunity(skills: StudentSkill[], opp: Opportunity): MatchResult {
  const byName: Record<string, StudentSkill> = {};
  skills.forEach((s) => { byName[norm(s.skill_name)] = s; });
  const req = opp.skills_required || [];
  if (!req.length) {
    return { score: 72, matched: [], missing: [], explanation: ['Open to all skill levels — great first real-world exposure.'], prep: ['Read the task brief carefully', 'Submit before the deadline'], weeksToEligible: 0 };
  }
  let got = 0;
  const matched: string[] = [];
  const missing: { skill: string; required: number; current: number }[] = [];
  req.forEach((r, i) => {
    const mine = byName[norm(r)];
    const need = 2 + (i % 2); // required level heuristic 2–3
    if (mine) {
      const lv = levelOf(mine.proficiency_pct);
      if (lv >= need - 1) { got += 1; matched.push(r); }
      else { got += 0.45; missing.push({ skill: r, required: need, current: lv }); }
    } else {
      missing.push({ skill: r, required: need, current: 0 });
    }
  });
  const coverage = got / req.length;
  let score = Math.round(28 + coverage * 68 + (opp.urgency === 'instant' ? 2 : 0));
  score = Math.max(12, Math.min(98, score));
  const explanation: string[] = [];
  if (matched.length) explanation.push(`You already hold ${matched.length} of ${req.length} required skills (${matched.slice(0, 3).join(', ')}${matched.length > 3 ? '…' : ''}).`);
  if (!matched.length) explanation.push('New skill territory — this task will stretch you in exactly the right direction.');
  if (missing.length) explanation.push(`Missing or weak: ${missing.slice(0, 3).map((m) => m.skill).join(', ')}.`);
  if (skills.some((s) => s.verified)) explanation.push('Your verified skills boost employer trust for this role.');
  if (opp.urgency === 'instant') explanation.push('Instant start — the employer is hiring today, so fast applicants get priority review.');
  const prep = missing.slice(0, 3).map((m) =>
    m.current === 0 ? `Crash-course ${m.skill} (basics + one mini build)` : `Level up ${m.skill} from L${m.current} → L${m.required} with a guided project`
  );
  if (!prep.length) prep.push('Polish your portfolio link', 'Review the company brief once more');
  const weeksToEligible = missing.reduce((s, m) => s + Math.max(0, m.required - m.current), 0) > 0
    ? Math.max(1, Math.ceil(missing.reduce((s, m) => s + Math.max(0, m.required - m.current) * 8, 0) / 6))
    : 0;
  return { score, matched, missing, explanation, prep, weeksToEligible };
}

export function readinessTier(score: number) {
  if (score >= 85) return { label: 'Industry Ready', color: '#0d7a5f' };
  if (score >= 65) return { label: 'Almost There', color: '#2563eb' };
  if (score >= 45) return { label: 'Building Up', color: '#e8930c' };
  return { label: 'Getting Started', color: '#dc2626' };
}

export function matchColor(s: number) {
  if (s >= 80) return '#0d7a5f';
  if (s >= 60) return '#2563eb';
  if (s >= 40) return '#e8930c';
  return '#dc2626';
}

/** Simulated AI resume parse: extract known skills from free text. */
const SKILL_LEXICON: Record<string, string[]> = {
  'Python': ['python', 'pandas', 'numpy', 'django', 'flask'],
  'Java': [' java', 'spring', 'oops'],
  'React': ['react'],
  'SQL': ['sql', 'mysql', 'postgres', 'database query', 'queries'],
  'Machine Learning': ['machine learning', ' ml ', 'scikit', 'tensorflow', 'pytorch', 'model training'],
  'Data Analysis': ['excel', 'data analysis', 'pandas', 'sql', 'dashboard', 'data cleaning', 'power bi'],
  'API Development': ['api', 'rest', 'endpoint', 'postman'],
  'Software Testing': ['testing', 'test cases', 'qa', 'selenium', 'bug report'],
  'Cloud Computing': ['aws', 'azure', 'cloud', 'docker', 'deploy'],
  'Cybersecurity': ['security', 'cyber', 'penetration', 'vulnerability'],
  'Yoga Therapy': ['yoga', 'asana', 'pranayama'],
  'Ayurvedic Diagnosis': ['nadi', 'pariksha', 'diagnos', 'roga'],
  'Panchakarma': ['panchakarma', 'basti', 'vamana', 'virechana', 'nasya', 'abhyanga'],
  'Herbal Pharmacology': ['herb', 'dravyaguna', 'pharmac', 'formulation', ' churn'],
  'Clinical Documentation': ['documentation', 'case sheet', 'case study', 'discharge'],
  'Patient Counselling': ['counselling', 'counseling', 'patient communication'],
  'Frontend Development': ['html', 'css', 'javascript', 'frontend', 'landing page'],
  'Digital Marketing': ['seo', 'marketing', 'instagram', 'content'],
  'UI Design': ['figma', 'ui', 'wireframe', 'prototype'],
  'Public Speaking': ['public speaking', 'presentation', 'anchoring'],
  'Research Writing': ['research', 'paper', 'publication', 'literature review'],
  'Telemedicine': ['telemedicine', 'teleconsult'],
  'Nutrition & Dietetics': ['nutrition', 'diet', 'ahara'],
};

export function extractSkillsFromText(text: string): { skill: string; level: number }[] {
  const t = ` ${text.toLowerCase()} `;
  const out: { skill: string; level: number }[] = [];
  for (const [skill, keys] of Object.entries(SKILL_LEXICON)) {
    let hits = 0;
    for (const k of keys) if (t.includes(k)) hits++;
    if (hits > 0) out.push({ skill, level: Math.min(4, 1 + hits) });
  }
  return out;
}

// Live API servers.
//   zd7pyl  → primary mediator/career-match deployment
//   x2zaxn  → secondary mediator deployment (fallback)
//   JOBS_API_BASE → the External Verified Jobs Service (TrustJob.in v1.2.0).
//     It is the ONLY origin that actually exposes /api/v1/jobs (verified:
//     HTTP 200, CORS Access-Control-Allow-Origin: *). The mediator origins
//     (zd7pyl / x2zaxn) return 404 NOT_FOUND for /api/jobs-feed and
//     /api/v1/jobs — they exposed only career-match routes.
export const LIVE_API_PRIMARY = 'https://skill-setu-mediator-e5l5.arcada.app';
export const LIVE_API_FALLBACK = 'https://skill-setu-mediator-e5l5.arcada.app';
export const JOBS_API_BASE = 'https://3jmczl-r104kkoiy-arcadawebapps8.vercel.app/api/v1/jobs';

export async function smartFetch(path: string, options?: RequestInit): Promise<Response> {
  const isRelative = path.startsWith('/');
  const targets: string[] = [];

  if (isRelative) {
    // Always route through the local origin — the Vite dev/preview proxy forwards
    // /api/* server-side to the live target, which avoids any browser CORS restriction.
    // We never make direct cross-origin fetch() calls from the browser because external
    // servers may not have CORS headers, causing ERR_FAILED / blocked errors.
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (origin) targets.push(`${origin}${path}`);

    // Exception: for jobs-feed only, fall back to the dedicated external jobs API.
    // The TrustJob.in endpoints (3jmczl-...) serve the verified jobs catalog and have
    // CORS enabled, so we can query them straight from the browser when the local proxy
    // is unreachable (e.g. frontend served standalone on a port with no /api backend).
    // The user-specified live origins (zd7pyl → x2zaxn) are also probed for the route,
    // but today they are the mediator deployments (career-match only) → 404, so they
    // fall through without breaking the feed.
    if (path.includes('jobs-feed')) {
      const q = path.includes('?') ? path.slice(path.indexOf('?')) : '';
      targets.push(`${JOBS_API_BASE}${q}`);
      targets.push(`${LIVE_API_PRIMARY}/api/v1/jobs${q}`);
      targets.push(`${LIVE_API_FALLBACK}/api/v1/jobs${q}`);
    }

    /* Career-match cannot be called directly from the browser — it is a SkillSetu-
   internal endpoint that calls the mediator's /api/match server-to-server.
   When the full SkillSetu API is not co-deployed (e.g. standalone preview),
   it gracefully falls back to "Recommendations temporarily unavailable". */
    // All other /api/* routes (students, skills, companies, etc.) only go through
    // the local proxy. If they fail, AppContext falls back to demo data gracefully.
  } else {
    targets.push(path);
  }

  let lastErr: unknown = null;
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    try {
      const res = await fetch(target, options);
      if (res.ok) return res;
      // On 404 (not deployed) or server error (upstream broken), try the next
      // candidate unless it's the last one. This is what lets the jobs feed
      // fall over to the live external API when the local proxy is missing.
      if (i < targets.length - 1 && (res.status === 404 || res.status >= 500)) {
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      // A thrown error (e.g. net::ERR_CONNECTION_REFUSED when the frontend is
      // served standalone with no /api backend on this origin) must ALSO fail
      // over to the next candidate — otherwise the jobs feed dies silently.
      if (i < targets.length - 1) continue;
    }
  }
  throw lastErr || new Error(`Network request failed for ${path}`);
}

export async function apiGet<T>(path: string, token?: string | null): Promise<T> {
  const r = await smartFetch(path, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

export async function apiSend<T>(path: string, method: string, body: unknown, token?: string | null): Promise<T> {
  const r = await smartFetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
  return data;
}

/* ------------------------------------------------------------------ */
/* Career-match mediator types + helpers                               */
/* The browser only ever talks to Skill Setu's own /api/career-match   */
/* boundary — never to the mediator, and never with any mediator       */
/* secret. All values below mirror what the Skill Setu server          */
/* validated & normalized before sending them down.                    */
/* ------------------------------------------------------------------ */

export type SkillVerificationState = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NEEDS_EVIDENCE' | 'UNVERIFIED';

export interface MediatorSkillVerification {
  skill: string;
  state: SkillVerificationState;
  confidence: number | null;
  explanation: string;
  evidence_summary: string;
}

export interface MediatorRecommendation {
  job_id: string | null;
  title: string;
  company: string;
  location: string;
  match_score: number;
  verified: boolean;
  matched_skills: string[];
  verified_skills: string[];
  partially_verified_skills: string[];
  missing_skills: string[];
  why_matches: string;
  blockers: string[];
  actions: string[];
  application_url: string;
  source: string;
  /** 1-based ordering of the recommendation within the result. */
  rank?: number;
}

export interface MediatorSkillGap {
  skill: string;
  priority: number;
  reason: string;
  jobs_requiring: string[];
}

export interface MediatorProfileSummary {
  name: string;
  target_role: string;
  top_skills?: { skill: string; level: number; verified: boolean }[];
  readiness?: number;
  verified_count?: number;
}

export interface MediatorMatchResponse {
  ok?: boolean;
  user_id: string;
  profile_summary: MediatorProfileSummary | null;
  skill_verification: MediatorSkillVerification[];
  recommendations: MediatorRecommendation[];
  skill_gaps: MediatorSkillGap[];
  jobs_source_status: { ok: boolean; message: string; source: string };
  metadata: { generated_at: string; engine?: string; jobs_reviewed?: number; jobs_source?: string };
  cached?: boolean;
  fetched_at?: string;
}

export interface MediatorMatchError {
  ok: false;
  error: string;
  reason?: string;
  detail?: string;
  status?: number;
  jobs_source_status?: { ok: false; message: string };
}

export type MediatorMatchResult = MediatorMatchResponse | MediatorMatchError;

const VERIFY_STATE_META: Record<SkillVerificationState, { label: string; color: string; bg: string }> = {
  VERIFIED: { label: 'Verified', color: '#0d7a5f', bg: '#effaf4' },
  PARTIALLY_VERIFIED: { label: 'Partially verified', color: '#e8930c', bg: '#fff6e6' },
  NEEDS_EVIDENCE: { label: 'Needs evidence', color: '#2563eb', bg: '#eef3ff' },
  UNVERIFIED: { label: 'Unverified', color: '#8a978f', bg: '#f3f1ea' },
};

export const skillVerificationMeta = (state: SkillVerificationState) =>
  VERIFY_STATE_META[state] ?? VERIFY_STATE_META.NEEDS_EVIDENCE;

/** Public assessment (no answer keys) as served by our in-house endpoint. */
export interface AssessmentQuestionClient {
  id: string;
  text: string;
  kind: 'mcq' | 'range';
  options?: string[];
  hint?: string;
}

export interface MediatorAssessmentStart {
  assessment_id: string;
  title: string;
  description: string;
  skill?: string;
  skill2?: string | null;
  duration_min?: number;
  pass_score?: number;
  questions: AssessmentQuestionClient[];
  expires_at?: string;
}

export interface MediatorAssessmentSubmitResult {
  ok?: boolean;
  assessment_id?: string;
  assessment_title?: string;
  score?: number;
  level?: number;
  passed?: boolean;
  skills_verified?: string[];
  result?: string;
  summary?: string;
  result_id?: string | null;
  student_id?: number | null;
  verification?: MediatorSkillVerification[];
}

/** Profile preferences (profile_prefs) consumed by the matching engine. */
export interface ProfilePrefs {
  student_id: number;
  preferred_roles: string[];
  preferred_locations: string[];
  preferred_work_modes: string[];
  max_experience_years: number;
  updated_at?: string;
}

export interface SkillVerificationRequest {
  id: number;
  student_id: number;
  skill_name: string;
  evidence_type: string;
  evidence_text: string | null;
  evidence_url: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requested_at: string;
  reviewed_at?: string | null;
  review_note?: string | null;
}

/** Fetch the user's career-match result through Skill Setu's API boundary. */
export async function fetchCareerMatch(token: string | null, refresh = false): Promise<MediatorMatchResult> {
  try {
    const r = await smartFetch(`/api/career-match?refresh=${refresh ? 1 : 0}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return {
        ok: false,
        error: data?.error || 'Recommendations are temporarily unavailable',
        reason: data?.reason,
        detail: data?.detail,
        status: r.status,
        jobs_source_status: data?.jobs_source_status ?? { ok: false, message: String(data?.error || 'Service unavailable') },
      };
    }
    return data as MediatorMatchResponse;
  } catch (err: any) {
    return {
      ok: false,
      error: 'Recommendations are temporarily unavailable',
      reason: 'network_error',
      detail: err?.message || 'Failed to connect to matching service.',
      jobs_source_status: { ok: false, message: 'Matching service unreachable.' },
    };
  }
}

/** Fetch the assessment catalog or start a specific one (in-house, no secret). */
export async function startAssessment(token: string | null, assessmentId?: string): Promise<MediatorAssessmentStart | { assessments: MediatorAssessmentStart[] }> {
  const body = assessmentId ? { assessment_id: assessmentId } : {};
  return apiSend<MediatorAssessmentStart | { assessments: MediatorAssessmentStart[] }>(
    '/api/career/assessments?action=start', 'POST', body, token,
  );
}

/** Submit an assessment to the in-house scoring endpoint. */
export async function submitAssessment(token: string | null, answers: Record<string, unknown>, assessmentId?: string): Promise<MediatorAssessmentSubmitResult> {
  return apiSend<MediatorAssessmentSubmitResult>(
    '/api/career/assessments?action=submit',
    'POST',
    { ...(assessmentId ? { assessment_id: assessmentId } : {}), answers },
    token,
  );
}

/** Load the signed-in student's profile preferences (for matching filters). */
export async function fetchProfilePrefs(token: string | null): Promise<{ prefs: ProfilePrefs | null }> {
  return apiGet<{ prefs: ProfilePrefs | null }>('/api/profile-prefs', token);
}

/** Save the signed-in student's profile preferences. */
export async function saveProfilePrefs(token: string | null, prefs: Partial<Omit<ProfilePrefs, 'student_id'>>): Promise<{ ok: boolean; prefs: ProfilePrefs }> {
  return apiSend<{ ok: boolean; prefs: ProfilePrefs }>('/api/profile-prefs', 'PUT', prefs, token);
}

/** Submit skill evidence for verification (student action). */
export async function submitSkillEvidence(token: string | null, payload: {
  skill_name: string;
  evidence_type: string;
  evidence_text?: string;
  evidence_url?: string;
}): Promise<{ ok: boolean; request: SkillVerificationRequest }> {
  return apiSend('/api/skills/verify', 'POST', payload, token);
}

/** List the signed-in student's verification requests. */
export async function fetchSkillVerificationRequests(token: string | null): Promise<{ requests: SkillVerificationRequest[] }> {
  return apiGet('/api/skills/verify', token);
}
