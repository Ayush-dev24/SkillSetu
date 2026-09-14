// Response validation for the Skill Setu career-matching mediator.
// ---------------------------------------------------------------------------
// Skill Setu must never blindly trust an external response. This module
// validates the shape/type/range of the mediator payload server-side, before
// anything is forwarded to the browser. Validation failures produce a clean
// 502/`invalid` result that the frontend can render as "temporarily
// unavailable" without breaking the rest of the site.

const MATCH_SCORE_MIN = 0;
const MATCH_SCORE_MAX = 100;
const VERIFY_STATES = new Set(['VERIFIED', 'PARTIALLY_VERIFIED', 'NEEDS_EVIDENCE', 'UNVERIFIED']);

function isPlainObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Normalize one skill-verification entry; returns null when unusable. */
function normalizeVerification(v) {
  if (!isPlainObj(v)) return null;
  const skill = typeof v.skill === 'string' ? v.skill.trim() : typeof v.skill_name === 'string' ? v.skill_name.trim() : '';
  if (!skill) return null;
  const state = typeof v.state === 'string' ? v.state.toUpperCase() : 'NEEDS_EVIDENCE';
  const confidence = Number(v.confidence);
  return {
    skill,
    state: VERIFY_STATES.has(state) ? state : 'NEEDS_EVIDENCE',
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : null,
    explanation: typeof v.explanation === 'string' ? v.explanation.slice(0, 400) : '',
    evidence_summary: typeof v.evidence_summary === 'string' ? v.evidence_summary.slice(0, 400) : '',
  };
}

/** Normalize one job recommendation; returns null when unusable. */
function normalizeRecommendation(r) {
  if (!isPlainObj(r) || typeof r.title !== 'string' || !r.title.trim()) return null;
  const rawScore = Number(r.match_score ?? r.score);
  const score = Number.isFinite(rawScore)
    ? Math.max(MATCH_SCORE_MIN, Math.min(MATCH_SCORE_MAX, Math.round(rawScore)))
    : null;
  if (score == null) return null;

  let applicationUrl = '';
  if (typeof r.application_url === 'string') {
    const u = r.application_url.trim();
    if (/^https?:\/\/.+/i.test(u) || u.startsWith('/')) applicationUrl = u;
  }
  return {
    job_id: r.job_id != null ? String(r.job_id) : null,
    title: r.title.trim().slice(0, 200),
    company: typeof r.company === 'string' ? r.company.trim().slice(0, 160) : '',
    location: typeof r.location === 'string' ? r.location.trim().slice(0, 160) : '',
    match_score: score,
    verified: Boolean(r.verified),
    matched_skills: Array.isArray(r.matched_skills) ? r.matched_skills.map(String).slice(0, 24) : [],
    verified_skills: Array.isArray(r.verified_skills) ? r.verified_skills.map(String).slice(0, 24) : [],
    partially_verified_skills: Array.isArray(r.partially_verified_skills) ? r.partially_verified_skills.map(String).slice(0, 24) : [],
    missing_skills: Array.isArray(r.missing_skills) ? r.missing_skills.map(String).slice(0, 24) : [],
    why_matches: typeof r.why_matches === 'string' ? r.why_matches : Array.isArray(r.why_matches) ? r.why_matches.map(String).join(' ') : '',
    blockers: Array.isArray(r.blockers) ? r.blockers.map(String).slice(0, 12) : typeof r.blockers === 'string' && r.blockers ? [r.blockers] : [],
    actions: Array.isArray(r.actions) ? r.actions.map(String).slice(0, 12) : typeof r.actions === 'string' && r.actions ? [r.actions] : [],
    application_url: applicationUrl,
    source: typeof r.source === 'string' ? r.source.trim().slice(0, 120) : '',
  };
}

/** Normalize one skill-gap entry; returns null when unusable. */
function normalizeSkillGap(g) {
  if (!isPlainObj(g)) return null;
  const skill = typeof g.skill === 'string' ? g.skill.trim() : '';
  if (!skill) return null;
  const priority = Number(g.priority ?? g.level ?? 0);
  return {
    skill: skill.slice(0, 120),
    priority: Number.isFinite(priority) ? Math.max(1, Math.min(5, Math.round(priority))) : 1,
    reason: typeof g.reason === 'string' ? g.reason.slice(0, 300) : '',
    jobs_requiring: Array.isArray(g.jobs_requiring) ? g.jobs_requiring.map(String).slice(0, 12) : [],
  };
}

/**
 * Validate + normalize a full mediator /api/match payload.
 *
 * - user_id: required string, must match the requesting Skill Setu user.
 * - recommendations: array (may be empty) of normalized recs.
 * - skill_verification: array (may be empty) of normalized entries.
 * - skill_gaps: array, sorted high-priority first.
 * - jobs_source_status.ok drives the "jobs temporarily unavailable" state.
 *
 * Returns { ok: true, data } or { ok: false, error }.
 */
export function validateMatchResponse(body, expectedUserId) {
  if (!isPlainObj(body)) {
    return { ok: false, error: 'Mediator returned a malformed response.' };
  }
  const user_id = typeof body.user_id === 'string' ? body.user_id : '';
  if (user_id && typeof expectedUserId === 'string' && expectedUserId && user_id !== expectedUserId) {
    return { ok: false, error: 'Mediator response user does not match the signed-in user.' };
  }

  const recs = Array.isArray(body.recommendations)
    ? body.recommendations.map(normalizeRecommendation).filter(Boolean)
    : [];
  const verification = Array.isArray(body.skill_verification)
    ? body.skill_verification.map(normalizeVerification).filter(Boolean)
    : [];
  const gaps = Array.isArray(body.skill_gaps)
    ? body.skill_gaps.map(normalizeSkillGap).filter(Boolean).sort((a, b) => b.priority - a.priority)
    : [];

  const jobsRaw = isPlainObj(body.jobs_source_status) ? body.jobs_source_status : {};
  const jobsSourceStatus = {
    ok: jobsRaw.ok !== false && jobsRaw.status !== 'error',
    message: typeof jobsRaw.message === 'string' ? jobsRaw.message : '',
    source: typeof jobsRaw.source === 'string' ? jobsRaw.source : '',
  };

  const metaRaw = isPlainObj(body.metadata) ? body.metadata : {};
  const generatedAt = typeof metaRaw.generated_at === 'string' ? metaRaw.generated_at : '';
  const profileSummary = isPlainObj(body.profile_summary)
    ? {
        name: typeof body.profile_summary.name === 'string' ? body.profile_summary.name : '',
        target_role: typeof body.profile_summary.target_role === 'string' ? body.profile_summary.target_role : '',
      }
    : null;

  return {
    ok: true,
    data: {
      user_id,
      profile_summary: profileSummary,
      skill_verification: verification,
      recommendations: recs,
      skill_gaps: gaps,
      jobs_source_status: jobsSourceStatus,
      metadata: { generated_at: generatedAt },
    },
  };
}

export { mediatorFetch, mediatorBaseUrl, mediatorConfigured, mediatorHealth } from './mediator.js';
export { mapProfileToMediatorSchema } from './career-match-profile.js';
// In-house engine pieces (used by career-match internally; kept exported for
// legacy callers that expect the mediator boundary to exist).
export {
  verifySkills,
  matchJobs,
  computeSkillGaps,
  summarizeProfile,
  buildImproveMyMatch,
  categorizeRecommendations,
  categoryOfScore,
} from '../_lib/matching.js';
export { scoreAssessment, getLevelFromScore, outcomeForAssessment, ASSESSMENTS } from '../_lib/assessments.js';