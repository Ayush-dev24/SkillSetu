import React, { useState } from 'react';
import { UserCheck, ShieldCheck, CheckCircle2, XCircle, ExternalLink, Check, X, Search, Filter, CheckSquare, Square, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { apiSend, type StudentSkill, type Certificate } from '../lib/engine';

export type StatusFilter = 'ALL' | 'PENDING' | 'COLLEGE VERIFIED' | 'REJECTED';

export function TeacherStudentVerificationSection() {
  const { students, allSkills, certificates, refresh } = useApp();
  const { role, authToken, profile } = useAuth();

  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [activeStudentTab, setActiveStudentTab] = useState<number | null>(students[0]?.id || 1);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvidenceModal, setSelectedEvidenceModal] = useState<{ skill: StudentSkill; cert?: Certificate } | null>(null);

  // Single Action Confirm Modal
  const [singleConfirmModal, setSingleConfirmModal] = useState<{
    skill: StudentSkill;
    action: 'COLLEGE VERIFIED' | 'REJECTED';
  } | null>(null);

  // Bulk Action Confirm Modal
  const [bulkConfirmModal, setBulkConfirmModal] = useState<{
    type: 'SELECTED_STUDENTS_ALL' | 'SELECTED_SKILLS';
    skillIdsToApprove: number[];
    studentCount: number;
    skillCount: number;
  } | null>(null);

  const [remarkInput, setRemarkInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const isTeacherOrCollege = role === 'college' || role === 'ministry';

  // Toggle student selection checkbox
  const toggleStudentSelection = (stId: number) => {
    setSelectedStudentIds((prev) =>
      prev.includes(stId) ? prev.filter((id) => id !== stId) : [...prev, stId]
    );
  };

  const toggleSelectAllStudents = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map((s) => s.id));
    }
  };

  // Toggle skill selection checkbox
  const toggleSkillSelection = (skillId: number) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  };

  const currentStudent = activeStudentTab ? students.find((s) => s.id === activeStudentTab) : null;

  // Filter skills for active student tab or overall view
  const currentSkillsPool = activeStudentTab
    ? allSkills.filter((s) => s.student_id === activeStudentTab)
    : allSkills;

  const filteredSkills = currentSkillsPool.filter((s) => {
    const dec = s.verification_decision || (s.verified ? 'COLLEGE VERIFIED' : 'NOT VERIFIED');

    if (statusFilter === 'PENDING' && (dec === 'COLLEGE VERIFIED' || dec === 'REJECTED')) return false;
    if (statusFilter === 'COLLEGE VERIFIED' && dec !== 'COLLEGE VERIFIED') return false;
    if (statusFilter === 'REJECTED' && dec !== 'REJECTED') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.skill_name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    }
    return true;
  });

  // Execute single skill decision
  const handleSingleDecision = async () => {
    if (!singleConfirmModal) return;
    setProcessing(true);
    setActionMsg('');

    try {
      const token = await authToken();
      const payload = {
        id: singleConfirmModal.skill.id,
        verification_decision: singleConfirmModal.action,
        teacher_remark: remarkInput.trim() || undefined,
        verified_by: profile?.email || 'Teacher / College Admin',
        decision_timestamp: new Date().toISOString(),
      };

      await apiSend('/api/student-skills', 'PUT', payload, token);

      setActionMsg(`Successfully updated status to "${singleConfirmModal.action}" for ${singleConfirmModal.skill.skill_name}.`);
      setSingleConfirmModal(null);
      setRemarkInput('');
      await refresh();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setProcessing(false);
    }
  };

  // Trigger Bulk Approval for Selected Students
  const triggerBulkApproveStudents = () => {
    if (selectedStudentIds.length === 0) return;

    // Filter pending skills belonging ONLY to selected students (excluding already verified/rejected)
    const pendingSkillsForSelectedStudents = allSkills.filter((s) => {
      if (!selectedStudentIds.includes(s.student_id)) return false;
      const dec = s.verification_decision || (s.verified ? 'COLLEGE VERIFIED' : 'NOT VERIFIED');
      return dec !== 'COLLEGE VERIFIED' && dec !== 'REJECTED';
    });

    if (pendingSkillsForSelectedStudents.length === 0) {
      setActionMsg('No pending skills found for the selected students.');
      return;
    }

    setBulkConfirmModal({
      type: 'SELECTED_STUDENTS_ALL',
      skillIdsToApprove: pendingSkillsForSelectedStudents.map((s) => s.id),
      studentCount: selectedStudentIds.length,
      skillCount: pendingSkillsForSelectedStudents.length,
    });
  };

  // Trigger Bulk Approval for Selected Skills
  const triggerBulkApproveSkills = () => {
    if (selectedSkillIds.length === 0) return;

    // Filter pending skills that are in selectedSkillIds
    const targetPendingSkills = allSkills.filter((s) => {
      if (!selectedSkillIds.includes(s.id)) return false;
      const dec = s.verification_decision || (s.verified ? 'COLLEGE VERIFIED' : 'NOT VERIFIED');
      return dec !== 'COLLEGE VERIFIED' && dec !== 'REJECTED';
    });

    if (targetPendingSkills.length === 0) {
      setActionMsg('Selected skills are already verified or rejected.');
      return;
    }

    const uniqueStudents = new Set(targetPendingSkills.map((s) => s.student_id));

    setBulkConfirmModal({
      type: 'SELECTED_SKILLS',
      skillIdsToApprove: targetPendingSkills.map((s) => s.id),
      studentCount: uniqueStudents.size,
      skillCount: targetPendingSkills.length,
    });
  };

  // Execute Bulk Approval API Call
  const handleBulkDecision = async () => {
    if (!bulkConfirmModal) return;
    setProcessing(true);
    setActionMsg('');

    try {
      const token = await authToken();
      const payload = {
        action: 'bulk_approve',
        skill_ids: bulkConfirmModal.skillIdsToApprove,
        teacher_remark: remarkInput.trim() || 'Bulk College Approval',
      };

      const res = (await apiSend('/api/student-skills', 'PUT', payload, token)) as Record<string, any>;

      setActionMsg(`Bulk Approval Complete: Approved ${res?.approved_count || bulkConfirmModal.skillCount} skill(s) across ${bulkConfirmModal.studentCount} student(s).`);
      setBulkConfirmModal(null);
      setSelectedSkillIds([]);
      setRemarkInput('');
      await refresh();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Bulk action failed.');
    } finally {
      setProcessing(false);
    }
  };

  const findCertificateForSkill = (studentId: number, skillName: string): Certificate | undefined => {
    return certificates.find(
      (c) =>
        c.student_id === studentId &&
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
            Review student skill claims, perform single or bulk skill approvals, and verify student portfolios.
          </p>
        </div>
        {!isTeacherOrCollege && (
          <div className="rounded-xl border border-[#b4530933] bg-[#fffbeb] px-3 py-1.5 text-xs font-bold text-[#b45309]">
            Viewing Mode (Sign in as College role to perform approvals)
          </div>
        )}
      </div>

      {actionMsg && (
        <div className="mt-3 rounded-xl bg-[#effaf4] p-3 text-xs font-bold text-[#0d7a5f]">
          {actionMsg}
        </div>
      )}

      {/* Bulk Action Controls Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#faf7ef] p-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSelectAllStudents}
            className="flex items-center gap-1.5 font-bold text-[#07382c] hover:underline"
          >
            {selectedStudentIds.length === students.length ? (
              <CheckSquare size={16} className="text-[#0d7a5f]" />
            ) : (
              <Square size={16} className="text-[#8a978f]" />
            )}
            Select All Students ({selectedStudentIds.length}/{students.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedStudentIds.length > 0 && (
            <button
              onClick={triggerBulkApproveStudents}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d7a5f] px-3.5 py-1.5 font-bold text-white shadow-sm hover:bg-[#0b6a52]"
            >
              <Sparkles size={14} /> Approve All Pending Skills for Selected Students ({selectedStudentIds.length})
            </button>
          )}

          {selectedSkillIds.length > 0 && (
            <button
              onClick={triggerBulkApproveSkills}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563eb] px-3.5 py-1.5 font-bold text-white shadow-sm hover:bg-[#1d4ed8]"
            >
              <CheckSquare size={14} /> Approve Selected Skills ({selectedSkillIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Student Tabs with Checkboxes */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {students.map((st) => {
          const isSelected = selectedStudentIds.includes(st.id);
          const studentPendingCount = allSkills.filter((s) => s.student_id === st.id && !s.verified && s.verification_decision !== 'REJECTED').length;

          return (
            <div
              key={st.id}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition border ${
                activeStudentTab === st.id
                  ? 'border-[#07382c] bg-[#07382c] text-white shadow'
                  : 'border-[#d8cdae] bg-[#fffdf6] text-[#3c4a44] hover:border-[#0d7a5f]'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleStudentSelection(st.id)}
                className="h-3.5 w-3.5 accent-[#0d7a5f]"
              />
              <button
                onClick={() => {
                  setActiveStudentTab(st.id);
                  setActionMsg('');
                }}
                className="flex items-center gap-1.5"
              >
                <span
                  className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-black text-white"
                  style={{ background: st.avatar_color }}
                >
                  {st.name.charAt(0)}
                </span>
                {st.name}
                {studentPendingCount > 0 && (
                  <span className="rounded-full bg-[#f5a623] px-1.5 py-0.2 text-[9px] font-black text-[#07382c]">
                    {studentPendingCount} pending
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Filter Options & Search */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
          <span className="flex items-center gap-1 text-[#5a6a62]">
            <Filter size={13} /> Filter:
          </span>
          {(['ALL', 'PENDING', 'COLLEGE VERIFIED', 'REJECTED'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-lg px-3 py-1 transition ${
                statusFilter === f
                  ? 'bg-[#07382c] text-white'
                  : 'bg-[#faf7ef] text-[#5a6a62] hover:bg-[#e5dcc3]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="flex flex-1 max-w-xs items-center gap-2 rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-1.5 text-xs">
          <Search size={14} className="text-[#8a978f]" />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-[#8a978f]"
          />
        </div>
      </div>

      {/* Skill Cards Grid */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {filteredSkills.length === 0 ? (
          <div className="col-span-2 rounded-xl border border-dashed border-[#d8cdae] p-6 text-center text-xs text-[#8a978f]">
            No skills match the current filter or search criteria.
          </div>
        ) : (
          filteredSkills.map((sk) => {
            const cert = findCertificateForSkill(sk.student_id, sk.skill_name);
            const decision = sk.verification_decision || (sk.verified ? 'COLLEGE VERIFIED' : 'NOT VERIFIED');
            const isSkillSelected = selectedSkillIds.includes(sk.id);
            const isPending = decision !== 'COLLEGE VERIFIED' && decision !== 'REJECTED';

            return (
              <div
                key={sk.id}
                className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                  isSkillSelected ? 'border-[#0d7a5f] bg-[#effaf4]/30 ring-1 ring-[#0d7a5f]' : 'border-[#ece2c8] bg-[#fffdf6]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {isPending && (
                        <input
                          type="checkbox"
                          checked={isSkillSelected}
                          onChange={() => toggleSkillSelection(sk.id)}
                          className="mt-1 h-3.5 w-3.5 accent-[#0d7a5f]"
                        />
                      )}
                      <div>
                        <p className="font-bold text-[#07382c]">{sk.skill_name}</p>
                        <p className="text-[11px] text-[#5a6a62]">
                          {sk.category} · {sk.proficiency_pct}% Proficiency (L{sk.level})
                        </p>
                      </div>
                    </div>
                    {renderVerificationBadge(sk)}
                  </div>

                  {/* Evidence Overview Box */}
                  <div className="mt-3 space-y-1 rounded-lg bg-[#faf7ef] p-2 text-[11px] text-[#3c4a44]">
                    <div className="flex justify-between">
                      <span className="font-semibold">Source:</span>
                      <span>{sk.source}</span>
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
                        <span className="font-semibold">Issuer Check:</span>
                        <span className="font-bold text-[#2563eb]">{cert.verification_status}</span>
                      </div>
                    )}
                  </div>

                  {sk.teacher_remark && (
                    <p className="mt-2 text-[11px] italic text-[#b45309]">
                      Remark: "{sk.teacher_remark}"
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
                      onClick={() => setSingleConfirmModal({ skill: sk, action: 'REJECTED' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#dc262633] bg-[#fef2f2] px-2.5 py-1 font-bold text-[#dc2626] transition hover:bg-[#dc2626] hover:text-white"
                    >
                      <X size={13} /> Reject
                    </button>

                    <button
                      onClick={() => setSingleConfirmModal({ skill: sk, action: 'COLLEGE VERIFIED' })}
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
                <p className="text-[#5a6a62]">Proficiency: {selectedEvidenceModal.skill.proficiency_pct}% (L{selectedEvidenceModal.skill.level})</p>
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

              <div className="border-t border-[#ece2c8] pt-2.5">
                <p className="font-black uppercase tracking-wider text-[#0d7a5f]">5. College Endorsement & Audit Trail</p>
                <div className="mt-1 space-y-1 text-[#3c4a44]">
                  <p>
                    <strong>Decision:</strong>{' '}
                    <span
                      className={`font-bold ${
                        selectedEvidenceModal.skill.verification_decision === 'COLLEGE VERIFIED'
                          ? 'text-[#0d7a5f]'
                          : selectedEvidenceModal.skill.verification_decision === 'REJECTED'
                          ? 'text-[#dc2626]'
                          : 'text-[#3c4a44]'
                      }`}
                    >
                      {selectedEvidenceModal.skill.verification_decision || (selectedEvidenceModal.skill.verified ? 'COLLEGE VERIFIED' : 'NOT VERIFIED')}
                    </span>
                  </p>
                  <p>
                    <strong>Evaluated By:</strong> {selectedEvidenceModal.skill.verified_by || 'Pending College Review'}
                  </p>
                  {selectedEvidenceModal.skill.decision_timestamp && (
                    <p>
                      <strong>Date / Time:</strong> {new Date(selectedEvidenceModal.skill.decision_timestamp).toLocaleString()}
                    </p>
                  )}
                  {selectedEvidenceModal.skill.teacher_remark && (
                    <p className="italic text-[#b45309]">
                      <strong>Teacher Remark:</strong> "{selectedEvidenceModal.skill.teacher_remark}"
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end border-t border-[#ece2c8] pt-3">
                <button
                  onClick={() => setSelectedEvidenceModal(null)}
                  className="rounded-xl bg-[#0d7a5f] px-5 py-2 font-bold text-white hover:bg-[#0b6a52]"
                >
                  Close Audit Evidence
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Single Action */}
      {singleConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#e5dcc3] bg-white p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-[#07382c]">
              Confirm Skill Verification Action
            </h3>

            <p className="mt-2 text-xs text-[#5a6a62]">
              Are you sure you want to mark <strong>"{singleConfirmModal.skill.skill_name}"</strong> as{' '}
              <span
                className={`font-black ${
                  singleConfirmModal.action === 'COLLEGE VERIFIED' ? 'text-[#0d7a5f]' : 'text-[#dc2626]'
                }`}
              >
                {singleConfirmModal.action}
              </span>
              ?
            </p>

            <div className="mt-3 text-xs">
              <label className="block font-bold text-[#07382c]">Optional Teacher Remark</label>
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
                onClick={() => setSingleConfirmModal(null)}
                className="rounded-xl px-4 py-2 text-[#5a6a62] hover:bg-[#faf7ef]"
              >
                Cancel
              </button>
              <button
                disabled={processing}
                onClick={handleSingleDecision}
                className={`rounded-xl px-5 py-2 text-white transition disabled:opacity-50 ${
                  singleConfirmModal.action === 'COLLEGE VERIFIED'
                    ? 'bg-[#0d7a5f] hover:bg-[#0b6a52]'
                    : 'bg-[#dc2626] hover:bg-[#b91c1c]'
                }`}
              >
                {processing ? 'Processing...' : `Confirm ${singleConfirmModal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Bulk Actions */}
      {bulkConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#e5dcc3] bg-white p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-[#07382c]">
              Confirm Bulk Skill Approval
            </h3>

            <div className="mt-3 rounded-xl bg-[#effaf4] p-3 text-xs font-bold text-[#0d7a5f]">
              Approve {bulkConfirmModal.skillCount} pending skill(s) across {bulkConfirmModal.studentCount} student(s)?
            </div>

            <p className="mt-2 text-xs text-[#5a6a62]">
              All target skills will be marked as <strong className="text-[#0d7a5f]">COLLEGE VERIFIED</strong>. Already verified or rejected skills will remain unchanged.
            </p>

            <div className="mt-3 text-xs">
              <label className="block font-bold text-[#07382c]">Optional Bulk Teacher Endorsement Remark</label>
              <textarea
                rows={2}
                placeholder="e.g. Bulk verified based on semester exam results & coursework verification..."
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] p-2.5 outline-none focus:border-[#0d7a5f]"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 text-xs font-bold">
              <button
                disabled={processing}
                onClick={() => setBulkConfirmModal(null)}
                className="rounded-xl px-4 py-2 text-[#5a6a62] hover:bg-[#faf7ef]"
              >
                Cancel
              </button>
              <button
                disabled={processing}
                onClick={handleBulkDecision}
                className="rounded-xl bg-[#0d7a5f] px-5 py-2 text-white transition hover:bg-[#0b6a52] disabled:opacity-50"
              >
                {processing ? 'Processing Bulk Approval...' : 'Approve All Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
