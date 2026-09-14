import supabase from '../db-client.js';
import { requireRole } from '../auth-helpers.js';

const VALID_ROLES = ['student', 'company', 'college', 'ministry'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      // Companies can search students with filters; students can only see their own
      const auth = await requireRole(req, res, ['company', 'college', 'ministry']);
      const isStudent = !auth;
      if (isStudent) {
        const studentAuth = await requireRole(req, res, ['student']);
        if (!studentAuth) return;
      }

      let q = supabase.from('students').select('*');

      if (isStudent && auth?.profile?.student_id != null) {
        q = q.eq('id', auth.profile.student_id);
      }

      if (!isStudent) {
        const { skills, location, min_readiness, max_readiness, college, search, limit, offset } = req.query;
        if (skills) {
          const skillList = String(skills).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
          if (skillList.length > 0) {
            // Filter students who have ANY of these skills
            const { data: skillRows } = await supabase
              .from('student_skills')
              .select('student_id')
              .in('skill_name', skillList);
            const studentIds = [...new Set((skillRows || []).map(r => r.student_id))];
            if (studentIds.length > 0) q = q.in('id', studentIds);
            else return res.status(200).json([]);
          }
        }
        if (location) {
          const loc = String(location).trim();
          q = q.ilike('location', `%${loc}%`);
        }
        if (min_readiness) q = q.gte('readiness_score', Number(min_readiness));
        if (max_readiness) q = q.lte('readiness_score', Number(max_readiness));
        if (college) {
          const col = String(college).trim();
          q = q.ilike('college', `%${col}%`);
        }
        if (search) {
          const s = String(search).trim();
          q = q.or(`name.ilike.%${s}%,headline.ilike.%${s}%,college.ilike.%${s}%`);
        }
        const lim = Math.min(100, Math.max(1, Number(limit) || 50));
        const off = Math.max(0, Number(offset) || 0);
        q = q.order('readiness_score', { ascending: false }).range(off, off + lim - 1);
      }

      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.name || !b.email) return res.status(400).json({ error: 'name and email are required' });
      const row = {
        name: String(b.name).slice(0, 80),
        email: String(b.email).slice(0, 120),
        college: String(b.college || 'All India Institute of Ayurveda').slice(0, 120),
        degree: String(b.degree || 'BAMS').slice(0, 80),
        year: String(b.year || '3rd Year').slice(0, 40),
        location: String(b.location || 'New Delhi').slice(0, 80),
        headline: String(b.headline || 'Aspiring Ayush professional').slice(0, 160),
        avatar_color: String(b.avatar_color || '#0d7a5f').slice(0, 20),
        readiness_score: Number(b.readiness_score ?? 40),
        xp: Number(b.xp ?? 100),
        streak_days: Number(b.streak_days ?? 1),
        level_text: String(b.level_text || 'Explorer').slice(0, 40),
        resume_text: String(b.resume_text || '').slice(0, 8000),
        portfolio_url: String(b.portfolio_url || '').slice(0, 300),
        target_role: String(b.target_role || '').slice(0, 120) || null,
        preferred_locations: String(Array.isArray(b.preferred_locations) ? b.preferred_locations.join(', ') : b.preferred_locations || '').slice(0, 300) || null,
        preferred_work_modes: String(Array.isArray(b.preferred_work_modes) ? b.preferred_work_modes.join(',') : b.preferred_work_modes || '').slice(0, 60) || null,
        max_experience_years: (() => {
          const n = Number(b.max_experience_years);
          return Number.isFinite(n) ? Math.max(0, Math.min(30, Math.round(n))) : 0;
        })(),
        github_url: String(b.github_url || '').slice(0, 300),
        linkedin_url: String(b.linkedin_url || '').slice(0, 300),
      };
      const { data, error } = await supabase.from('students').insert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const auth = await requireRole(req, res, ['student']);
      if (!auth) return;
      const b = req.body || {};
      if (b.id == null) return res.status(400).json({ error: 'id is required' });
      if (auth.profile?.student_id != null && Number(b.id) !== Number(auth.profile.student_id)) {
        return res.status(403).json({ error: 'You can only edit your own profile.' });
      }
      const allowed = ['name','college','degree','year','location','headline','avatar_color','resume_text','portfolio_url','level_text',
        'target_role','preferred_locations','preferred_work_modes','max_experience_years','github_url','linkedin_url'];
      const patch = {};
      for (const k of allowed) {
        if (b[k] === undefined) continue;
        if (k === 'max_experience_years') {
          const n = Number(b[k]);
          patch[k] = Number.isFinite(n) ? Math.max(0, Math.min(30, Math.round(n))) : 0;
          continue;
        }
        if (k === 'preferred_locations' || k === 'preferred_work_modes') {
          patch[k] = String(Array.isArray(b[k]) ? b[k].join(k === 'preferred_locations' ? ', ' : ',') : b[k] || '').slice(0, k === 'preferred_locations' ? 300 : 60) || null;
          continue;
        }
        patch[k] = typeof b[k] === 'string' ? b[k].slice(0, k === 'resume_text' ? 8000 : k === 'portfolio_url' || k === 'github_url' || k === 'linkedin_url' ? 300 : 160) : b[k];
      }
      if (patch.portfolio_url && !/^https?:\/\/.+\..+/.test(patch.portfolio_url) && patch.portfolio_url.trim() !== '') {
        return res.status(400).json({ error: 'Portfolio must be a valid http(s) URL.' });
      }
      const { data, error } = await supabase.from('students').update(patch).eq('id', b.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('students API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
