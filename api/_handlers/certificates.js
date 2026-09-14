import supabase from '../_db-client.js';
import { requireRole } from '../_auth-helpers.js';
import { performAutomaticVerification } from '../_lib/cert-verifier.js';

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
      const auth = await requireRole(req, res, ['student', 'company']);
      if (!auth) return;
      const b = req.body || {};
      
      let studentId = b.student_id ? Number(b.student_id) : null;
      if (auth.role === 'student' && auth.profile?.student_id != null) {
        studentId = Number(auth.profile.student_id);
      }
      if (studentId == null) {
        return res.status(400).json({ error: 'student_id is required' });
      }

      const { data: st } = await supabase.from('students').select('name').eq('id', studentId).single();
      const code = b.cert_code || `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const verificationEvidence = await performAutomaticVerification({
        verificationUrl: b.verification_url || (b.feedback && b.feedback.includes('http') ? b.feedback.split('Verification URL:')[1]?.trim() : undefined),
        certificateId: b.cert_id_number || b.cert_code || b.certificate_id,
        issuer: b.issuing_organization || b.company_name,
        expiryDate: b.expiry_date,
      });

      const row = {
        cert_code: code,
        student_id: studentId,
        student_name: st?.name ?? b.student_name ?? `Student #${studentId}`,
        opportunity_id: b.opportunity_id ? Number(b.opportunity_id) : 0,
        opportunity_title: b.opportunity_title ? String(b.opportunity_title).slice(0, 150) : (b.certificate_name ? String(b.certificate_name).slice(0, 150) : 'Uploaded Certification'),
        company_name: b.issuing_organization ? String(b.issuing_organization).slice(0, 150) : (b.company_name ? String(b.company_name).slice(0, 150) : 'Independent Issuer'),
        rating: Math.max(1, Math.min(5, Number(b.rating ?? 5.0) || 5.0)),
        feedback: String(b.feedback || (b.verification_url ? `Verification URL: ${b.verification_url}` : 'Uploaded student certificate.')).slice(0, 1000),
        skills_validated: Array.isArray(b.skills_validated) ? b.skills_validated : (b.skill_name ? [b.skill_name] : []),
        issued_at: String(b.issue_date || b.issued_at || new Date().toISOString().slice(0, 10)).slice(0, 40),
        ...(b.analysis_result ? { analysis_result: b.analysis_result } : {}),
        verification_status: verificationEvidence.result,
        verification_evidence: verificationEvidence,
      };

      let { data, error } = await supabase.from('certificates').insert(row).select().single();
      if (error && error.message && (error.message.includes('analysis_result') || error.message.includes('verification_status') || error.message.includes('verification_evidence'))) {
        // If optional JSONB columns are missing in DB table schema, drop them and insert core row
        delete row.analysis_result;
        delete row.verification_status;
        delete row.verification_evidence;
        const res2 = await supabase.from('certificates').insert(row).select().single();
        data = res2.data;
        error = res2.error;
      }
      if (data) {
        // Ensure evidence is always present in API response payload even if DB schema lacks the column
        data.verification_status = verificationEvidence.result;
        data.verification_evidence = verificationEvidence;
        if (b.analysis_result && !data.analysis_result) data.analysis_result = b.analysis_result;
      }
      if (error) throw error;
      return res.status(201).json(data);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('certificates API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
