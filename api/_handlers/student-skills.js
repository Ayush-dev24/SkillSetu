import supabase from '../_db-client.js';
import { requireRole } from '../_auth-helpers.js';

async function ownsStudent(auth, studentId) {
  // Linked accounts are pinned to their row; legacy demo accounts without a
  // link may manage the demo rows they are viewing.
  if (auth.profile?.student_id == null) return true;
  return Number(auth.profile.student_id) === Number(studentId);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { student_id } = req.query;
      let q = supabase.from('student_skills').select('*').order('proficiency_pct', { ascending: false });
      if (student_id) q = q.eq('student_id', student_id);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const auth = await requireRole(req, res, ['student']);
      if (!auth) return;
      const b = req.body || {};
      if (b.student_id == null || !b.skill_name || !String(b.skill_name).trim()) {
        return res.status(400).json({ error: 'student_id and skill_name are required' });
      }
      if (!(await ownsStudent(auth, b.student_id))) {
        return res.status(403).json({ error: 'You can only add skills to your own profile.' });
      }
      const lvl = Math.max(1, Math.min(5, Number(b.level ?? 3) || 3));
      const row = {
        student_id: Number(b.student_id),
        skill_name: String(b.skill_name).trim().slice(0, 80),
        category: String(b.category || 'Professional').slice(0, 60),
        level: lvl,
        proficiency_pct: Math.max(0, Math.min(100, Number(b.proficiency_pct ?? lvl * 18) || lvl * 18)),
        verified: false, // verification is a company/college action only
        source: String(b.source || 'Self-added').slice(0, 80),
      };
      const { data, error } = await supabase.from('student_skills').insert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return res.status(400).json({ error: 'id is required' });
      const { data: existing } = await supabase.from('student_skills').select('student_id').eq('id', b.id).single();
      if (!existing) return res.status(404).json({ error: 'Skill not found.' });
      // Verifying a skill is a company/college/ministry action. Students CANNOT set verification decision or verified status.
      const isTeacherOrOrgAction = b.verified !== undefined || b.verification_decision !== undefined;
      const auth = isTeacherOrOrgAction
        ? await requireRole(req, res, ['company', 'college', 'ministry'])
        : await requireRole(req, res, ['student']);
      if (!auth) return;
      if (!isTeacherOrOrgAction && !(await ownsStudent(auth, existing.student_id))) {
        return res.status(403).json({ error: 'You can only edit your own skills.' });
      }

      const allowed = isTeacherOrOrgAction
        ? ['verified', 'source', 'verification_decision', 'verified_by', 'decision_timestamp', 'teacher_remark']
        : ['level', 'proficiency_pct', 'category', 'skill_name', 'state'];

      const patch = {};
      for (const k of allowed) if (b[k] !== undefined) patch[k] = b[k];

      if (patch.verification_decision) {
        const dec = String(patch.verification_decision).toUpperCase();
        if (dec === 'COLLEGE VERIFIED' || dec === 'APPROVED') {
          patch.verification_decision = 'COLLEGE VERIFIED';
          patch.verified = true;
          patch.source = 'College Verified';
        } else if (dec === 'REJECTED') {
          patch.verification_decision = 'REJECTED';
          patch.verified = false;
        } else {
          patch.verification_decision = 'NOT VERIFIED';
          patch.verified = false;
        }
        patch.decision_timestamp = patch.decision_timestamp || new Date().toISOString();
        patch.verified_by = patch.verified_by || auth.profile?.email || 'College Administrator / Teacher';
      }

      if (patch.level != null) patch.level = Math.max(1, Math.min(5, Number(patch.level) || 3));
      if (patch.proficiency_pct != null) patch.proficiency_pct = Math.max(0, Math.min(100, Number(patch.proficiency_pct) || 0));
      if (typeof patch.skill_name === 'string') patch.skill_name = patch.skill_name.trim().slice(0, 80);

      // Save to Supabase (with fallback if schema lacks decision columns)
      let { data, error } = await supabase.from('student_skills').update(patch).eq('id', b.id).select().single();
      if (error && (error.message.includes('verification_decision') || error.message.includes('verified_by') || error.message.includes('decision_timestamp') || error.message.includes('teacher_remark'))) {
        const fallbackPatch = { ...patch };
        delete fallbackPatch.verification_decision;
        delete fallbackPatch.verified_by;
        delete fallbackPatch.decision_timestamp;
        delete fallbackPatch.teacher_remark;
        const res2 = await supabase.from('student_skills').update(fallbackPatch).eq('id', b.id).select().single();
        data = res2.data;
        error = res2.error;
      }
      if (data) {
        if (patch.verification_decision && !data.verification_decision) {
          data.verification_decision = patch.verification_decision;
          data.verified_by = patch.verified_by;
          data.decision_timestamp = patch.decision_timestamp;
          data.teacher_remark = patch.teacher_remark;
        }
      }
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const auth = await requireRole(req, res, ['student']);
      if (!auth) return;
      const b = req.body || {};
      if (!b.id) return res.status(400).json({ error: 'id is required' });
      const { data: existing } = await supabase.from('student_skills').select('student_id').eq('id', b.id).single();
      if (!existing) return res.status(404).json({ error: 'Skill not found.' });
      if (!(await ownsStudent(auth, existing.student_id))) {
        return res.status(403).json({ error: 'You can only remove your own skills.' });
      }
      const { error } = await supabase.from('student_skills').delete().eq('id', b.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('student-skills API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
