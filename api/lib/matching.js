// Server-side mirror of src/lib/matching.ts (ESM, dependency-free).
// Keep in sync with the frontend copy. This is the AUTHORITATIVE matching
// engine used by /api/career-match — the browser copy is ONLY a fallback
// when the API layer is unavailable.

import { normalizeCity } from './normalization.js';

export const VERIFY_CONFIDENCE_CEIL = {
  VERIFIED: 100,
  PARTIALLY_VERIFIED: 79,
  NEEDS_EVIDENCE: 59,
  UNVERIFIED: 34,
};

export function inferSkillVerification(skillName, input) {
  const { skills = [], verified = false, assessmentScores = {} } = input;
  const row = skills.find((s) => String(s.skill_name).toLowerCase() === String(skillName).toLowerCase());
  const prof = row?.proficiency_pct ?? 0;
  const hasAssessment = assessmentScores[skillName] != null;
  const assessScore = assessmentScores[skillName] ?? 0;
  const endorsed = Boolean(row?.verified || verified);
  const hasRow = Boolean(row);

  let state = 'UNVERIFIED';
  let confidence = null;

  if (hasRow) {
    if (hasAssessment && assessScore >= 85) {
      state = 'VERIFIED';
      confidence = Math.round(60 + (assessScore - 60) * 0.8);
    } else if (endorsed || (hasAssessment && assessScore >= 55) || prof >= 70) {
      state = 'PARTIALLY_VERIFIED';
      confidence = Math.round(40 + (endorsed ? 20 : 0) + (hasAssessment ? (assessScore - 40) * 0.5 : 0) + (prof >= 70 ? 10 : 0));
    } else if (prof >= 40 || hasAssessment) {
      state = 'NEEDS_EVIDENCE';
      confidence = Math.round(30 + Math.min(20, prof - 20));
    } else {
      state = 'UNVERIFIED';
      confidence = 15;
    }
  } else if (hasAssessment && assessScore >= 55) {
    state = 'NEEDS_EVIDENCE';
    confidence = Math.min(30, Math.round(assessScore * 0.3));
  } else {
    state = 'UNVERIFIED';
    confidence = hasAssessment ? Math.min(30, Math.round(assessScore * 0.3)) : null;
  }

  if (confidence != null) confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  let explanation = '';
  if (state === 'VERIFIED') explanation = `Verified through assessment (${assessScore}%) — strong independent evidence of this skill.`;
  else if (state === 'PARTIALLY_VERIFIED') explanation = endorsed
    ? 'Endorsed by a company/college — treated as partially verified while self-rating is still used.'
    : `Profile confidence is strong (${prof}%) but no verified evidence (assessment or endorsement) exists yet.`;
  else if (state === 'NEEDS_EVIDENCE') explanation = hasAssessment
    ? `Assessment scored ${assessScore}% — retake above the pass mark to verify.`
    : `Listed on your profile (${prof}%) — complete an assessment or get an endorsement to verify.`;
  else explanation = hasRow
    ? 'Low self-reported confidence — add evidence (assessment/endorsement) to verify.'
    : 'Not listed on your profile — add it or take an assessment to start verification.';

  return {
    skill: skillName,
    state,
    confidence,
    explanation,
    evidence_summary: hasAssessment ? `Assessment: ${assessScore}%` : row ? `Profile: ${prof}%` : 'No evidence yet',
  };
}

export function verifySkills(skills, assessmentScores) {
  return (skills || []).map((s) => inferSkillVerification(s.skill_name, { skills, assessmentScores: assessmentScores || {} }));
}

export const DEFAULT_WEIGHTS = { skills: 55, location: 15, verified: 15, experience: 10, remote: 5 };

