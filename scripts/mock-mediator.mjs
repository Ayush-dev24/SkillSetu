// Local mock of the mediator used ONLY for integration verification.
// Simulates /api/health and /api/match with a realistic response payload.
import http from 'node:http';

const PORT = 8123;

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (url.pathname === '/api/health' && req.method === 'GET') {
      return json(res, 200, { status: 'ok', service: 'skillsetu-mediator', version: '1.0.0-staging' });
    }
    if (url.pathname === '/api/match' && req.method === 'POST') {
      let payload = {};
      try { payload = JSON.parse(body); } catch {}
      // Echo the received x-api-key so the test can assert auth-ready behavior.
      const seenKey = req.headers['x-api-key'] || null;
      return json(res, 200, {
        user_id: payload.user_id || 'unknown',
        profile_summary: { name: payload.name || '', target_role: 'Machine Learning Engineer' },
        skill_verification: [
          { skill: 'Python', state: 'VERIFIED', confidence: 93, explanation: 'Evidence: AI internship certificate from Acme.' },
          { skill: 'SQL', state: 'VERIFIED', confidence: 88, explanation: 'Evidence: course completion + project.' },
          { skill: 'Machine Learning', state: 'PARTIALLY_VERIFIED', confidence: 55 },
          { skill: 'TensorFlow', state: 'NEEDS_EVIDENCE', confidence: 20 },
        ],
        recommendations: [
          {
            job_id: 'job-101',
            title: 'Machine Learning Engineer',
            company: 'Acme Analytics',
            location: 'Bengaluru',
            match_score: 91,
            verified: true,
            matched_skills: ['Python', 'SQL', 'Machine Learning'],
            verified_skills: ['Python', 'SQL'],
            partially_verified_skills: ['Machine Learning'],
            missing_skills: ['TensorFlow'],
            why_matches: 'Strong overlap with your verified Python and SQL skills plus relevant internship evidence.',
            blockers: ['1+ year experience preferred'],
            actions: ['Complete a TensorFlow mini-project to close the gap'],
            application_url: 'https://jobs.acme.in/ml-engineer',
            source: 'TrustJob.in',
          }
        ],
        skill_gaps: [
          { skill: 'TensorFlow', priority: 4, reason: 'Required by 5 matching jobs in Bengaluru', jobs_requiring: ['ML Engineer', 'Data Scientist'] },
        ],
        jobs_source_status: { ok: true, source: 'verified-jobs-api', message: 'jobs loaded' },
        metadata: { generated_at: new Date().toISOString() },
        _echo_seen_key: seenKey,
      });
    }
    if (url.pathname === '/api/assessments/start' && req.method === 'POST') {
      return json(res, 200, { assessment_id: 'asm-1', title: 'Python Skill Assessment', questions: [{ id: 'q1' }] });
    }
    if (url.pathname === '/api/assessments/submit' && req.method === 'POST') {
      return json(res, 200, { assessment_id: 'asm-1', score: 84, passed: true, skills_verified: ['Python'] });
    }
    return json(res, 404, { error: 'not found' });
  });
});

server.listen(PORT, () => {
  console.log(`mock mediator listening on :${PORT}`);
});