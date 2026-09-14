import React, { useState } from 'react';
import { UserCheck, ShieldCheck, CheckCircle2, XCircle, FileText, Award, AlertTriangle, ExternalLink, ShieldAlert, Check, X, Search, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { apiSend, type Student, type StudentSkill, type Certificate } from '../lib/engine';
import { Chip } from './ui';

export function TeacherStudentVerificationSection() {
  const { students, allSkills, certificates, refresh } = useApp();
  const { role, authToken, profile } = useAuth();

  const [selectedStudentId, setSelectedStudentId] = useState<number>(students[0]?.id || 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvidenceModal, setSelectedEvidenceModal] = useState<{ skill: StudentSkill; cert?: Certificate } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    skill: StudentSkill;
    action: 'COLLEGE VERIFIED' | 'REJECTED';
  } | null>(null);

  const [remarkInput, setRemarkInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const currentStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  const studentSkillsList = allSkills.filter((s) => s.student_id === currentStudent?.id);

  const filteredSkills = studentSkillsList.filter((s) =>
    s.skill_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isTeacherOrCollege = role === 'college' || role === 'ministry';

  const handleDecision = async () => {
    if (!confirmModal) return;
    setProcessing(true);
    setActionMsg('');

    try {
      const token = await authToken();
      const payload = {
        id: confirmModal.skill.id,
        verification_decision: confirmModal.action,
        teacher_remark: remarkInput.trim() || undefined,
        verified_by: profile?.email || 'Teacher / College Admin',
        decision_timestamp: new Date().toISOString(),
      };

      await apiSend('/api/student-skills', 'PUT', payload, token);

      setActionMsg(`Successfully set status to "${confirmModal.action}" for ${confirmModal.skill.skill_name}.`);
      setConfirmModal(null);
      setRemarkInput('');
      await refresh();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setProcessing(false);
    }
  };

  const findCertificateForSkill = (skillName: string): Certificate | undefined => {
    return certificates.find(
      (c) =>
        c.student_id === currentStudent?.id &&
        (c.skills_validated?.some((sk) => sk.toLowerCase() === skillName.toLowerCase()) ||
          c.opportunity_title.toLowerCase().includes(skillName.toLowerCase()))
    );
  };

  const renderVerificationBadge = (skill: StudentSkill) => {
    const decision = skill.verification_decision || (skill.verified ? 'COLLEGE VERIFIED' : 'NOT VERIFIED');

    if (decision === 'COLLEGE VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#0d7a5f] px-2.5 py-0.5 text-xs font-black text-white shadow-sm">
          <CheckCircle2 size={13} /> COLLEGE VERIFIED
        </span>
      );
    }
    if (decision === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#dc2626] px-2.5 py-0.5 text-xs font-black text-white shadow-sm">
          <XCircle size={13} /> REJECTED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#cbd5e1] px-2.5 py-0.5 text-xs font-black text-[#334155]">
        NOT VERIFIED
      </span>
    );
  };

  return (
    <div className="mt-6 rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece2c8] pb-4">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-bold text-[#07382c]">
            <UserCheck size={20} className="text-[#0d7a5f]" /> Teacher & College Skill Verification Portal
          </p>
          <p className="mt-0.5 text-[13px] text-[#5a6a62]">
            Review student skill claims, AI analysis, certificate evidence, and approve/reject with official college endorsement.
          </p>
        </div>
        {!isTeacherOrCollege && (
          <div className="rounded-xl border border-[#b4530933] bg-[#fffbeb] px-3 py-1.5 text-xs font-bold text-[#b45309]">
            Viewing Mode (Sign in as College role to approve/reject skills)
          </div>
        )}
      </div>

      {actionMsg && (
        <div className="mt-3 rounded-xl bg-[#effaf4] p-3 text-xs font-bold text-[#0d7a5f]">
          {actionMsg}
        </div>
      )}

      {/* Student Selector Tabs */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {students.map((st) => (
          <button
            key={st.id}
            onClick={() => {
              setSelectedStudentId(st.id);
              setActionMsg('');
            }}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              selectedStudentId === st.id
                ? 'bg-[#07382c] text-white shadow'
                : 'border border-[#d8cdae] bg-[#fffdf6] text-[#3c4a44] hover:border-[#0d7a5f]'
            }`}
          >
            <span
              className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-white"
              style={{ background: st.avatar_color }}
            >
              {st.name.charAt(0)}
            </span>
            {st.name}
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
              {allSkills.filter((s) => s.student_id === st.id).length} skills
            </span>
          </button>
        ))}
      </div>

      {/* Student Summary Info */}
      {currentStudent && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#faf7ef] p-3 text-xs">
          <div>
            <span className="font-bold text-[#07382c]">{currentStudent.name}</span> · {currentStudent.college} · {currentStudent.degree} ({currentStudent.year})
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#5a6a62]">Readiness Score:</span>
            <span className="rounded-full bg-[#0d7a5f] px-2 py-0.5 font-black text-white">
              {currentStudent.readiness_score}/100
            </span>
          </div>
        </div>
      )}

      {/* Search Bar for Skills */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2 text-xs">
        <Search size={14} className="text-[#8a978f]" />
        <input
          type="text"
          placeholder="Filter student skills by name or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent outline-none placeholder:text-[#8a978f]"
        />
      </div>

      {/* Student Skill Cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {filteredSkills.length === 0 ? (
          <div className="col-span-2 rounded-xl border border-dashed border-[#d8cdae] p-6 text-center text-xs text-[#8a978f]">
            No skills found for this student.
          </div>
        ) : (
          filteredSkills.map((sk) => {
            const cert = findCertificateForSkill(sk.skill_name);
            const decision = sk.verification_decision || (sk.verified ? 'COLLEGE VERIFIED' : 'NOT VERIFIED');

            return (
              <div
                key={sk.id}
                className="flex flex-col justify-between rounded-xl border border-[#ece2c8] bg-[#fffdf6] p-4 transition hover:border-[#0d7a5f33]"
              >
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[#07382c]">{sk.skill_name}</p>
                      <p className="text-[11px] text-[#5a6a62]">
                        {sk.category} · Proficiency: {sk.proficiency_pct}% (L{sk.level})
                      </p>
                    </div>
                    {renderVerificationBadge(sk)}
                  </div>

                  {/* Evidence Overview Bar */}
                  <div className="mt-3 space-y-1 rounded-lg bg-[#faf7ef] p-2 text-[11px] text-[#3c4a44]">
                    <div className="flex justify-between">
                      <span className="font-semibold">Declaration:</span>
                      <span>Self-Claimed ({sk.source})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Certificate Doc:</span>
                      <span>{cert ? cert.opportunity_title : 'No file attached'}</span>
                    </div>
                    {cert?.analysis_result && (
                      <div className="flex justify-between">
                        <span className="font-semibold">AI Analysis:</span>
                        <span className="font-bold text-[#0d7a5f]">{cert.analysis_result.status}</span>
                      </div>
                    )}
                    {cert?.verification_status && (
                      <div className="flex justify-between">
                        <span className="font-semibold">Issuer Verifier:</span>
                        <span className="font-bold text-[#2563eb]">{cert.verification_status}</span>
                      </div>
                    )}
                  </div>

                  {sk.teacher_remark && (
                    <p className="mt-2 text-[11px] italic text-[#b45309]">
                      Teacher Remark: "{sk.teacher_remark}"
                    </p>
                  )}
                  {sk.verified_by && (
                    <p className="text-[10px] text-[#8a978f]">
                      Updated by {sk.verified_by} {sk.decision_timestamp ? `on ${new Date(sk.decision_timestamp).toLocaleDateString()}` : ''}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#ece2c8] pt-3 text-xs">
                  <button
                    onClick={() => setSelectedEvidenceModal({ skill: sk, cert })}
                    className="font-bold text-[#0d7a5f] hover:underline"
                  >
                    View Evidence →
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setConfirmModal({ skill: sk, action: 'REJECTED' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#dc262633] bg-[#fef2f2] px-2.5 py-1 font-bold text-[#dc2626] transition hover:bg-[#dc2626] hover:text-white"
                    >
                      <X size={13} /> Reject
                    </button>

                    <button
                      onClick={() => setConfirmModal({ skill: sk, action: 'COLLEGE VERIFIED' })}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#0d7a5f] px-3 py-1 font-bold text-white transition hover:bg-[#0b6a52]"
                    >
                      <Check size={13} /> Approve
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* View Evidence Modal */}
      {selectedEvidenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e5dcc3] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ece2c8] pb-3">
              <h3 className="font-display text-lg font-bold text-[#07382c]">
                Skill Evidence & Audit Trail
              </h3>
              <button
                onClick={() => setSelectedEvidenceModal(null)}
                className="rounded-lg p-1 text-[#8a978f] hover:bg-[#faf7ef] hover:text-[#07382c]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="rounded-xl bg-[#faf7ef] p-3">
                <p className="font-bold text-[#07382c]">{selectedEvidenceModal.skill.skill_name}</p>
                <p className="text-[#5a6a62]">Student: {currentStudent?.name} ({currentStudent?.college})</p>
              </div>

              <div>
                <p className="font-black uppercase tracking-wider text-[#0d7a5f]">1. Student Declaration</p>
                <p className="mt-1 text-[#3c4a44]">
                  Self-reported proficiency of {selectedEvidenceModal.skill.proficiency_pct}% via {selectedEvidenceModal.skill.source}.
                </p>
              </div>

              <div className="border-t border-[#ece2c8] pt-2.5">
                <p className="font-black uppercase tracking-wider text-[#0d7a5f]">2. Uploaded Certificate</p>
                {selectedEvidenceModal.cert ? (
                  <div className="mt-1 space-y-1 text-[#3c4a44]">
                    <p><strong>Title:</strong> {selectedEvidenceModal.cert.opportunity_title}</p>
                    <p><strong>Issuer:</strong> {selectedEvidenceModal.cert.company_name}</p>
                    {selectedEvidenceModal.cert.cert_code && <p><strong>Code:</strong> {selectedEvidenceModal.cert.cert_code}</p>}
                    {selectedEvidenceModal.cert.verification_url && (
                      <a
                        href={selectedEvidenceModal.cert.verification_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-[#0d7a5f] hover:underline"
                      >
                        Source Verification Link <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-[#8a978f]">No specific certificate attached for this skill.</p>
                )}
              </div>

              {selectedEvidenceModal.cert?.analysis_result && (
                <div className="border-t border-[#ece2c8] pt-2.5">
                  <p className="font-black uppercase tracking-wider text-[#0d7a5f]">3. AI Document Analysis</p>
                  <p className="mt-1 font-bold text-[#3c4a44]">
                    Status: {selectedEvidenceModal.cert.analysis_result.status}
                  </p>
                  <ul className="mt-1 grid gap-1 pl-4 list-disc text-[#5a6a62]">
                    {selectedEvidenceModal.cert.analysis_result.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedEvidenceModal.cert?.verification_evidence && (
                <div className="border-t border-[#ece2c8] pt-2.5">
                  <p className="font-black uppercase tracking-wider text-[#0d7a5f]">4. Issuer Verification Check</p>
                  <p className="mt-1 text-[#3c4a44]">
                    <strong>Result:</strong> {selectedEvidenceModal.cert.verification_evidence.result}
                  </p>
                  <p className="mt-0.5 text-[#5a6a62]">
                    {selectedEvidenceModal.cert.verification_evidence.details}
                  </p>
                </div>
              )}

              <div className="flex justify-end border-t border-[#ece2c8] pt-3">
                <button
                  onClick={() => setSelectedEvidenceModal(null)}
                  className="rounded-xl bg-[#0d7a5f] px-5 py-2 font-bold text-white hover:bg-[#0b6a52]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal before Approving or Rejecting */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#e5dcc3] bg-white p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-[#07382c]">
              Confirm Skill Verification Action
            </h3>

            <p className="mt-2 text-xs text-[#5a6a62]">
              Are you sure you want to mark <strong>"{confirmModal.skill.skill_name}"</strong> for{' '}
              <strong>{currentStudent?.name}</strong> as{' '}
              <span
                className={`font-black ${
                  confirmModal.action === 'COLLEGE VERIFIED' ? 'text-[#0d7a5f]' : 'text-[#dc2626]'
                }`}
              >
                {confirmModal.action}
              </span>
              ?
            </p>

            <div className="mt-3 text-xs">
              <label className="block font-bold text-[#07382c]">Optional Teacher Remark / Endorsement Note</label>
              <textarea
                rows={2}
                placeholder="e.g. Verified in semester clinical lab session / course transcript..."
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] p-2.5 outline-none focus:border-[#0d7a5f]"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 text-xs font-bold">
              <button
                disabled={processing}
                onClick={() => setConfirmModal(null)}
                className="rounded-xl px-4 py-2 text-[#5a6a62] hover:bg-[#faf7ef]"
              >
                Cancel
              </button>
              <button
                disabled={processing}
                onClick={handleDecision}
                className={`rounded-xl px-5 py-2 text-white transition disabled:opacity-50 ${
                  confirmModal.action === 'COLLEGE VERIFIED'
                    ? 'bg-[#0d7a5f] hover:bg-[#0b6a52]'
                    : 'bg-[#dc2626] hover:bg-[#b91c1c]'
                }`}
              >
                {processing ? 'Processing...' : `Confirm ${confirmModal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