export function scoreJobAgainstProfile(job, profile, weights = DEFAULT_WEIGHTS) {
  const required = (job.skills || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  const myByName = new Map();
  for (const s of profile.skills || []) {
    const k = String(s.skill_name).trim().toLowerCase();
    if (!myByName.has(k)) myByName.set(k, s);
  }

  const matched = [];
  const verifiedMatched = [];
  const partiallyMatched = [];
  const missing = [];

  for (const req of required) {
    const mine = myByName.get(req);
    if (!mine) { missing.push(req); continue; }
    matched.push(mine.skill_name);
    const verified = profile.verifiedSkills?.has?.(req) || Boolean(mine.verified) || (profile.assessmentScores?.[mine.skill_name] ?? 0) >= 85;
    if (verified) verifiedMatched.push(mine.skill_name);
    else if ((mine.proficiency_pct ?? 0) >= 55 || (profile.assessmentScores?.[mine.skill_name] ?? 0) >= 55) partiallyMatched.push(mine.skill_name);
  }

  const denom = Math.max(1, required.length);
  let skillPoints = 0;
  if (required.length === 0) skillPoints = 55;
  else {
    const full = matched.filter((s) => !missing.includes(s));
    skillPoints = Math.round(((full.length + partiallyMatched.length * 0.6) / denom) * 100);
  }

  const levelBonus = matched.reduce((sum, name) => {
    const mine = myByName.get(name.toLowerCase());
    return sum + (mine && (mine.level ?? 0) >= 4 ? 2 : 0);
  }, 0);

  const prefLocs = (profile.preferredLocations || []).map((l) => String(l).trim().toLowerCase()).filter(Boolean);
  const jobCity = normalizeCity(job.location);
  let locationOk = prefLocs.length === 0 || !job.location;
  if (!locationOk && jobCity) {
    locationOk = prefLocs.some((p) => p === jobCity.toLowerCase() || p.includes(jobCity.toLowerCase()) || jobCity.toLowerCase().includes(p));
  }
  if (!locationOk && String(job.work_mode || '').toUpperCase() === 'REMOTE') locationOk = true;
  const locationNote = locationOk ? 'Location fits your preferences.' : `Listed in ${job.location || 'an unspecified location'} — not in your preferred locations.`;

  const expMin = Number(job.experience_min || 0);
  const expMax = profile.maxExperienceYears ?? Math.min(2, (job.experience_min ?? 0) + 2);
  const expOk = expMin <= Math.max(0, expMax || 0);

  const verifiedBonus = job.verified ? 8 : 0;
  const remoteOk = !profile.preferredWorkModes?.length || String(job.work_mode || '').toUpperCase() === 'REMOTE' || profile.preferredWorkModes.includes(String(job.work_mode || '').toUpperCase());

  const totalMax = Math.max(1, weights.skills + weights.location + weights.verified + weights.experience + weights.remote);
  let score = Math.round(
    (skillPoints * weights.skills +
      (locationOk ? 100 : 55) * weights.location +
      (verifiedBonus ? Math.min(100, 70 + verifiedBonus) : 45) * weights.verified +
      (expOk ? 100 : 50) * weights.experience +
      (remoteOk ? 100 : 55) * weights.remote) / totalMax +
      levelBonus,
  );

  const blockers = [];
  const actions = [];
  if (!expOk) {
    blockers.push(`Requires ${expMin}+ years of experience.`);
    actions.push('Build a portfolio with client/deployment evidence to offset experience requirements.');
  }
  if (!locationOk) {
    blockers.push(`Based in ${job.location || 'an unspecified location'} — outside your preferred locations.`);
    actions.push('Consider remote-friendly roles or update your preferred locations.');
  }
  if (missing.length > 0) {
    blockers.push(`Missing skills: ${missing.slice(0, 4).join(', ')}.`);
    actions.push(`Work toward ${missing.slice(0, 3).join(', ')} before applying.`);
  }
  if (score < 60 && matched.length === 0) actions.push('Take a focused assessment and add evidence for the most-requested skills first.');
  if (score < 40) blockers.push('Low overall match — this role is a stretch at your current level.');

  const why = [];
  if (required.length === 0) why.push('This role does not list required skills — an open opportunities channel for your profile.');
  else {
    if (matched.length) why.push(`You match ${matched.length} of ${required.length} required skills${verifiedMatched.length ? ` (${verifiedMatched.length} verified)` : ''}.`);
    else why.push('None of the required skills are on your profile yet.');
    if (verifiedMatched.length) why.push(`${verifiedMatched.length} verified skill${verifiedMatched.length > 1 ? 's' : ''} raise employer trust for this role.`);
    if (!locationOk) why.push(locationNote);
    if (expOk && expMin > 0) why.push(`Experience requirement (${expMin}y) is within reach.`);
    if (job.verified) why.push('Listing is verified by the jobs service — lower fraud risk.');
  }

  const breakdown = [
    { key: 'skills', label: 'Skill coverage', points: skillPoints, max: 100, note: `${matched.length}/${denom} required skills matched` },
    { key: 'location', label: 'Location fit', points: locationOk ? 100 : 55, max: 100, note: locationNote },
    { key: 'verified', label: 'Verified job', points: verifiedBonus ? 78 : 45, max: 100, note: job.verified ? 'Verified by TrustJob.in' : 'Unverified listing' },
    { key: 'experience', label: 'Experience fit', points: expOk ? 100 : 50, max: 100, note: expOk ? 'Meets requirement' : `Needs ${expMin}y minimum` },
    { key: 'remote', label: 'Work mode', points: remoteOk ? 100 : 55, max: 100, note: remoteOk ? 'Fits your work-mode' : job.work_mode || 'Unspecified' },
  ];

  score = Math.max(0, Math.min(100, score));
  return { score, matched, verifiedMatched, partiallyMatched, missing, locationOk, locationNote, why, blockers, actions, breakdown };
}

export function matchJobs(jobs, profile, limit = 20) {
  return (jobs || [])
    .map((j) => {
      const r = scoreJobAgainstProfile(j, profile);
      return {
        job_id: j.source_url && j.source_url.includes('/') ? j.source_url.split('/').pop() || null : null,
        title: j.title || 'Untitled role',
        company: j.company || 'Verified employer',
        location: j.location || '',
        match_score: r.score,
        verified: Boolean(j.verified),
        matched_skills: r.matched,
        verified_skills: r.verifiedMatched,
        partially_verified_skills: r.partiallyMatched,
        missing_skills: r.missing,
        why_matches: r.why.join(' '),
        blockers: r.blockers,
        actions: r.actions,
        application_url: j.source_url || '',
        source: 'TrustJob.in',
      };
    })
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit);
}

