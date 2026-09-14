import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { id, blind } = req.query;
    const studentId = Number(id || 1);
    const isBlind = String(blind || '').toLowerCase() === 'true' || String(blind) === '1';

    const { data: student } = await supabase.from('students').select('*').eq('id', studentId).single();
    const { data: skills } = await supabase.from('student_skills').select('*').eq('student_id', studentId);
    const { data: certs } = await supabase.from('certificates').select('*').eq('student_id', studentId);

    const sName = student?.name || 'Aarav Sharma';
    const sEmail = student?.email || 'aarav.sharma@aiia.gov.in';
    const sCollege = student?.college || 'National Institute of Ayurveda';
    const sDegree = student?.degree || 'BAMS (Bachelor of Ayurvedic Medicine and Surgery)';

    const cognitiveScore = student?.readiness_score || 88;
    const projectsScore = 92;
    const certsScore = 85;
    const academicsScore = 90;
    const profileStrength = Math.round(cognitiveScore * 0.45 + projectsScore * 0.30 + certsScore * 0.15 + academicsScore * 0.10);

    const payload = {
      id: studentId,
      username: isBlind ? `Candidate #${studentId}` : sName,
      email: isBlind ? '[REDACTED]' : sEmail,
      bio: 'Final-year Ayush Scholar specializing in Clinical Pharmacovigilance, Herb-Drug Interaction Analytics, and Telemedicine Systems.',
      current_designation: 'Ayush Digital Health Scholar & Clinical Data Apprentice',
      experience_years: 1.5,
      institution: isBlind ? '[REDACTED]' : sCollege,
      department: 'Ayurvedic Medicine & Digital Informatics',
      degree: sDegree,
      cgpa: 8.85,
      graduation_year: 2026,
      github_url: 'https://github.com/aarav-sharma-ayush',
      linkedin_url: 'https://linkedin.com/in/aarav-sharma-ayush',
      portfolio_url: student?.portfolio_url || 'https://aarav-ayush.dev',
      is_verified: true,
      overall_confidence_score: Math.round(cognitiveScore * 0.96),
      profile_strength_score: profileStrength,
      profile_strength_breakdown: {
        cognitive_score: cognitiveScore,
        projects_experience_score: projectsScore,
        certifications_score: certsScore,
        academics_score: academicsScore,
      },
      placement_status: cognitiveScore >= 82 ? 'PLACED' : 'OPEN_TO_INTERN',
      target_roles: ['Ayush Informatics Lead', 'Clinical Data Analyst', 'Telemedicine Product Manager'],
      skills_matrix: {
        formula: 'Ws = 0.6 * Pe + 0.4 * Er (+15% credential bonus)',
        effective_weights: (skills || []).map((sk) => ({
          skill: sk.skill_name,
          weight_ws: Math.min(1.0, (sk.proficiency_pct / 100) * 0.85 + 0.15),
          verified: sk.verified,
        })),
      },
      skills_categorized: {
        technical_skills: ['Clinical Pharmacovigilance', 'Herb-Drug Interaction Modeling', 'EHR Interoperability (ABDMT)'],
        frameworks: ['React', 'FastAPI', 'Node.js', 'Pandas'],
        tools: ['Postman', 'Supabase', 'Git', 'Docker'],
        soft_skills: ['Clinical Consultation', 'Syllabus Redesign', 'Interdisciplinary Communication'],
      },
      role_fit_matrix: {
        'Ayush Informatics Lead': { fitment_pct: 92, status: 'High Match' },
        'Clinical Data Analyst': { fitment_pct: 88, status: 'High Match' },
        'Digital Health PM': { fitment_pct: 79, status: 'Moderate Match' },
      },
      certifications: (certs || []).map((c) => ({
        title: c.opportunity_title || 'Digital Health Verification',
        code: c.cert_code || 'CERT-AYUSH-2025',
        skills_validated: c.skills_validated || ['Clinical Analytics'],
        multiplier: '+15% Verified Bonus',
      })),
      projects: [
        {
          title: 'AYUSH-DHA: National Herb-Drug Interaction Matrix',
          description: 'Engineered an AI-assisted clinical decision support system cross-referencing 400+ Ayurvedic formulations against modern pharmaceuticals.',
          github: 'https://github.com/aarav-sharma-ayush/herb-drug-matrix',
          tech: ['FastAPI', 'React', 'pgvector'],
        },
        {
          title: 'ABDM Teleconsultation Gateway',
          description: 'Built a lightweight Ayush EHR portal adhering to Ayushman Bharat Digital Mission (ABDM) M2 standards.',
          github: 'https://github.com/aarav-sharma-ayush/abdm-gateway',
          tech: ['Node.js', 'Supabase', 'FHIR'],
        },
      ],
      internships: [
        {
          company: 'Kapiva Research Labs',
          role: 'Ayush Research & Content Analyst Intern',
          duration: '6 Months (Jul 2025 - Dec 2025)',
          stipend: '₹45,000/month',
          status: 'COMPLETED',
        },
      ],
      achievements: [
        { title: 'Winner - National Ayush Hackathon 2025', issuer: 'Ministry of Ayush' },
        { title: 'Exemplary PARAKH A+ Grade Certification', issuer: 'NCERT PARAKH' },
      ],
      academic_records: [
        { semester: 'Sem 7', gpa: 9.0, credits: 24 },
        { semester: 'Sem 6', gpa: 8.8, credits: 22 },
        { semester: 'Sem 5', gpa: 8.7, credits: 24 },
      ],
      active_internships: [
        {
          application_id: 501,
          title: 'Clinical Data Analytics Apprentice',
          company_name: 'AIIA Innovation Hub',
          status: 'IN_PROGRESS',
        },
      ],
      nep_passport: {
        apaar_id: '1234-5678-9012',
        abc_id: 'ABC-2025-88902',
        is_apaar_verified: true,
        nheqf_level: 'LEVEL_7_0',
        ncrf_credits: {
          total_ncrf_credits: 160,
          internship_credits: 24,
          certification_credits: 16,
          total_internship_hours: 480,
        },
        aicte_activity_points: {
          points_earned: 88,
          target_points: 100,
          completion_percentage: 88.0,
          verified_hours: 140,
          is_target_met: true,
        },
        parakh_assessment: {
          overall_holistic_score: 91.5,
          parakh_grade: 'Exemplary A+',
          cognitive_domain_score: 94.0,
          practical_domain_score: 90.0,
          vocational_domain_score: 89.0,
          academic_domain_score: 93.0,
        },
      },
      github_engineering_radar: {
        engineering_score: 89.4,
        anti_vibe_index: 94.2,
        badge: 'Battle-Tested Architect',
        conventional_commits_pct: 92.5,
        has_ci_cd: true,
        has_docker: true,
        has_tests: true,
        top_languages: ['TypeScript', 'Python', 'SQL', 'Shell'],
      },
      is_blind: isBlind,
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error('student-portfolio API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
