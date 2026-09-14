import supabase from '../_db-client.js';
import { requireRole } from '../_auth-helpers.js';

const VALID_TYPES = new Set(['internship', 'micro-internship', 'same-day-task', 'part-time', 'full-time', 'challenge']);
const VALID_URGENCY = new Set(['instant', 'soon', 'flexible']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { type, urgency, search, domain, status } = req.query;
      let q = supabase.from('opportunities').select('*').order('id', { ascending: false });
      if (type) q = q.eq('type', type);
      if (urgency) q = q.eq('urgency', urgency);
      if (status) q = q.eq('status', status);
      if (domain) q = q.eq('domain', domain);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data || [];
      if (search) {
        const s = String(search).toLowerCase();
        rows = rows.filter((o) => `${o.title} ${o.description} ${o.domain} ${(o.skills_required || []).join(' ')}`.toLowerCase().includes(s));
      }
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      // Only signed-in companies can publish opportunities.
      const auth = await requireRole(req, res, ['company']);
      if (!auth) return;
      const b = req.body || {};
      if (!b.title || !b.title.trim()) return res.status(400).json({ error: 'A title is required' });
      if (!b.description || !b.description.trim()) return res.status(400).json({ error: 'A task description is required' });
      if (b.company_id != null && auth.profile?.company_id != null && Number(b.company_id) !== Number(auth.profile.company_id)) {
        return res.status(403).json({ error: 'You can only post for your own company.' });
      }
      const type = VALID_TYPES.has(b.type) ? b.type : 'internship';
      const urgency = VALID_URGENCY.has(b.urgency) ? b.urgency : 'flexible';
      const skills = Array.isArray(b.skills_required) ? b.skills_required.map((s) => String(s).slice(0, 60)).slice(0, 12)
        : String(b.skills_required || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
      const openings = Math.max(1, Math.min(500, Number(b.openings ?? 3) || 3));
      const row = {
        title: String(b.title).trim().slice(0, 140),
        company_id: b.company_id != null ? Number(b.company_id) : (auth.profile?.company_id ?? null),
        type,
        domain: String(b.domain || 'Ayush & Wellness').slice(0, 80),
        location: String(b.location || 'Remote').slice(0, 80),
        remote: Boolean(b.remote ?? true),
        stipend: String(b.stipend || 'Unpaid').slice(0, 60),
        stipend_num: Math.max(0, Number(b.stipend_num ?? 0) || 0),
        duration: String(b.duration || '4 weeks').slice(0, 60),
        urgency,
        starts_in: String(b.starts_in || 'Within 2 weeks').slice(0, 60),
        skills_required: skills,
        description: String(b.description).trim().slice(0, 3000),
        openings,
        applicants_count: 0,
        status: 'open',
        posted_at: 'Just now',
        deadline: String(b.deadline || 'Rolling').slice(0, 60),
        color: String(b.color || '#0d7a5f').slice(0, 20),
      };
      if (!row.company_id) return res.status(400).json({ error: 'Your account is not linked to a company yet.' });
      const { data: co } = await supabase.from('companies').select('id').eq('id', row.company_id).single();
      if (!co) return res.status(400).json({ error: 'Unknown company.' });
      const { data, error } = await supabase.from('opportunities').insert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      // Only signed-in companies may edit/close their own postings.
      // applicants_count is server-managed (see applications API).
      const auth = await requireRole(req, res, ['company']);
      if (!auth) return;
      const b = req.body || {};
      if (!b.id) return res.status(400).json({ error: 'id is required' });
      const { data: existing } = await supabase.from('opportunities').select('company_id').eq('id', b.id).single();
      if (!existing) return res.status(404).json({ error: 'Opportunity not found.' });
      if (auth.profile?.company_id != null && Number(existing.company_id) !== Number(auth.profile.company_id)) {
        return res.status(403).json({ error: 'You can only edit your own postings.' });
      }
      const allowed = ['title','type','domain','location','remote','stipend','stipend_num','duration','urgency','starts_in','skills_required','description','openings','status','deadline'];
      const patch = {};
      for (const k of allowed) {
        if (b[k] === undefined) continue;
        if (k === 'type' && !VALID_TYPES.has(b[k])) continue;
        if (k === 'urgency' && !VALID_URGENCY.has(b[k])) continue;
        if (k === 'status' && !['open', 'closed', 'paused'].includes(b[k])) continue;
        patch[k] = b[k];
      }
      if (patch.title != null && !String(patch.title).trim()) return res.status(400).json({ error: 'Title cannot be empty.' });
      const { data, error } = await supabase.from('opportunities').update(patch).eq('id', b.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('opportunities API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
