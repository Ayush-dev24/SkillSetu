export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const activeInternships = [
      {
        application_id: 501,
        listing_id: 101,
        title: 'Clinical Pharmacovigilance & Data Analyst',
        company_name: 'Kapiva',
        company_logo: 'https://kapiva.in/favicon.ico',
        location: 'Mumbai, MH (Hybrid)',
        stipend_or_ctc: '₹45,000/month',
        role_type: 'INTERNSHIP',
        internship_status: 'IN_PROGRESS',
        mentor_name: 'Dr. Priya Nambiar',
        mentor_designation: 'Head of Clinical Research',
        mentor_feedback: 'Demonstrates exceptional diligence in herb-drug interaction modeling and ABDM compliance.',
        mentor_rating: 4.9,
        completion_certificate_url: 'https://skillsetu.in/certificates/INT-2025-501',
        internship_report_url: 'https://skillsetu.in/reports/INT-2025-501.pdf',
        weekly_progress_logs: [
          {
            week_number: 4,
            summary: 'Completed data schema mapping for 120 Ayurvedic herbal formulations against US FDA adverse reaction database.',
            hours_worked: 40,
            deliverables_url: 'https://github.com/aarav-sharma-ayush/herb-drug-matrix/pull/14',
            submitted_at: '2026-03-01T17:00:00Z',
            verified_by_faculty: true,
          },
          {
            week_number: 3,
            summary: 'Integrated Supabase PGVector similarity search for fast clinical query lookup.',
            hours_worked: 38,
            deliverables_url: 'https://github.com/aarav-sharma-ayush/herb-drug-matrix/pull/11',
            submitted_at: '2026-02-22T17:00:00Z',
            verified_by_faculty: true,
          },
          {
            week_number: 2,
            summary: 'Onboarded onto Kapiva R&D data pipeline and finalized project scope with mentor.',
            hours_worked: 42,
            deliverables_url: 'https://github.com/aarav-sharma-ayush/herb-drug-matrix/pull/5',
            submitted_at: '2026-02-15T17:00:00Z',
            verified_by_faculty: true,
          },
          {
            week_number: 1,
            summary: 'Security & ABDM compliance orientation; repository setup.',
            hours_worked: 35,
            deliverables_url: 'https://github.com/aarav-sharma-ayush/herb-drug-matrix/pull/1',
            submitted_at: '2026-02-08T17:00:00Z',
            verified_by_faculty: true,
          },
        ],
      },
    ];

    return res.status(200).json(activeInternships);
  } catch (err) {
    console.error('student-internships-active API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
