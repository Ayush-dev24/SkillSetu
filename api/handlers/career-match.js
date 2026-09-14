// Skill Setu in-house career-matching endpoint.
// ---------------------------------------------------------------------------
// POST/GET /api/career-match
//
// Runs the WHOLE matching pipeline inside Skill Setu — no external mediator:
//   1. authenticates the signed-in user (Supabase session)
//   2. loads their profile: students row, student_skills, certificates,
//      assessment_results (in-house assessments) and profile_prefs
//   3. fetches the verified external jobs feed via fetchVerifiedJobs()
//      (zero-PII: only anonymous filters leave this server)
//   4. computes skill verification (VERIFIED / PARTIALLY_VERIFIED /
//      NEEDS_EVIDENCE / UNVERIFIED) from evidence (rows, endorsements,
//      assessment scores)
//   5. scores each job against the profile (weighted: skills / location /
//      verified / experience / work-mode)
//   6. derives skill gaps (priority 1-5, high first) from job demand
//   7. returns the validated shape the dashboard already renders
//
// ?refresh=1 always reruns; otherwise a 10-min in-memory cache serves the
// dashboard view so navigation never re-runs the whole pipeline.

import supabase from '../db-client.js';
import { requireUser, getProfile } from '../auth-helpers.js';
import { mapProfileToJobFilters } from './career-match-profile.js';
import { fetchVerifiedJobs } from './jobs-feed.js';
import {
  verifySkills,
  matchJobs,
  computeSkillGaps,
  summarizeProfile,
} from '../lib/matching.js';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map(); // user_id -> { fetchedAt, payload }

function respond(res, status, data) {
  res.status(status).json(data);
}

async function loadStudentProfile(user, profile) {
  const sid = profile?.student_id != null ? Number(profile.student_id) : null;

  let student = null;
  if (sid != null && Number.isFinite(sid)) {
    const { data } = await supabase.from('students').select('*').eq('id', sid).limit(1);
    if (data && data.length > 0) student = data[0];
  }
  if (!student && user?.email) {
    const { data } = await supabase.from('students').select('*').eq('email', user.email).limit(1);
    if (data && data.length > 0) student = data[0];
  }
  if (!student && profile?.student_id != null) {
    const { data } = await supabase.from('students').select('*').eq('id', Number(profile.student_id)).limit(1);
    if (data && data.length > 0) student = data[0];
  }

  const sidForLookup = student?.id ?? sid;
  const [skillsRes, certsRes, appRes, assessRes, prefsRes] = await Promise.all([
    sidForLookup != null
      ? supabase.from('student_skills').select('skill_name,category,level,proficiency_pct,verified,source').eq('student_id', sidForLookup).limit(200)
      : { data: [], error: null },
    sidForLookup != null
      ? supabase.from('certificates').select('opportunity_title,cert_code,skills_validated').eq('student_id', sidForLookup).limit(20)
      : { data: [], error: null },
    sidForLookup != null
      ? supabase.from('applications').select('opportunity_id,status').eq('student_id', sidForLookup).limit(50)
      : { data: [], error: null },
    sidForLookup != null
      ? supabase.from('assessment_results').select('assessment_id,score,passed,skills_verified,created_at').eq('student_id', sidForLookup).limit(50)
      : { data: [], error: null },
    sidForLookup != null
      ? supabase.from('profile_prefs').select('*').eq('student_id', sidForLookup).limit(1)
      : { data: [], error: null },
  ]);

  return {
    student,
    skills: skillsRes.data || [],
    certificates: certsRes.data || [],
    applications: appRes.data || [],
    assessments: assessRes.data || [],
    prefs: (prefsRes.data || [])[0] || null,
  };
}

/** Map a raw external jobs-feed row to the engine's job input shape. */
function mapExternalJobForMatch(j) {
  const salary = j.salary || {};
  const experience = j.experience || {};
  const workMode = String(j.work_mode || 'ON_SITE');
  return {
    title: String(j.title || 'Untitled role'),
    company: String(j.company || 'Verified employer'),
    location: String(j.location || j.city || 'India'),
    work_mode: workMode,
    skills: Array.isArray(j.skills) ? j.skills.map(String) : [],
    experience_min: Number(experience.min || 0),
    verified: j.verification?.status === 'VERIFIED_SAFE',
    source_url: String(j.application_url || ''),
    source: String(j.source || 'TrustJob.in'),
    salary_text: String(salary.formatted || ''),
  };
}