export function categoryOfScore(score) {
  if (score >= 75) return 'STRONG';
  if (score >= 55) return 'GOOD';
  return 'STRETCH';
}

export const CATEGORY_META = {
  STRONG: { label: 'Strong match', color: '#0d7a5f', bg: '#effaf4', hint: 'High coverage of required skills and strong evidence — apply with confidence.' },
  GOOD: { label: 'Good match', color: '#2563eb', bg: '#eef3ff', hint: 'Most requirements covered — a focused upgrade on 1-2 skills would make this a strong fit.' },
  STRETCH: { label: 'Stretch', color: '#e8930c', bg: '#fff6e6', hint: 'Applicable but you are missing key skills — treat as a learning target, not a sure thing.' },
};

export function categorizeRecommendations(recs) {
  return {
    strong: recs.filter((r) => categoryOfScore(r.match_score) === 'STRONG'),
    good: recs.filter((r) => categoryOfScore(r.match_score) === 'GOOD'),
    stretch: recs.filter((r) => categoryOfScore(r.match_score) === 'STRETCH'),
  };
}

export function computeSkillGaps(input) {
  const { skills = [], jobSkillDemand = {}, protectedSkills = new Set(), assessmentScores = {} } = input;
  const byName = new Map();
  for (const s of skills) {
    const k = String(s.skill_name).trim().toLowerCase();
    if (!byName.has(k)) byName.set(k, s);
  }

  const gaps = [];
  for (const [rawName, demand] of Object.entries(jobSkillDemand)) {
    const name = String(rawName).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (protectedSkills.has(key)) continue;
    const mine = byName.get(key);
    const assessed = assessmentScores[name] ?? 0;
    const hasRow = Boolean(mine);
    const prof = mine?.proficiency_pct ?? 0;
    const strong = Boolean(mine?.verified) || assessed >= 85;
    if (strong) continue;
    let priority = 1;
    let reason = '';
    if (!hasRow && assessed === 0) {
      priority = 5;
      reason = `Appears in ${demand} of the roles you were matched with, and is missing from your profile.`;
    } else if (hasRow && (prof >= 55 || assessed >= 55)) {
      priority = 3;
      reason = `You have medium evidence (${prof}% profile / assessment ${assessed ? `${assessed}%` : 'n/a'}) but no verification — employers want proof.`;
    } else if (hasRow || assessed >= 30) {
      priority = 4;
      reason = 'Present but weak evidence — complete an assessment or get an endorsement.';
    } else {
      priority = 2;
      reason = 'Not on your profile yet.';
    }
    gaps.push({ skill: name, priority, reason, jobs_requiring: [] });
  }

  for (const s of skills) {
    const key = String(s.skill_name).trim().toLowerCase();
    if (protectedSkills.has(key)) continue;
    if (jobSkillDemand[key] == null) continue;
    if (!s.verified && (s.proficiency_pct ?? 0) < 55 && (assessmentScores[s.skill_name] ?? 0) < 55) {
      gaps.push({ skill: s.skill_name, priority: 4, reason: `Listed at ${s.proficiency_pct}% but unverified — strengthen with an assessment or endorsement.`, jobs_requiring: [] });
    }
  }

  const seen = new Set();
  const uniq = gaps.filter((g) => {
    if (seen.has(g.skill)) return false;
    seen.add(g.skill);
    return true;
  });
  return uniq.sort((a, b) => b.priority - a.priority).slice(0, 30);
}

