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
      // Verifying a skill is a company/college/ministry action.
      const wantsVerify = b.verified === true;
      const auth = wantsVerify
        ? await requireRole(req, res, ['company', 'college', 'ministry'])
        : await requireRole(req, res, ['student']);
      if (!auth) return;
      if (!wantsVerify && !(await ownsStudent(auth, existing.student_id))) {
        return res.status(403).json({ error: 'You can only edit your own skills.' });
      }
      const allowed = wantsVerify
        ? ['verified', 'source']
        : ['level', 'proficiency_pct', 'category', 'skill_name', 'state'];
      const patch = {};
      for (const k of allowed) if (b[k] !== undefined) patch[k] = b[k];
      if (patch.level != null) patch.level = Math.max(1, Math.min(5, Number(patch.level) || 3));
      if (patch.proficiency_pct != null) patch.proficiency_pct = Math.max(0, Math.min(100, Number(patch.proficiency_pct) || 0));
      if (typeof patch.skill_name === 'string') patch.skill_name = patch.skill_name.trim().slice(0, 80);
      // The engine's evidence-based state machine drives verification:
      // 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NEEDS_EVIDENCE' | 'UNVERIFIED'.
      // The column may not exist yet — fall back gracefully on schema error.
      if (typeof patch.state === 'string') {
        const st = String(patch.state).toUpperCase();
        if (['VERIFIED', 'PARTIALLY_VERIFIED', 'NEEDS_EVIDENCE', 'UNVERIFIED'].includes(st)) {
          patch.verified = st === 'VERIFIED' || st === 'PARTIALLY_VERIFIED';
          patch.state = st;
        } else delete patch.state;
      }
      let { data, error } = await supabase.from('student_skills').update(patch).eq('id', b.id).select().single();
      if (error && /column.*state/i.test(error.message)) {
        delete patch.state;
        ({ data, error } = await supabase.from('student_skills').update(patch).eq('id', b.id).select().single());
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
