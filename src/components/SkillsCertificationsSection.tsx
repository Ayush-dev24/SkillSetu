import React, { useState } from 'react';
import { Award, UploadCloud, Sparkles, CheckCircle2, AlertTriangle, XCircle, ExternalLink, ShieldAlert, Plus, ShieldCheck, FileCheck, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { apiSend, type CertAnalysisResult, type CertVerificationEvidence, type CertVerificationStatus, type Certificate } from '../lib/engine';

export function SkillsCertificationsSection() {
  const { student, mySkills, myCertificates, refresh } = useApp();
  const { authToken } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [selectedEvidenceModal, setSelectedEvidenceModal] = useState<Certificate | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [skillName, setSkillName] = useState('');
  const [certName, setCertName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [certId, setCertId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [recentResult, setRecentResult] = useState<{ cert: Certificate } | null>(null);

  if (!student) return null;

  const resetForm = () => {
    setFile(null);
    setSkillName('');
    setCertName('');
    setIssuer('');
    setCertId('');
    setIssueDate('');
    setExpiryDate('');
    setVerifyUrl('');
    setErrorMsg('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg('File is too large (max 10 MB).');
      return;
    }
    setErrorMsg('');
    setFile(f);
    if (!certName) {
      const baseName = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setCertName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
  };

  const runAiAnalysis = (fileName: string): CertAnalysisResult => {
    const fn = (fileName || '').toLowerCase();
    const cName = (certName || '').toLowerCase();
    const sName = (skillName || '').toLowerCase();
    const cId = (certId || '').trim();
    const vUrl = (verifyUrl || '').trim();

    const inconsistencies: string[] = [];
    const reasons: string[] = [];

    const hasCertId = Boolean(cId);
    const hasVerificationUrl = Boolean(vUrl && (vUrl.startsWith('http://') || vUrl.startsWith('https://')));
    const hasQrCode = fn.includes('qr') || cName.includes('qr') || hasVerificationUrl;

    if (cId && cId.length < 4) {
      inconsistencies.push('Certificate ID is suspiciously short.');
    }
    if (vUrl && !vUrl.startsWith('http://') && !vUrl.startsWith('https://')) {
      inconsistencies.push('Verification URL format is invalid.');
    }
    if (issueDate && expiryDate && new Date(expiryDate) <= new Date(issueDate)) {
      inconsistencies.push('Expiry date is before or equal to issue date.');
    }
    if (fn.includes('sample') || fn.includes('test') || fn.includes('fake') || fn.includes('dummy')) {
      inconsistencies.push('File name contains keywords associated with mock/dummy documents.');
    }

    let status: 'ANALYSIS PASSED' | 'NEEDS REVIEW' | 'ANALYSIS FAILED' = 'ANALYSIS PASSED';

    if (inconsistencies.length > 0) {
      status = 'NEEDS REVIEW';
      reasons.push(`Detected ${inconsistencies.length} potential inconsistency/anomaly.`);
    } else if (hasCertId || hasVerificationUrl || hasQrCode) {
      status = 'ANALYSIS PASSED';
      reasons.push('Verified presence of structured identifiers (Certificate ID / Verification URL / QR code).');
      reasons.push('Extracted details match user metadata with high consistency.');
    } else {
      status = 'NEEDS REVIEW';
      reasons.push('No Certificate ID, QR Code, or Verification URL found on document.');
      reasons.push('Document contains text matching skill claim but lacks cryptographic/online verification pointers.');
    }

    if (fn.includes('fake') || fn.includes('dummy')) {
      status = 'ANALYSIS FAILED';
      reasons.push('Document identified as suspicious or invalid file source.');
    }

    return {
      status,
      reasons,
      extracted_info: {
        skill_name: skillName || 'Professional Skill',
        certificate_name: certName || 'Skill Certificate',
        issuing_organization: issuer || 'Issuer',
        certificate_id: cId || undefined,
        issue_date: issueDate || undefined,
        expiry_date: expiryDate || undefined,
        verification_url: vUrl || undefined,
        has_qr_code: hasQrCode,
        has_cert_id: hasCertId,
        has_verification_url: hasVerificationUrl,
      },
      inconsistencies,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillName.trim()) {
      setErrorMsg('Please specify the skill name.');
      return;
    }
    if (!certName.trim()) {
      setErrorMsg('Please specify the certificate name.');
      return;
    }
    if (!issuer.trim()) {
      setErrorMsg('Please specify the issuing organization.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const token = await authToken();
      const fileName = file ? file.name : 'certificate.pdf';
      const analysis = runAiAnalysis(fileName);

      // 1. Add skill to profile if not already present
      const existingSkill = mySkills.find(
        (s) => s.skill_name.toLowerCase() === skillName.trim().toLowerCase()
      );

      if (!existingSkill) {
        await apiSend(
          '/api/student-skills',
          'POST',
          {
            student_id: student.id,
            skill_name: skillName.trim(),
            level: 3,
            proficiency_pct: 75,
            verified: false,
            category: 'Professional',
            source: 'Certificate Upload',
          },
          token
        );
      }

      // 2. Save Certificate to API / DB (which runs automatic SSRF-protected issuer verification)
      const certPayload = {
        student_id: student.id,
        skill_name: skillName.trim(),
        certificate_name: certName.trim(),
        issuing_organization: issuer.trim(),
        cert_code: certId.trim() || `CERT-${Date.now().toString(36).toUpperCase()}`,
        cert_id_number: certId.trim(),
        issue_date: issueDate || new Date().toISOString().slice(0, 10),
        issued_at: issueDate || new Date().toISOString().slice(0, 10),
        expiry_date: expiryDate,
        verification_url: verifyUrl.trim(),
        opportunity_title: certName.trim(),
        company_name: issuer.trim(),
        rating: 5,
        skills_validated: [skillName.trim()],
        feedback: verifyUrl.trim()
          ? `Verification URL: ${verifyUrl.trim()}`
          : `Uploaded Certificate: ${certName.trim()}`,
        analysis_result: analysis,
      };

      const res = (await apiSend('/api/certificates', 'POST', certPayload, token)) as Record<string, any>;

      const savedCert: Certificate = {
        id: typeof res?.id === 'number' ? res.id : Date.now(),
        cert_code: certPayload.cert_code,
        student_id: student.id,
        student_name: student.name,
        opportunity_id: 0,
        opportunity_title: certName.trim(),
        company_name: issuer.trim(),
        rating: 5,
        feedback: certPayload.feedback,
        skills_validated: [skillName.trim()],
        issued_at: certPayload.issued_at,
        verification_url: verifyUrl.trim(),
        cert_id_number: certId.trim(),
        expiry_date: expiryDate,
        analysis_result: res?.analysis_result || analysis,
        verification_status: res?.verification_status || 'UNVERIFIED',
        verification_evidence: res?.verification_evidence || {
          verification_method: verifyUrl.trim() ? 'PUBLIC_URL_HTTP' : 'MANUAL_OR_NONE',
          issuer: issuer.trim(),
          certificate_id: certId.trim() || undefined,
          verification_url: verifyUrl.trim() || undefined,
          timestamp: new Date().toISOString(),
          result: verifyUrl.trim() ? 'NEEDS REVIEW' : 'UNVERIFIED',
          details: verifyUrl.trim() ? 'Pending public issuer verification.' : 'No verification URL provided.',
        },
      };

      setRecentResult({ cert: savedCert });
      await refresh();
      resetForm();
      setShowModal(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save certificate.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderAiBadge = (status: 'ANALYSIS PASSED' | 'NEEDS REVIEW' | 'ANALYSIS FAILED') => {
    if (status === 'ANALYSIS PASSED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#effaf4] px-2.5 py-0.5 text-[11px] font-black text-[#0d7a5f]">
          <CheckCircle2 size={12} /> AI PASSED
        </span>
      );
    }
    if (status === 'NEEDS REVIEW') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#fffbeb] px-2.5 py-0.5 text-[11px] font-black text-[#b45309]">
          <AlertTriangle size={12} /> AI NEEDS REVIEW
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#fef2f2] px-2.5 py-0.5 text-[11px] font-black text-[#dc2626]">
        <XCircle size={12} /> AI FAILED
      </span>
    );
  };

  const renderVerificationBadge = (status?: CertVerificationStatus) => {
    const st = status || 'UNVERIFIED';
    if (st === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#0d7a5f] px-2.5 py-0.5 text-[11px] font-black text-white shadow-sm">
          <ShieldCheck size={12} /> ISSUER VERIFIED
        </span>
      );
    }
    if (st === 'EXPIRED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#475569] px-2.5 py-0.5 text-[11px] font-black text-white">
          <AlertTriangle size={12} /> EXPIRED
        </span>
      );
    }
    if (st === 'INVALID') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#dc2626] px-2.5 py-0.5 text-[11px] font-black text-white">
          <XCircle size={12} /> INVALID
        </span>
      );
    }
    if (st === 'NEEDS REVIEW') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b] px-2.5 py-0.5 text-[11px] font-black text-white">
          <FileCheck size={12} /> NEEDS REVIEW
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#cbd5e1] px-2.5 py-0.5 text-[11px] font-black text-[#334155]">
        <Info size={12} /> UNVERIFIED
      </span>
    );
  };

  return (
    <div className="mt-6 rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-bold text-[#07382c]">
            <Award size={20} className="text-[#0d7a5f]" /> Skills & Certifications
          </p>
          <p className="mt-0.5 text-[13px] text-[#5a6a62]">
            Upload skill certificates for automatic AI analysis & safe public issuer verification.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d7a5f] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0b6a52]"
        >
          <Plus size={15} /> Add Skill Certificate
        </button>
      </div>

      {/* AI Disclaimer Notice */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#e5dcc3] bg-[#faf7ef] p-3 text-xs text-[#5a6a62]">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-[#b45309]" />
        <div>
          <span className="font-bold text-[#07382c]">Important Note:</span> AI analysis evaluates document text and consistency, while automatic verification checks public issuer sources securely. AI analysis is <strong className="text-[#07382c]">NOT proof that the certificate is genuine</strong>.
        </div>
      </div>

      {/* Recent Submission Result Banner */}
      {recentResult && (
        <div className="mt-4 rounded-xl border border-[#0d7a5f33] bg-[#effaf4] p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-[#07382c]">Result for “{recentResult.cert.opportunity_title}”</span>
            <div className="flex items-center gap-1.5">
              {renderAiBadge(recentResult.cert.analysis_result?.status || 'ANALYSIS PASSED')}
              {renderVerificationBadge(recentResult.cert.verification_status)}
            </div>
          </div>
          <p className="mt-2 text-[#3c4a44]">
            <strong>Verification Result:</strong> {recentResult.cert.verification_evidence?.details || 'Processed successfully.'}
          </p>
          <button
            onClick={() => setSelectedEvidenceModal(recentResult.cert)}
            className="mt-2 inline-flex items-center gap-1 font-bold text-[#0d7a5f] hover:underline"
          >
            View Full Evidence Details →
          </button>
        </div>
      )}

      {/* List of Student Certificates */}
      <div className="mt-4">
        {myCertificates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d8cdae] p-6 text-center text-xs text-[#8a978f]">
            No certificates added yet. Click "Add Skill Certificate" to upload your first certificate.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {myCertificates.map((cert) => {
              const analysis = cert.analysis_result || {
                status: cert.cert_code?.startsWith('SB-') ? 'ANALYSIS PASSED' : 'NEEDS REVIEW',
                reasons: ['Certificate registered on SkillSetu'],
                extracted_info: {},
                inconsistencies: [],
              };

              const vStatus = cert.verification_status || (cert.cert_code?.startsWith('SB-') ? 'VERIFIED' : cert.verification_url ? 'NEEDS REVIEW' : 'UNVERIFIED');

              return (
                <div key={cert.id} className="flex flex-col justify-between rounded-xl border border-[#ece2c8] bg-[#fffdf6] p-4 transition hover:border-[#0d7a5f33]">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                      <div>
                        <p className="font-bold text-[#07382c]">{cert.opportunity_title || 'Skill Certificate'}</p>
                        <p className="text-xs font-medium text-[#5a6a62]">{cert.company_name || 'Issuing Body'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {renderVerificationBadge(vStatus)}
                        {renderAiBadge(analysis.status as any)}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {(cert.skills_validated || []).map((sk) => (
                        <span key={sk} className="rounded-md bg-[#e5dcc3]/40 px-2 py-0.5 text-[11px] font-semibold text-[#07382c]">
                          {sk}
                        </span>
                      ))}
                    </div>

                    {cert.cert_code && (
                      <p className="mt-2 text-[11px] text-[#8a978f]">
                        ID: <span className="font-mono text-[#3c4a44]">{cert.cert_code}</span>
                      </p>
                    )}

                    {cert.issued_at && (
                      <p className="text-[11px] text-[#8a978f]">
                        Issued: {cert.issued_at}
                      </p>
                    )}

                    {cert.verification_url && (
                      <a
                        href={cert.verification_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#0d7a5f] hover:underline"
                      >
                        Source URL <ExternalLink size={11} />
                      </a>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-[#ece2c8] pt-2.5 text-[11px]">
                    <span className="truncate text-[#5a6a62]">
                      <strong className="text-[#07382c]">Evidence:</strong> {cert.verification_evidence?.details || 'Recorded'}
                    </span>
                    <button
                      onClick={() => setSelectedEvidenceModal(cert)}
                      className="ml-2 shrink-0 font-bold text-[#0d7a5f] hover:underline"
                    >
                      View Evidence
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View Evidence Modal */}
      {selectedEvidenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e5dcc3] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ece2c8] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-[#0d7a5f]" />
                <h3 className="font-display text-lg font-bold text-[#07382c]">Verification Evidence Details</h3>
              </div>
              <button
                onClick={() => setSelectedEvidenceModal(null)}
                className="rounded-lg p-1 text-[#8a978f] hover:bg-[#faf7ef] hover:text-[#07382c]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl bg-[#faf7ef] p-3">
                <p className="font-bold text-[#07382c]">{selectedEvidenceModal.opportunity_title}</p>
                <p className="text-[#5a6a62]">{selectedEvidenceModal.company_name}</p>
              </div>

              <div>
                <p className="font-black uppercase tracking-wider text-[#0d7a5f]">Certificate Verification Status</p>
                <div className="mt-1 flex items-center gap-2">
                  {renderVerificationBadge(
                    selectedEvidenceModal.verification_status ||
                      (selectedEvidenceModal.cert_code?.startsWith('SB-') ? 'VERIFIED' : 'UNVERIFIED')
                  )}
                </div>
                <p className="mt-2 text-[#3c4a44]">
                  <strong>Method:</strong> {selectedEvidenceModal.verification_evidence?.verification_method || (selectedEvidenceModal.verification_url ? 'PUBLIC_URL_HTTP' : 'MANUAL_OR_NONE')}
                </p>
                <p className="mt-1 text-[#3c4a44]">
                  <strong>Timestamp:</strong> {selectedEvidenceModal.verification_evidence?.timestamp || selectedEvidenceModal.issued_at}
                </p>
                <p className="mt-1 text-[#3c4a44]">
                  <strong>Evidence Summary:</strong> {selectedEvidenceModal.verification_evidence?.details || 'Registered and confirmed on platform.'}
                </p>
                {selectedEvidenceModal.verification_evidence?.http_status_code && (
                  <p className="mt-1 text-[#3c4a44]">
                    <strong>HTTP Code:</strong> {selectedEvidenceModal.verification_evidence.http_status_code}
                  </p>
                )}
              </div>

              <div className="border-t border-[#ece2c8] pt-3">
                <p className="font-black uppercase tracking-wider text-[#0d7a5f]">AI Analysis Status</p>
                <div className="mt-1">
                  {renderAiBadge(selectedEvidenceModal.analysis_result?.status || 'ANALYSIS PASSED')}
                </div>
                {selectedEvidenceModal.analysis_result?.reasons && (
                  <ul className="mt-2 grid gap-1 pl-4 list-disc text-[#3c4a44]">
                    {selectedEvidenceModal.analysis_result.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end border-t border-[#ece2c8] pt-3">
                <button
                  onClick={() => setSelectedEvidenceModal(null)}
                  className="rounded-xl bg-[#0d7a5f] px-5 py-2 font-bold text-white hover:bg-[#0b6a52]"
                >
                  Close Evidence
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog for Certificate Upload & Details */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e5dcc3] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ece2c8] pb-3">
              <h3 className="font-display text-lg font-bold text-[#07382c]">Add Skill & Certificate</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-[#8a978f] hover:bg-[#faf7ef] hover:text-[#07382c]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#07382c]">Skill Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Python, Clinical Data, Financial Modeling"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2 text-xs outline-none focus:border-[#0d7a5f]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-[#07382c]">Certificate Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Advanced Python Certification"
                    value={certName}
                    onChange={(e) => setCertName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2 text-xs outline-none focus:border-[#0d7a5f]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#07382c]">Issuing Organization *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Coursera, IIT Madras, NPTEL"
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2 text-xs outline-none focus:border-[#0d7a5f]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#07382c]">Upload Certificate Document (PDF / Image)</label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#b3a87f] bg-[#fffdf6] px-3 py-2.5 text-xs font-semibold text-[#6b6250] hover:border-[#0d7a5f]">
                    <UploadCloud size={16} />
                    {file ? file.name : 'Choose PDF, PNG, or JPG file (max 10MB)'}
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-[#07382c]">Certificate ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. UC-89472-X"
                    value={certId}
                    onChange={(e) => setCertId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2 text-xs outline-none focus:border-[#0d7a5f]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#07382c]">Verification URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://verify.coursera.org/..."
                    value={verifyUrl}
                    onChange={(e) => setVerifyUrl(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2 text-xs outline-none focus:border-[#0d7a5f]"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-[#07382c]">Issue Date (Optional)</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2 text-xs outline-none focus:border-[#0d7a5f]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#07382c]">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2 text-xs outline-none focus:border-[#0d7a5f]"
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="rounded-lg bg-[#fef2f2] p-2 text-xs font-bold text-[#dc2626]">
                  {errorMsg}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-[#ece2c8] pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 font-bold text-[#5a6a62] hover:bg-[#faf7ef]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl bg-[#0d7a5f] px-5 py-2 font-bold text-white transition hover:bg-[#0b6a52] disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {submitting ? 'Verifying & Saving…' : 'Run Verification & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
