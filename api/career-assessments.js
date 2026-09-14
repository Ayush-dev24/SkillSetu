// Skill Setu in-house career assessments.
// ---------------------------------------------------------------------------
// POST /api/career/assessments?action=start  → returns the question bank
// POST /api/career/assessments?action=submit → scores server-side, persists
//                                              the result, returns outcome
//
// Everything runs inside Skill Setu — no external mediator. Scoring uses the
// authoritative server-side copy of the engine (api/lib/assessments.js), so
// clients can never tamper with results. After a successful submit callers
// should trigger /api/career-match?refresh=1 so verification updates.

import { requireUser } from './auth-helpers.js';
import supabase from './db-client.js';
import { getAssessment, outcomeForAssessment } from './lib/assessments.js';
import { inferSkillVerification } from './lib/matching.js';

const ALLOWED = new Set(['start', 'submit']);

/** Return only the client-safe question bank (never answer keys). */
function publicAssessment(def) {
  return {
    assessment_id: def.id,
    title: def.title,
    description: def.description,
    skill: def.skill,
    skill2: def.skill2 || null,
    duration_min: def.durationMin,
    pass_score: def.passScore,
    questions: def.questions.map((q) => ({
      id: q.id,
      text: q.text,
      kind: q.kind,
      options: q.options ? q.options.map((o) => o.label) : undefined,
      hint: q.hint,
    })),
  };
}

async function resolveStudentId(user) {
  // students row linked via profiles.student_id, else by email.
  const { data: profile } = await supabase.from('profiles').select('student_id').eq('user_id', user.id).limit(1);
  const sid = profile?.[0]?.student_id;
  if (sid != null && Number.isFinite(Number(sid))) return Number(sid);
  if (user.email) {
    const { data } = await supabase.from('students').select('id').eq('email', user.email).limit(1);
    if (data && data.length > 0) return data[0].id;
  }
  // Demo/legacy path: the first student (read-only matching still works).
  const { data: first } = await supabase.from('students').select('id').limit(1);
  return first && first.length > 0 ? first[0].id : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await requireUser(req, res);
    if (!user) return;

    const action = String(req.query.action || req.body?.action || '').toLowerCase();
    if (!ALLOWED.has(action)) {
      return res.status(400).json({ error: 'action must be "start" or "submit"' });
    }

    if (action === 'start') {
      const id = String(req.body?.assessment_id || req.body?.id || '').trim();
      if (!id) {
        // Catalog listing (no id) → return the full public catalog summary.
        const { ASSESSMENTS } = await import('./lib/assessments.js');
        return res.status(200).json({
          ok: true,
          assessments: ASSESSMENTS.map((a) => publicAssessment(a)),
        });
      }
      const def = getAssessment(id);
      if (!def) return res.status(404).json({ error: 'Unknown assessment id.' });
      return res.status(200).json({
        ok: true,
        ...publicAssessment(def),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    }

    // ---- submit ----
    const id = String(req.body?.assessment_id || req.body?.id || '').trim();
    const def = getAssessment(id);
    if (!def) return res.status(404).json({ error: 'Unknown assessment id.' });
    const answers = req.body?.answers;
    if (answers == null || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers must be an object of question_id → value' });
    }

    const outcome = outcomeForAssessment(def, answers);

    // Persist (best-effort — demo mode keeps working when DB is unavailable).
    const studentId = await resolveStudentId(user);
    let persistedId = null;
    if (studentId != null) {
      const { data, error } = await supabase.from('assessment_results').insert({
        student_id: studentId,
        assessment_id: def.id,
        skill_name: def.skill,
        score: outcome.score,
        level: outcome.level,
        passed: outcome.passed,
        skills_verified: outcome.skills_verified,
        answers: answers,
        created_at: new Date().toISOString(),
      }).select('id').single();
      if (!error) persistedId = data?.id ?? null;
      else console.warn('assessment_results insert failed (continuing):', error.message);
    }

    // Optional: bump the linked student_skills proficiency when a passing
    // score is higher than the current self-report (server-side evidence).
    if (studentId != null && outcome.passed) {
      const { data: rows } = await supabase.from('student_skills')
        .select('id,proficiency_pct')
        .eq('student_id', studentId)
        .ilike('skill_name', def.skill)
        .limit(1);
      if (rows && rows.length > 0) {
        const current = Number(rows[0].proficiency_pct) || 0;
        if (outcome.score > current) {
          await supabase.from('student_skills')
            .update({ proficiency_pct: Math.min(100, outcome.score), level: Math.max(rows[0].level || 1, outcome.level) })
            .eq('id', rows[0].id);
        }
      }
    }

    return res.status(200).json({
      ok: true,
      ...outcome,
      result_id: persistedId,
      student_id: studentId,
      // Fresh verification state for the affected skills.
      verification: outcome.skills_verified.map((s) =>
        inferSkillVerification(s, {
          skills: [],
          assessmentScores: { [s]: outcome.score },
        }),
      ),
    });
  } catch (err) {
    console.error('assessments API error:', err);
    return res.status(502).json({
      error: 'Assessment service is temporarily unavailable',
      reason: 'engine_error',
    });
  }
}