/** Aggregate how often each skill appears across the returned jobs. */
function jobSkillDemand(jobs) {
  const demand = {};
  for (const j of jobs) {
    const seen = new Set();
    for (const s of j.skills || []) {
      const key = String(s).trim();
      if (!key || seen.has(key.toLowerCase())) continue;
      seen.add(key.toLowerCase());
      demand[key] = (demand[key] || 0) + 1;
    }
  }
  return demand;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const profile = await getProfile(user.id);
    const forceRefresh = String(req.query.refresh || '').toLowerCase() === '1' || req.method === 'POST';

    if (!forceRefresh) {
      const hit = cache.get(user.id);
      if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
        return respond(res, 200, { ...hit.payload, cached: true, fetched_at: new Date(hit.fetchedAt).toISOString() });
      }
    }

    const { student, skills, certificates, assessments, prefs } = await loadStudentProfile(user, profile);

    // Assessment scores by skill (only passed assessments count as strong
    // evidence for verification; any completed score informs the level).
    const assessmentScores = {};
    for (const a of assessments) {
      const skillsVerified = Array.isArray(a.skills_verified)
        ? a.skills_verified
        : [a.skill_id || a.assessment_id];
      for (const s of skillsVerified) {
        const key = String(s);
        if (!assessmentScores[key] || (a.score ?? 0) > assessmentScores[key]) {
          assessmentScores[key] = Number(a.score) || 0;
        }
      }
    }

    const verifiedSkillSet = new Set(
      skills.filter((s) => s.verified).map((s) => String(s.skill_name).trim().toLowerCase()),
    );

    // 1) Skill verification from evidence (rows + endorsements + assessments).
    const skillVerification = verifySkills(skills, assessmentScores);

    // 2) Fetch the verified jobs feed (zero-PII filters only).
    const jobFilters = mapProfileToJobFilters({ student, skills });
    let rawJobs = [];
    const jobsSourceStatus = { ok: true, message: 'Verified job feed available.', source: 'TrustJob.in' };
    try {
      const result = await fetchVerifiedJobs(jobFilters);
      rawJobs = Array.isArray(result.data) ? result.data : [];
      if (rawJobs.length === 0) {
        jobsSourceStatus.ok = true;
        jobsSourceStatus.message = 'Verified job feed returned no listings for your filters.';
      }
    } catch (e) {
      console.warn('[career-match] verified jobs feed unavailable:', e.message);
      jobsSourceStatus.ok = false;
      jobsSourceStatus.message = `Verified job feed unavailable: ${e.message}`;
    }

    const jobs = rawJobs.map(mapExternalJobForMatch);

    // 3) Score every job against the profile → recommendations.
    const profileForMatch = {
      skills,
      preferredLocations: Array.isArray(prefs?.preferred_locations)
        ? prefs.preferred_locations.map(String)
        : student?.location ? [student.location] : [],
      preferredWorkModes: Array.isArray(prefs?.preferred_work_modes) ? prefs.preferred_work_modes.map(String) : [],
      maxExperienceYears: Number(prefs?.max_experience_years) || 0,
      assessmentScores,
      verifiedSkills: verifiedSkillSet,
    };
    const recommendations = matchJobs(jobs, profileForMatch, 24);
    recommendations.forEach((r, i) => { r.rank = i + 1; });

    // 4) Skill gaps from job demand (fall back to internal opportunities
    //    when the external feed is down so the dashboard stays useful).
    let demand = jobSkillDemand(jobs);
    if (Object.keys(demand).length === 0) {
      try {
        const { data: opps } = await supabase.from('opportunities').select('skills_required').eq('status', 'open').limit(100);
        const internalJobs = (opps || []).map((o) => ({ skills: o.skills_required || [] }));
        demand = jobSkillDemand(internalJobs);
      } catch { /* no internal demand either */ }
    }
    const skillGaps = computeSkillGaps({
      skills,
      jobSkillDemand: demand,
      protectedSkills: verifiedSkillSet,
      assessmentScores,
    });

    // 5) Profile summary.
    const targetRole = Array.isArray(prefs?.preferred_roles) && prefs.preferred_roles.length
      ? String(prefs.preferred_roles[0])
      : (student?.headline || '').trim() || undefined;
    const profileSummary = summarizeProfile(skills, { targetRole, assessmentScores });

    const payloadOut = {
      ok: true,
      profile_summary: profileSummary,
      skill_verification: skillVerification,
      recommendations: recommendations,
      skill_gaps: skillGaps,
      jobs_source_status: jobsSourceStatus,
      metadata: {
        generated_at: new Date().toISOString(),
        engine: 'in-house-v1',
        jobs_reviewed: jobs.length,
        jobs_source: jobsSourceStatus.source,
      },
      fetcher_user_id: user.id,
      fetched_at: new Date().toISOString(),
      cached: false,
    };
    cache.set(user.id, { fetchedAt: Date.now(), payload: payloadOut });
    return respond(res, 200, payloadOut);
  } catch (err) {
    console.error('career-match API error:', err);
    return respond(res, 502, {
      ok: false,
      error: 'Recommendations are temporarily unavailable',
      reason: 'engine_error',
      detail: 'Something went wrong while running the matching engine.',
    });
  }
}
