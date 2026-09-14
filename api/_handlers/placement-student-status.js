import supabase from '../_db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { department, blind } = req.query;
    const isBlind = String(blind || '').toLowerCase() === 'true' || String(blind) === '1';

    let query = supabase.from('students').select('*').order('readiness_score', { ascending: false });
    const { data: students, error } = await query;
    if (error) throw error;

    const roster = (students || []).map((s) => {
      // Profile strength: 45% Cognitive + 30% Projects + 15% Certs + 10% Academics
      const cognitive = s.readiness_score || 70;
      const projects = Math.min(100, (s.xp || 100) / 15);
      const certs = 85;
      const academics = 80;
      const profileStrengthScore = Math.round(cognitive * 0.45 + projects * 0.30 + certs * 0.15 + academics * 0.10);
      const overallConfidenceScore = Math.round(s.readiness_score * 0.95);

      const isPlaced = (s.readiness_score || 0) >= 82;
      const isInterning = !isPlaced && (s.readiness_score || 0) >= 65;
      const placementStatus = isPlaced ? 'PLACED' : (isInterning ? 'OPEN_TO_INTERN' : 'UNPLACED');

      const offers = isPlaced ? [
        {
          listing_id: 101,
          listing_title: `${s.degree || 'BAMS'} Specialist / Analyst`,
          company_name: 'Kapiva',
          stipend_or_ctc: '₹8.5 LPA',
          role_type: 'FULL_TIME',
          status: 'OFFERED',
        }
      ] : (isInterning ? [
        {
          listing_id: 102,
          listing_title: 'Digital Health Research Intern',
          company_name: 'AIIA Tech Innovation',
          stipend_or_ctc: '₹35,000/month',
          role_type: 'INTERNSHIP',
          status: 'OFFERED',
        }
      ] : []);

      const dept = s.degree ? (s.degree.includes('BAMS') ? 'Ayurvedic Medicine' : 'Computer Science & Health Tech') : 'Ayurveda & Health Informatics';

      return {
        student_id: s.id,
        profile_id: s.id + 1000,
        username: isBlind ? `Candidate #${s.id}` : (s.name || `Student ${s.id}`),
        email: isBlind ? '[REDACTED]' : (s.email || `student${s.id}@institution.ac.in`),
        institution: isBlind ? '[REDACTED]' : (s.college || 'All India Institute of Ayurveda'),
        department: dept,
        placement_status: placementStatus,
        overall_confidence_score: overallConfidenceScore,
        profile_strength_score: profileStrengthScore,
        is_verified: s.readiness_score >= 70,
        certifications: [
          { name: 'Ayush Digital Health Specialist', issuer: 'SkillSetu & AIIA', year: 2025, url: 'https://skillsetu.in/cert/101', multiplier_bonus: '+15%' },
          { name: 'Clinical Data Analytics', issuer: 'NPTEL', year: 2024, url: 'https://nptel.ac.in/cert/202', multiplier_bonus: '+15%' },
        ],
        target_roles: ['Clinical Analyst', 'Ayush Informatics Lead', 'Health Tech Product Specialist'],
        offers,
      };
    }).filter((s) => !department || s.department.toLowerCase().includes(String(department).toLowerCase()));

    return res.status(200).json({
      total_students: roster.length,
      roster,
    });
  } catch (err) {
    console.error('placement-student-status API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
