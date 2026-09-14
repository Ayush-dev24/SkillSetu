import supabase from './db-client.js';
import { requireRole } from './auth-helpers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { student_id, code } = req.query;
      let q = supabase.from('certificates').select('*').order('id', { ascending: false });
      if (student_id) q = q.eq('student_id', student_id);
      if (code) q = q.eq('cert_code', String(code).toUpperCase());
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      // Certificates are issued by companies, never self-minted.
      const auth = await requireRole(req, res, ['company']);
      if (!auth) return;
      const b = req.body || {};
      if (b.student_id == null || b.opportunity_id == null) {
        return res.status(400).json({ error: 'student_id and opportunity_id are required' });
      }
      const { data: st } = await supabase.from('students').select('name').eq('id', b.student_id).single();
      const { data: opp } = await supabase.from('opportunities').select('title,skills_required,company_id').eq('id', b.opportunity_id).single();
      if (!opp) return res.status(404).json({ error: 'Opportunity not found.' });
      if (auth.profile?.company_id != null && Number(opp.company_id) !== Number(auth.profile.company_id)) {
        return res.status(403).json({ error: 'You can only issue certificates for your own postings.' });
      }
      let companyName = 'Partner company';
      if (opp?.company_id) {
        const { data: co } = await supabase.from('companies').select('name').eq('id', opp.company_id).single();
        if (co?.name) companyName = co.name;
      }
      const code = `SB-2026-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const row = {
        cert_code: code,
        student_id: Number(b.student_id),
        student_name: st?.name ?? `Student #${b.student_id}`,
        opportunity_id: Number(b.opportunity_id),
        opportunity_title: opp?.title ?? 'Industry task',
        company_name: companyName,
        rating: Math.max(1, Math.min(5, Number(b.rating ?? 4.5) || 4.5)),
        feedback: String(b.feedback || 'Verified completion of an industry task via SkillSetu.').slice(0, 1000),
        skills_validated: Array.isArray(b.skills_validated) ? b.skills_validated : (opp?.skills_required ?? []),
        issued_at: String(b.issued_at || 'Sep 2026').slice(0, 40),
      };
      const { data, error } = await supabase.from('certificates').insert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('certificates API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
