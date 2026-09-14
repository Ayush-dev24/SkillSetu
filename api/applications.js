import supabase from './db-client.js';
import { requireUser, requireRole, getProfile } from './auth-helpers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { student_id, opportunity_id, mine } = req.query;
      const token = req.headers.authorization?.replace('Bearer ', '');
      let actor = null;
      if (token) {
        const { data } = await supabase.auth.getUser(token);
        actor = data?.user ?? null;
      }
      const actorProfile = actor ? await getProfile(actor.id) : null;
      const actorRole = actorProfile?.role || actor?.user_metadata?.role || null;

      let q = supabase.from('applications').select('*').order('applied_at', { ascending: false });
      if (student_id) q = q.eq('student_id', student_id);
      if (opportunity_id) q = q.eq('opportunity_id', opportunity_id);

      // Privacy: a signed-in student asking for their own list gets only
      // their own rows; anonymous callers must scope by student_id or
      // opportunity_id so the whole table is never dumped.
      if (mine === '1' || mine === 'true') {
        if (!actor) return res.status(401).json({ error: 'Sign in required.' });
        // Resolve the caller's linked demo-student row (or none).
        const sid = actorProfile?.student_id ?? null;
        if (sid == null) return res.status(200).json([]);
        q = q.eq('student_id', sid);
      } else if (!student_id && !opportunity_id) {
        if (!actor) return res.status(400).json({ error: 'Pass student_id or opportunity_id.' });
        if (actorRole === 'student') {
          const sid = actorProfile?.student_id ?? null;
          if (sid == null) return res.status(200).json([]);
          q = q.eq('student_id', sid);
        }
        // company/college/ministry with a token may list for pipelines.
      }
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      // Only signed-in students can apply, and only for themselves.
      const auth = await requireRole(req, res, ['student']);
      if (!auth) return;
      const b = req.body || {};
      if (b.student_id == null || b.opportunity_id == null) {
        return res.status(400).json({ error: 'student_id and opportunity_id are required' });
      }
      const studentId = Number(b.student_id);
      const oppId = Number(b.opportunity_id);
      if (!Number.isFinite(studentId) || !Number.isFinite(oppId)) {
        return res.status(400).json({ error: 'Invalid student or opportunity.' });
      }
      // A student may only apply as themselves: either their linked
      // profile row, or — for legacy demo rows — any student row is allowed
      // but the request must still come from an authenticated student.
      const profile = auth.profile;
      if (profile?.student_id != null && Number(profile.student_id) !== studentId) {
        return res.status(403).json({ error: 'You can only apply as yourself.' });
      }
      const { data: opp, error: oppErr } = await supabase.from('opportunities').select('id,status').eq('id', oppId).single();
      if (oppErr || !opp) return res.status(404).json({ error: 'Opportunity not found.' });
      if (opp.status !== 'open') return res.status(400).json({ error: 'This opportunity is no longer open.' });

      const { data: existing } = await supabase.from('applications').select('id').eq('student_id', studentId).eq('opportunity_id', oppId).limit(1);
      if (existing && existing.length > 0) return res.status(409).json({ error: 'Already applied to this opportunity' });
      const row = {
        student_id: studentId,
        opportunity_id: oppId,
        status: 'applied',
        match_score: Math.max(0, Math.min(100, Number(b.match_score ?? 60))),
        cover_note: String(b.cover_note || '').slice(0, 1000),
      };
      const { data, error } = await supabase.from('applications').insert(row).select().single();
      if (error) throw error;
      try {
        const { data: full } = await supabase.from('opportunities').select('applicants_count').eq('id', oppId).single();
        await supabase.from('opportunities').update({ applicants_count: (full?.applicants_count ?? 0) + 1 }).eq('id', oppId);
      } catch {}
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      // Status changes are a company/college action, never student self-serve.
      const auth = await requireRole(req, res, ['company', 'college', 'ministry']);
      if (!auth) return;
      const b = req.body || {};
      if (!b.id) return res.status(400).json({ error: 'id is required' });
      const allowed = ['status', 'match_score', 'cover_note'];
      const patch = {};
      for (const k of allowed) if (b[k] !== undefined) patch[k] = b[k];
      if (patch.status && !['applied', 'shortlisted', 'hired', 'rejected'].includes(patch.status)) {
        return res.status(400).json({ error: 'Invalid status.' });
      }
      const { data, error } = await supabase.from('applications').update(patch).eq('id', b.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('applications API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
