// Profile preferences for the in-house matching engine.
// ---------------------------------------------------------------------------
// GET /api/profile-prefs           → { prefs } for the signed-in student
// PUT /api/profile-prefs           → upsert { preferred_roles, preferred_locations,
//                                     preferred_work_modes, max_experience_years }
//
// These are the ONLY fields that shape matching beyond the skill map. They are
// stored per-student (profile_prefs table) and consumed by /api/career-match.

import { requireRole } from './auth-helpers.js';
import supabase from './db-client.js';

const LISTS = ['preferred_roles', 'preferred_locations', 'preferred_work_modes'];
const WORK_MODES = new Set(['REMOTE', 'HYBRID', 'ON_SITE']);

function cleanList(v, max = 8) {
  if (!Array.isArray(v)) return null;
  const out = [];
  for (const item of v) {
    const s = String(item).trim().slice(0, 120);
    if (s && out.length < max && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out;
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const auth = await requireRole(req, res, ['student']);
    if (!auth) return;

    const studentId = await resolveStudentId(auth, auth.user);
    if (studentId == null) return res.status(400).json({ error: 'No linked student profile.' });

    if (req.method === 'GET') {
      const { data } = await supabase.from('profile_prefs').select('*').eq('student_id', studentId).limit(1);
      const prefs = data && data.length > 0 ? data[0] : null;
      return res.status(200).json({
        prefs: prefs
          ? {
              student_id: prefs.student_id,
              preferred_roles: prefs.preferred_roles || [],
              preferred_locations: prefs.preferred_locations || [],
              preferred_work_modes: prefs.preferred_work_modes || [],
              max_experience_years: Number(prefs.max_experience_years) || 0,
              updated_at: prefs.updated_at,
            }
          : null,
      });
    }

    if (req.method === 'PUT') {
      const b = req.body || {};
      const row = { student_id: studentId, updated_at: new Date().toISOString() };

      if (b.preferred_roles !== undefined) row.preferred_roles = cleanList(b.preferred_roles) || [];
      if (b.preferred_locations !== undefined) row.preferred_locations = cleanList(b.preferred_locations) || [];
      if (b.preferred_work_modes !== undefined) {
        const modes = cleanList(b.preferred_work_modes, 3) || [];
        row.preferred_work_modes = modes.filter((m) => WORK_MODES.has(String(m).toUpperCase()));
      }
      if (b.max_experience_years !== undefined) {
        const n = Number(b.max_experience_years);
        row.max_experience_years = Number.isFinite(n) ? Math.max(0, Math.min(30, Math.round(n))) : 0;
      }

      // Some field must change.
      const hasAny = ['preferred_roles', 'preferred_locations', 'preferred_work_modes', 'max_experience_years']
        .some((k) => row[k] !== undefined);
      if (!hasAny) return res.status(400).json({ error: 'Nothing to update.' });

      const { data, error } = await supabase.from('profile_prefs').upsert(row, { onConflict: 'student_id' }).select().single();
      if (error) throw error;
      return res.status(200).json({
        ok: true,
        prefs: {
          student_id: data.student_id,
          preferred_roles: data.preferred_roles || [],
          preferred_locations: data.preferred_locations || [],
          preferred_work_modes: data.preferred_work_modes || [],
          max_experience_years: Number(data.max_experience_years) || 0,
          updated_at: data.updated_at,
        },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('profile-prefs API error:', err);
    return res.status(500).json({ error: err.message });
  }
}