// Skill Setu evidence-based skill verification.
// ---------------------------------------------------------------------------
// POST /api/skills/verify   — student submits evidence for a skill
// GET  /api/skills/verify   — list the current user's verification requests
// PUT  /api/skills/verify   — company/college/ministry reviews evidence:
//                             { id, verdict: 'APPROVED' | 'REJECTED' }
//
// Verification is an EVIDENCE action, never a self-report:
//   - a student request creates a pending row (skill_verification_requests)
//   - the reviewer (company/college/ministry) marks it approved/rejected
//   - approval updates the matching engine's source of truth via
//     student_skills.verified so career-match reflects it immediately.
//
// Zero-PII: only the skill name + evidence type/text (no unrelated profile
// data) gets stored, and evidence text is capped.

import { requireRole, getProfile } from '../auth-helpers.js';
import supabase from '../db-client.js';

const REVIEW_ROLES = ['company', 'college', 'ministry'];
const EVIDENCE_TYPES = new Set(['certificate', 'assessment', 'endorsement', 'project', 'other']);
const MAX_EVIDENCE = 2000;

async function resolveStudentId(auth, user) {
  if (auth.profile?.student_id != null) return Number(auth.profile.student_id);
  if (user?.email) {
    const { data } = await supabase.from('students').select('id').eq('email', user.email).limit(1);
    if (data && data.length > 0) return data[0].id;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'POST') {
      // Student submits evidence.
      const auth = await requireRole(req, res, ['student']);
      if (!auth) return;
      const b = req.body || {};
      const skill = String(b.skill_name || b.skill || '').trim().slice(0, 120);
      if (!skill) return res.status(400).json({ error: 'skill_name is required' });
      const type = String(b.evidence_type || 'other').toLowerCase();
      if (!EVIDENCE_TYPES.has(type)) return res.status(400).json({ error: `evidence_type must be one of: ${Array.from(EVIDENCE_TYPES).join(', ')}` });
      const evidenceText = String(b.evidence_text || '').slice(0, MAX_EVIDENCE);
      const evidenceUrl = String(b.evidence_url || '').trim().slice(0, 500);
      if (!evidenceText && !evidenceUrl) {
        return res.status(400).json({ error: 'Provide evidence_text or evidence_url.' });
      }

      const studentId = await resolveStudentId(auth, auth.user);
      if (studentId == null) return res.status(400).json({ error: 'No linked student profile — add skills first.' });

      const row = {
        student_id: studentId,
        skill_name: skill,
        evidence_type: type,
        evidence_text: evidenceText || null,
        evidence_url: evidenceUrl || null,
        status: 'PENDING',
        requested_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('skill_verification_requests').insert(row).select().single();
      if (error) throw error;
      return res.status(201).json({ ok: true, request: data });
    }

    if (req.method === 'GET') {
      const auth = await requireRole(req, res, ['student']);
      if (!auth) return;
      const studentId = await resolveStudentId(auth, auth.user);
      if (studentId == null) return res.status(200).json({ requests: [] });
      const { data, error } = await supabase.from('skill_verification_requests')
        .select('*')
        .eq('student_id', studentId)
        .order('requested_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return res.status(200).json({ requests: data || [] });
    }

    if (req.method === 'PUT') {
      // Reviewer verdict.
      const auth = await requireRole(req, res, REVIEW_ROLES);
      if (!auth) return;
      const b = req.body || {};
      const id = Number(b.id ?? b.request_id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'id is required' });
      const verdict = String(b.verdict || '').toUpperCase();
      if (verdict !== 'APPROVED' && verdict !== 'REJECTED') {
        return res.status(400).json({ error: 'verdict must be APPROVED or REJECTED' });
      }
      const { data: existing } = await supabase.from('skill_verification_requests').select('*').eq('id', id).single();
      if (!existing) return res.status(404).json({ error: 'Verification request not found.' });

      const update = {
        status: verdict === 'APPROVED' ? 'APPROVED' : 'REJECTED',
        reviewed_by: auth.profile?.company_id ?? auth.profile?.college ?? auth.role ?? null,
        reviewed_at: new Date().toISOString(),
        review_note: String(b.review_note || '').slice(0, 500) || null,
      };
      const { data, error } = await supabase.from('skill_verification_requests').update(update).eq('id', id).select().single();
      if (error) throw error;

      // On approval, flip the linked student_skills row to verified so the
      // in-house matching engine sees it (that row is the engine source).
      if (verdict === 'APPROVED') {
        const key = String(existing.skill_name).trim().toLowerCase();
        const { data: rows } = await supabase.from('student_skills')
          .select('id,skill_name')
          .eq('student_id', existing.student_id)
          .limit(200);
        for (const r of rows || []) {
          if (String(r.skill_name || '').trim().toLowerCase() === key) {
            await supabase.from('student_skills')
              .update({ verified: true, source: 'Verified via evidence' })
              .eq('id', r.id);
            break;
          }
        }
      }
      return res.status(200).json({ ok: true, request: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('skills/verify API error:', err);
    return res.status(500).json({ error: err.message });
  }
}