export function buildImproveMyMatch(gaps, verification, options) {
  const steps = [];
  for (const g of gaps) {
    steps.push({
      id: `gap-${g.skill}`,
      title: `Close the "${g.skill}" gap`,
      detail: g.reason || 'This skill shows up in the roles you matched with.',
      skill: g.skill,
      priority: g.priority,
      effort: g.priority >= 4 ? 'long' : 'medium',
    });
  }
  for (const v of verification) {
    if (v.state === 'VERIFIED' || v.state === 'PARTIALLY_VERIFIED') continue;
    const canAssess = options?.takeAssessmentFor?.(v.skill) ?? true;
    if (!canAssess) continue;
    steps.push({
      id: `assess-${v.skill}`,
      title: `Take a "${v.skill}" assessment`,
      detail: v.state === 'NEEDS_EVIDENCE'
        ? 'You listed this skill — a quick assessment converts it into verified evidence.'
        : 'An assessment turns an unlisted skill into credible evidence employers can see.',
      skill: v.skill,
      priority: 3,
      effort: 'quick',
    });
  }
  if (steps.length === 0 || steps.length < 4) {
    const base = [
      { id: 'refine-resume', title: 'Refine your resume to surface skills', detail: 'Use concrete project bullet points — the parser turns them into skill map entries.', priority: 2, effort: 'quick' },
      { id: 'portfolio', title: 'Ship a portfolio piece', detail: 'A deployable project outranks any self-report — link it from your profile.', priority: 3, effort: 'medium' },
    ];
    for (const b of base) {
      if (!steps.some((s) => s.id === b.id)) steps.push(b);
    }
  }
  return steps.sort((a, b) => b.priority - a.priority).slice(0, 12);
}

export function explainScore(r) {
  const cat = categoryOfScore(r.match_score);
  const lines = [`${CATEGORY_META[cat].label} — ${r.match_score}%`];
  if (r.matched_skills.length > 0) lines.push(`You match ${r.matched_skills.length} of ${r.matched_skills.length + r.missing_skills.length} required skills (${r.matched_skills.slice(0, 4).join(', ')}${r.matched_skills.length > 4 ? '…' : ''}).`);
  else if (r.missing_skills.length > 0) lines.push(`Missing ${r.missing_skills.slice(0, 4).join(', ')} — that is why this is not a strong match yet.`);
  if (r.verified_skills.length > 0) lines.push(`${r.verified_skills.length} verified skill${r.verified_skills.length > 1 ? 's' : ''} strengthen this match.`);
  if (r.blockers.length > 0) lines.push(`Blockers: ${r.blockers.slice(0, 2).join(' ')}`);
  if (r.actions.length > 0) lines.push(`Next step: ${r.actions[0]}`);
  return lines.slice(0, 4);
}

export function summarizeProfile(skills, options) {
  const sorted = [...(skills || [])].sort((a, b) => (b.proficiency_pct ?? 0) - (a.proficiency_pct ?? 0));
  const top = sorted.slice(0, 5).map((s) => ({
    skill: s.skill_name,
    level: Math.max(1, Math.min(5, Math.round((s.proficiency_pct ?? 0) / 20) || 1)),
    verified: Boolean(s.verified) || (options?.assessmentScores?.[s.skill_name] ?? 0) >= 85,
  }));
  const verifiedCount = sorted.filter((s) => s.verified || (options?.assessmentScores?.[s.skill_name] ?? 0) >= 85).length;
  const readiness = Math.max(20, Math.min(98, Math.round(35 + (verifiedCount / Math.max(1, sorted.length)) * 40 + Math.min(20, sorted.length * 2))));
  return {
    name: options?.targetRole || 'Student',
    target_role: options?.targetRole || (top[0]?.skill ? `Aspiring ${top[0].skill}` : 'Open to verified opportunities'),
    top_skills: top,
    readiness,
    verified_count: verifiedCount,
  };
}