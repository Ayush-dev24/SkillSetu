import supabase from '../db-client.js';
import { VALID_ROLES } from '../auth-helpers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { user_id, student_id } = req.query;
      let q = supabase.from('profiles').select('*');
      if (user_id) q = q.eq('user_id', user_id);
      if (student_id) q = q.eq('student_id', student_id);
      const { data, error } = await q.limit(20);
      if (error) throw error;
      // Never leak internal linkage beyond what the client needs
      return res.status(200).json((data || []).map((p) => ({
        user_id: p.user_id,
        email: p.email,
        role: p.role,
        display_name: p.display_name,
        student_id: p.student_id,
        company_id: p.company_id,
        college: p.college,
        created_at: p.created_at,
      })));
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.user_id || !b.email) return res.status(400).json({ error: 'user_id and email are required' });
      const email = String(b.email).trim().toLowerCase().slice(0, 160);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
      const role = VALID_ROLES.has(b.role) ? b.role : 'student';
      const row = {
        user_id: String(b.user_id).slice(0, 80),
        email,
        role,
        display_name: String(b.display_name || email.split('@')[0]).slice(0, 120),
        student_id: b.student_id != null ? Number(b.student_id) : null,
        company_id: b.company_id != null ? Number(b.company_id) : null,
        college: String(b.college || '').slice(0, 160) || null,
      };
      const { data, error } = await supabase.from('profiles').upsert(row, { onConflict: 'user_id' }).select().single();
      if (error) throw error;
      return res.status(201).json({ ok: true, profile: row, id: data?.id });
    }
    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.user_id) return res.status(400).json({ error: 'user_id is required' });
      const allowed = ['display_name', 'student_id', 'company_id', 'college', 'role', 'email'];
      const patch = {};
      for (const k of allowed) {
        if (b[k] === undefined) continue;
        if (k === 'role' && !VALID_ROLES.has(b[k])) continue;
        if (k === 'email') {
          const e = String(b[k]).trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) continue;
          patch[k] = e;
        } else if (typeof b[k] === 'string') {
          patch[k] = b[k].slice(0, 160);
        } else {
          patch[k] = Number(b[k]);
        }
      }
      const { data, error } = await supabase.from('profiles').update(patch).eq('user_id', b.user_id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('profiles API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
