import supabase from '../db-client.js';
import { requireRole } from '../auth-helpers.js';

const STUDENT_STAGES = new Set(['accepted', 'submitted']);
const COMPANY_STAGES = new Set(['accepted', 'submitted', 'approved', 'rejected']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { student_id, opportunity_id, application_id, mine } = req.query;
      // Workspace contents are private to the parties involved: students see
      // only their own, companies/colleges see what they need for review.
      const token = req.headers.authorization?.replace('Bearer ', '');
      let actorRole = null;
      let actorStudentId = null;
      if (token) {
        const { data } = await supabase.auth.getUser(token);
        if (data?.user) {
          actorRole = data.user.user_metadata?.role || null;
          const { data: prof } = await supabase.from('profiles').select('*').eq('user_id', data.user.id).limit(1);
          if (prof && prof.length > 0) {
            actorRole = prof[0].role || actorRole;
            actorStudentId = prof[0].student_id;
          }
        }
      }
      let q = supabase.from('task_workspaces').select('*').order('updated_at', { ascending: false });
      if (student_id) q = q.eq('student_id', student_id);
      if (opportunity_id) q = q.eq('opportunity_id', opportunity_id);
      if (application_id) q = q.eq('application_id', application_id);
      if (mine === '1' || mine === 'true') {
        if (!token) return res.status(401).json({ error: 'Sign in required.' });
        if (actorRole === 'student') {
          if (actorStudentId == null) return res.status(200).json([]);
          q = q.eq('student_id', actorStudentId);
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      if (actorRole === 'student' && actorStudentId != null) {
        return res.status(200).json((data || []).filter((w) => Number(w.student_id) === Number(actorStudentId)));
      }
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const auth = await requireRole(req, res, ['student']);
      if (!auth) return;
      const b = req.body || {};
      if (b.student_id == null || b.opportunity_id == null) {
        return res.status(400).json({ error: 'student_id and opportunity_id are required' });
      }
      if (auth.profile?.student_id != null && Number(b.student_id) !== Number(auth.profile.student_id)) {
        return res.status(403).json({ error: 'You can only open workspaces for yourself.' });
      }
      const { data: existing } = await supabase.from('task_workspaces').select('id').eq('student_id', b.student_id).eq('opportunity_id', b.opportunity_id).limit(1);
      if (existing && existing.length > 0) {
        const { data, error } = await supabase.from('task_workspaces').select('*').eq('id', existing[0].id).single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      const row = {
        application_id: b.application_id ? Number(b.application_id) : null,
        student_id: Number(b.student_id),
        opportunity_id: Number(b.opportunity_id),
        stage: 'accepted',
        file_name: String(b.file_name || '').slice(0, 200),
        notes: String(b.notes || '').slice(0, 2000),
        rating: null,
        feedback: '',
      };
      const { data, error } = await supabase.from('task_workspaces').insert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return res.status(400).json({ error: 'id is required' });
      const { data: existing } = await supabase.from('task_workspaces').select('student_id').eq('id', b.id).single();
      if (!existing) return res.status(404).json({ error: 'Workspace not found.' });
      const wantsReview = b.stage === 'approved' || b.stage === 'rejected' || b.rating != null || b.feedback;
      const auth = wantsReview
        ? await requireRole(req, res, ['company'])
        : await requireRole(req, res, ['student']);
      if (!auth) return;
      if (!wantsReview && auth.profile?.student_id != null && Number(existing.student_id) !== Number(auth.profile.student_id)) {
        return res.status(403).json({ error: 'You can only update your own workspace.' });
      }
      const allowed = wantsReview
        ? ['stage', 'rating', 'feedback']
        : ['stage', 'file_name', 'notes'];
      const patch = {};
      for (const k of allowed) if (b[k] !== undefined) patch[k] = b[k];
      if (patch.stage && !(wantsReview ? COMPANY_STAGES : STUDENT_STAGES).has(patch.stage)) {
        return res.status(400).json({ error: 'Invalid stage.' });
      }
      if (patch.rating != null) patch.rating = Math.max(1, Math.min(5, Number(patch.rating) || 3));
      if (typeof patch.file_name === 'string') {
        if (patch.file_name.length > 200) return res.status(400).json({ error: 'File name too long' });
        if (/[<>]/.test(patch.file_name)) return res.status(400).json({ error: 'Invalid file name.' });
      }
      if (typeof patch.notes === 'string') patch.notes = patch.notes.slice(0, 2000);
      if (typeof patch.feedback === 'string') patch.feedback = patch.feedback.slice(0, 2000);
      // application_id linkage is set at creation and immutable afterwards.
      const { data, error } = await supabase.from('task_workspaces').update(patch).eq('id', b.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('task-workspaces API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
