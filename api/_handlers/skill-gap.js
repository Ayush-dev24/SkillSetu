import supabase from '../_db-client.js';

function levelOf(pct) { return Math.max(1, Math.min(5, Math.round((pct || 0) / 20) || 1)); }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const [{ data: students }, { data: companies }, { data: opps }, { data: apps }] = await Promise.all([
        supabase.from('students').select('id,readiness_score,college'),
        supabase.from('companies').select('id'),
        supabase.from('opportunities').select('id,urgency,type,status'),
        supabase.from('applications').select('id,status'),
      ]);
      const avg = students?.length ? Math.round(students.reduce((s, x) => s + (x.readiness_score || 0), 0) / students.length) : 0;
      const colleges = {};
      (students || []).forEach((s) => { colleges[s.college] = (colleges[s.college] || 0) + 1; });
      return res.status(200).json({
        students: students?.length ?? 0,
        companies: companies?.length ?? 0,
        opportunities: opps?.length ?? 0,
        instant_count: (opps || []).filter((o) => o.urgency === 'instant' && o.status === 'open').length,
        open_count: (opps || []).filter((o) => o.status === 'open').length,
        applications: apps?.length ?? 0,
        avg_readiness: avg,
        colleges: Object.entries(colleges).map(([name, count]) => ({ name, count })),
      });
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      const { student_id, career_id } = b;
      if (!student_id || !career_id) return res.status(400).json({ error: 'student_id and career_id are required' });
      const [{ data: skills }, { data: career }, { data: courses }, { data: opps }] = await Promise.all([
        supabase.from('student_skills').select('*').eq('student_id', student_id),
        supabase.from('careers').select('*').eq('id', career_id).single(),
        supabase.from('courses').select('*'),
        supabase.from('opportunities').select('*').eq('status', 'open'),
      ]);
      if (!career) return res.status(404).json({ error: 'Career not found' });
      const byName = {};
      (skills || []).forEach((s) => { byName[s.skill_name.toLowerCase()] = s; });
      const required = career.required_skills || [];
      let wsum = 0, wgot = 0;
      const breakdown = required.map((r) => {
        const mine = byName[String(r.skill).toLowerCase()];
        const cur = mine ? levelOf(mine.proficiency_pct) : 0;
        const ratio = r.level ? Math.min(cur / r.level, 1) : 1;
        wsum += (r.weight || 1); wgot += (r.weight || 1) * ratio;
        return { skill: r.skill, required_level: r.level, current_level: cur, weight: r.weight || 1, verified: mine?.verified || false, gap: Math.max(0, (r.level || 3) - cur) };
      });
      const score = wsum ? Math.round((wgot / wsum) * 100) : 0;
      const missing = breakdown.filter((x) => x.gap > 0).sort((a, b) => (b.weight * b.gap) - (a.weight * a.gap));
      const hours = missing.reduce((s, m) => s + m.gap * 9, 0);
      const missingNames = missing.map((m) => m.skill.toLowerCase());
      const recCourses = (courses || []).map((c) => {
        const cov = (c.skills_covered || []).map((s) => String(s).toLowerCase());
        const hits = cov.filter((s) => missingNames.some((m) => m.includes(s) || s.includes(m)));
        return { ...c, hits: hits.length };
      }).filter((c) => c.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 4);
      const recOpps = (opps || []).map((o) => {
        const reqSkills = (o.skills_required || []).map((s) => String(s).toLowerCase());
        const have = reqSkills.filter((s) => byName[s]);
        return { ...o, overlap: reqSkills.length ? have.length / reqSkills.length : 0 };
      }).sort((a, b) => b.overlap - a.overlap).slice(0, 4);
      return res.status(200).json({ score, breakdown, missing, estimated_hours: hours, estimated_weeks: Math.max(1, Math.ceil(hours / 6)), recommended_courses: recCourses, recommended_opportunities: recOpps });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('skill-gap API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
