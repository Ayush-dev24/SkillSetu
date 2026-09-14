export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const overviewData = {
      total_students: 450,
      placed_students: 312,
      placement_rate_percentage: 69.33,
      total_companies_onboarded: 48,
      total_applications_submitted: 1280,
      offers_extended: 340,
    };

    const deficitSkills = [
      {
        skill: 'Clinical Pharmacovigilance',
        market_demand_count: 140,
        market_demand_percentage: 85.0,
        student_supply_count: 42,
        student_supply_percentage: 28.0,
        deficit_percentage: 57.0,
        average_student_proficiency: 42.5,
      },
      {
        skill: 'ABDM Health Data Interoperability',
        market_demand_count: 125,
        market_demand_percentage: 78.0,
        student_supply_count: 35,
        student_supply_percentage: 23.3,
        deficit_percentage: 54.7,
        average_student_proficiency: 38.0,
      },
      {
        skill: 'React & Frontend Health UI',
        market_demand_count: 110,
        market_demand_percentage: 72.0,
        student_supply_count: 48,
        student_supply_percentage: 32.0,
        deficit_percentage: 40.0,
        average_student_proficiency: 55.0,
      },
      {
        skill: 'Herb-Drug Interaction Data Science',
        market_demand_count: 95,
        market_demand_percentage: 65.0,
        student_supply_count: 30,
        student_supply_percentage: 20.0,
        deficit_percentage: 45.0,
        average_student_proficiency: 35.0,
      },
    ];

    const facultyRecommendations = [
      'P1: Introduce a compulsory 2-week "Clinical Pharmacovigilance & ABDM Interoperability" sprint for 3rd & 4th-year students.',
      'P2: Partner with Kapiva and AIIA Research Labs to offer 50 micro-internships in Herb-Drug Interaction modeling.',
      'P3: Integrate React & FastAPI health dashboard templates into the Ayush Informatics lab curriculum.',
    ];

    return res.status(200).json({
      overview: overviewData,
      deficit_skills: deficitSkills,
      faculty_recommendations: facultyRecommendations,
    });
  } catch (err) {
    console.error('placement-overview API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
