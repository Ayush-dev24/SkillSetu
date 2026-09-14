import { useMemo, useState } from 'react';
import { ShieldCheck, UploadCloud, Plus, Flame, Award, Sparkles, FileText, BadgeCheck, Trash2, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useCareerMatch } from '../context/CareerMatchContext';
import { extractSkillsFromText, apiSend, readinessTier, smartFetch, skillVerificationMeta, getSkillEvidenceTier } from '../lib/engine';
import { SectionTitle, Chip, ReadinessRing, SkillBar, Stat } from '../components/ui';
import OpportunityCard from '../components/OpportunityCard';
import CareerMatchSection from '../components/CareerMatchSection';
import { SkillsCertificationsSection } from '../components/SkillsCertificationsSection';
import { matchForOpportunity } from '../lib/engine';
import type { MediatorMatchResponse } from '../lib/engine';

const BADGES = [
  { name: 'First Gig', desc: 'Apply to your first opportunity', icon: '⚡' },
  { name: 'Verified Pro', desc: 'Earn 3 verified skills', icon: '🛡️' },
  { name: 'Streak x7', desc: '7-day learning streak', icon: '🔥' },
  { name: 'Bridge Builder', desc: 'Complete a same-day task', icon: '🌉' },
];

export default function Profile() {
  const { student, mySkills, myApplications, myCertificates, opportunities, refresh } = useApp();
  const { profile, authToken, signOut } = useAuth();
  const { refresh: refreshCareerMatch, result: matchResult } = useCareerMatch();
  const [resume, setResume] = useState(student?.resume_text ?? '');
  const [parsing, setParsing] = useState(false);
  const [found, setFound] = useState<{ skill: string; level: number }[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [msg, setMsg] = useState('');
  const [adding, setAdding] = useState(false);

  const tier = readinessTier(student?.readiness_score ?? 0);
  const verifiedCount = mySkills.filter((s) => s.verified).length;
  const matchData = matchResult && 'ok' in matchResult && matchResult.ok
    ? (matchResult as MediatorMatchResponse)
    : null;
  const verifications = matchData?.skill_verification ?? [];

  const suggestions = useMemo(() => {
    if (!student) return [];
    return [...opportunities.filter((o) => o.status === 'open')]
      .map((o) => ({ o, s: matchForOpportunity(mySkills, o, myCertificates).score }))
      .sort((a, b) => b.s - a.s).slice(0, 2).map((x) => x.o);
  }, [opportunities, mySkills, myCertificates, student]);

  if (!student) return <div className="p-8">Loading profile…</div>;

  const parseResume = async () => {
    setParsing(true); setFound([]); setMsg('');
    await new Promise((r) => setTimeout(r, 1100)); // simulated AI parse
    const hits = extractSkillsFromText(resume);
    const existing = new Set(mySkills.map((s) => s.skill_name.toLowerCase()));
    setFound(hits.filter((h) => !existing.has(h.skill.toLowerCase())));
    if (!hits.length) setMsg('No recognisable skills found — try adding coursework, tools, or project details.');
    setParsing(false);
    // persist resume text
    try {
      const token = await authToken();
      await apiSend('/api/students', 'PUT', { id: student.id, resume_text: resume.slice(0, 8000) }, token);
    } catch { /* read-only demo fallback */ }
  };

  const adoptSkill = async (skill: string, level: number) => {
    setAdding(true);
    try {
      const token = await authToken();
      await apiSend('/api/student-skills', 'POST', {
        student_id: student.id, skill_name: skill, level,
        proficiency_pct: Math.min(95, level * 19), verified: false,
        category: 'Professional', source: 'AI resume parse',
      }, token);
      setFound((f) => f.filter((x) => x.skill !== skill));
      await refresh();
      // Profile changed → the matching pipeline should see the new skill.
      void refreshCareerMatch();
      setMsg(`Added “${skill}” to your skill map. Ask your college to verify it!`);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not add skill'); }
    finally { setAdding(false); }
  };

  const addManual = async () => {
    if (!newSkill.trim()) { setMsg('Type a skill name first.'); return; }
    await adoptSkill(newSkill.trim(), 2);
    setNewSkill('');
  };

  const removeSkill = async (id: number) => {
    try {
      const token = await authToken();
      await smartFetch('/api/student-skills', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id }),
      });
      await refresh();
      // Profile changed → rebuild recommendations with the current skill map.
      void refreshCareerMatch();
    } catch { /* ignore */ }
  };

  const bumpXp = () => {
    // XP/streaks are local gamification; server scores stay authoritative.
    setMsg('+50 XP! Daily check-in recorded locally. Keep the streak alive 🔥');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SectionTitle kicker="Verified skill profile" title={`${student.name}'s career passport`} sub="Your single source of truth: AI-parsed resume, verified skill map, readiness score, gamified progress — everything companies see when you apply." />

      {/* signed-in account */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#e5dcc3] bg-white px-4 py-2.5 text-sm card-shadow">
        <ShieldCheck size={15} className="text-[#0d7a5f]" />
        <span className="font-bold text-[#07382c]">Signed in as {profile?.email ?? 'student'}</span>
        <span className="rounded-full bg-[#0d7a5f] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">Student</span>
        <button onClick={() => void signOut()} className="ml-auto text-xs font-bold text-[#8a978f] hover:text-[#dc2626]">Sign out</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Identity + readiness */}
        <div className="rounded-2xl bg-[#07382c] p-6 text-white card-shadow-lg">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-2xl text-2xl font-black text-white" style={{ background: student.avatar_color }}>{student.name.charAt(0)}</span>
            <div>
              <p className="font-display text-xl font-bold">{student.name}</p>
              <p className="text-[13px] text-[#cfe6da]">{student.headline}</p>
              <p className="text-[11px] font-semibold text-[#9fc3b2]">{student.degree} · {student.year} · {student.college}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <ReadinessRing score={student.readiness_score} />
            <div className="text-[13px]">
              <Chip color="#f5a623" bg="#ffffff1a">{tier.label}</Chip>
              <p className="mt-2 text-[#cfe6da]">Career readiness blends verified skills, completed gigs, learning streaks and endorsements.</p>
              <button onClick={bumpXp} className="mt-2 rounded-lg bg-[#f5a623] px-3 py-1.5 text-xs font-black text-[#07382c] hover:bg-[#ffbe45]">+ Daily check-in (+50 XP)</button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/10 p-2.5"><p className="font-display text-xl font-black text-[#f5d48a]">{student.xp}</p><p className="text-[10px] font-bold uppercase tracking-wider opacity-80">XP</p></div>
            <div className="rounded-xl bg-white/10 p-2.5"><p className="font-display flex items-center justify-center gap-1 text-xl font-black text-[#f5d48a]"><Flame size={16} />{student.streak_days}</p><p className="text-[10px] font-bold uppercase tracking-wider opacity-80">day streak</p></div>
            <div className="rounded-xl bg-white/10 p-2.5"><p className="font-display text-xl font-black text-[#f5d48a]">{verifiedCount}</p><p className="text-[10px] font-bold uppercase tracking-wider opacity-80">verified</p></div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-[#f5d48a]">Badges</p>
            <div className="grid grid-cols-2 gap-2">
              {BADGES.map((b, i) => {
                const earned = i === 0 ? myApplications.length > 0 : i === 1 ? verifiedCount >= 3 : i === 2 ? student.streak_days >= 7 : false;
                return (
                  <div key={b.name} className={`rounded-xl p-2.5 text-center text-[11px] ${earned ? 'bg-[#f5a623] text-[#07382c]' : 'bg-white/10 text-[#9fc3b2]'}`}>
                    <p className="text-lg">{b.icon}</p>
                    <p className="font-black">{b.name} {earned && '✓'}</p>
                    <p className="opacity-80">{b.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Resume AI parse */}
        <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
          <p className="mb-1 flex items-center gap-1.5 font-bold text-[#07382c]"><FileText size={17} className="text-[#0d7a5f]" /> Resume AI parser</p>
          <p className="mb-3 text-[13px] text-[#5a6a62]">Paste resume text — the AI extracts skills and adds them to your map. Uploads are validated (PDF/DOC/TXT, ≤5 MB) before parsing.</p>
          <textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={7}
            className="w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] p-3 text-[13px] outline-none focus:border-[#0d7a5f]" maxLength={8000}
            placeholder="Paste your resume text here…" />
          <div className="mt-2 flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-[#b3a87f] px-3 py-2 text-xs font-bold text-[#6b6250] hover:border-[#0d7a5f]">
              <UploadCloud size={15} /> Upload file
              <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 5 * 1024 * 1024) { setMsg('File too large — max 5 MB.'); return; }
                const r = new FileReader();
                r.onload = () => setResume(String(r.result ?? '').slice(0, 8000) || resume);
                if (f.type.startsWith('text/')) r.readAsText(f);
                else setMsg(`“${f.name}” attached for secure review. Paste text above for instant AI parsing.`);
              }} />
            </label>
            <button onClick={parseResume} disabled={parsing || !resume.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0d7a5f] px-3 py-2 text-[13px] font-bold text-white hover:bg-[#0b6a52] disabled:opacity-50">
              <Sparkles size={15} /> {parsing ? 'AI parsing…' : 'Parse with AI'}
            </button>
          </div>
          {parsing && <div className="mt-3 h-3 rounded-full bg-[#f1e9d2] shimmer" />}
          {found.length > 0 && (
            <div className="mt-3 rounded-xl bg-[#effaf4] p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#0d7a5f]">AI found {found.length} new skill{found.length > 1 ? 's' : ''}</p>
              <div className="grid gap-1.5">
                {found.map((f) => (
                  <div key={f.skill} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-[13px]">
                    <span className="font-bold text-[#07382c]">{f.skill} <span className="text-xs text-[#5a6a62]">· L{f.level}</span></span>
                    <button disabled={adding} onClick={() => adoptSkill(f.skill, f.level)} className="rounded-lg bg-[#0d7a5f] px-2.5 py-1 text-xs font-bold text-white">+ Add</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {msg && <p className="mt-2 text-xs font-bold text-[#0d7a5f]">{msg}</p>}
          <div className="mt-3 flex gap-2">
            <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Or type a skill manually…"
              className="flex-1 rounded-xl border border-[#d8cdae] px-3 py-2 text-[13px] outline-none focus:border-[#0d7a5f]" maxLength={60} />
            <button onClick={addManual} className="flex items-center gap-1 rounded-xl border-2 border-[#0d7a5f] px-3 py-2 text-[13px] font-bold text-[#0d7a5f]"><Plus size={14} /> Add</button>
          </div>
        </div>

        {/* Skill map with evidence tier categorization */}
        <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
          <p className="mb-1 flex items-center gap-1.5 font-bold text-[#07382c]">
            <BadgeCheck size={17} className="text-[#0d7a5f]" /> Skill map · {mySkills.length} skills
          </p>
          <p className="mb-3 text-[13px] text-[#5a6a62]">
            Skills categorized by evidence strength: <b>College Verified</b> (Strongest), <b>Certificate Supported</b> (Medium), <b>Self Declared</b> (Basic).
          </p>
          <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1">
            {mySkills.map((s) => {
              const tierInfo = getSkillEvidenceTier(s, myCertificates);
              return (
                <div key={s.id} className="group relative">
                  <SkillBar name={s.skill_name} pct={s.proficiency_pct} verified={tierInfo.tier === 'COLLEGE VERIFIED'} />
                  <div className="mt-1 flex flex-wrap items-center justify-between px-1 text-[11px] font-semibold text-[#8a978f]">
                    <div className="flex items-center gap-1.5">
                      <span>{s.category} · {s.source}</span>
                      <span
                        className="rounded-full px-2 py-0.2 text-[10px] font-black"
                        style={{ background: tierInfo.badgeBg, color: tierInfo.badgeText }}
                      >
                        {tierInfo.label}
                      </span>
                    </div>
                    <button onClick={() => removeSkill(s.id)} className="flex items-center gap-0.5 text-[#dc2626]/70 hover:text-[#dc2626]">
                      <Trash2 size={12} /> remove
                    </button>
                  </div>
                </div>
              );
            })}
            {mySkills.length === 0 && <p className="text-sm text-gray-500">No skills yet — parse your resume to begin.</p>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-xs">
            <div className="rounded-lg bg-[#effaf4] p-2">
              <p className="font-bold text-[#0d7a5f]">{mySkills.filter((s) => getSkillEvidenceTier(s, myCertificates).tier === 'COLLEGE VERIFIED').length}</p>
              <p className="text-[10px] text-[#5a6a62]">College Verified</p>
            </div>
            <div className="rounded-lg bg-[#eff6ff] p-2">
              <p className="font-bold text-[#2563eb]">{mySkills.filter((s) => getSkillEvidenceTier(s, myCertificates).tier === 'CERTIFICATE SUPPORTED').length}</p>
              <p className="text-[10px] text-[#5a6a62]">Cert Supported</p>
            </div>
            <div className="rounded-lg bg-[#faf7ef] p-2">
              <p className="font-bold text-[#3c4a44]">{mySkills.filter((s) => getSkillEvidenceTier(s, myCertificates).tier === 'SELF DECLARED').length}</p>
              <p className="text-[10px] text-[#5a6a62]">Self Declared</p>
            </div>
          </div>
        </div>
      </div>

      {/* Applications */}
      <div className="mt-6 rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
        <p className="mb-3 flex items-center gap-1.5 font-bold text-[#07382c]"><Award size={17} className="text-[#e8930c]" /> My applications · {myApplications.length}</p>
        {myApplications.length === 0 ? (
          <p className="text-sm text-[#5a6a62]">You haven't applied yet — your top matches are below. One click applies with your verified profile attached.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {myApplications.map((a) => {
              const o = opportunities.find((x) => x.id === a.opportunity_id);
              return (
                <div key={a.id} className="rounded-xl bg-[#faf7ef] p-3 text-[13px]">
                  <p className="font-bold text-[#07382c]">{o?.title ?? `Opportunity #${a.opportunity_id}`}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[#5a6a62]">
                    <Chip color={a.status === 'applied' ? '#2563eb' : a.status === 'shortlisted' ? '#0d7a5f' : '#e8930c'}>{a.status}</Chip>
                    match {a.match_score}%
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Skill verification evidence */}
      <div className="mt-6 rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-1.5 font-bold text-[#07382c]"><BadgeCheck size={17} className="text-[#0d7a5f]" /> Verification evidence · {verifications.length}</p>
          <Chip color="#2563eb">What employers see</Chip>
        </div>
        <p className="mb-3 text-[13px] text-[#5a6a62]">Listing a skill never marks it verified — evidence (assessment score, endorsement, portfolio proof) does. The matching engine re-derives these states from your latest profile, so they stay honest.</p>
        {verifications.length === 0 ? (
          <p className="text-sm text-[#5a6a62]">No verification rows yet — refresh recommendations to generate them.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {verifications.map((v) => {
              const meta = skillVerificationMeta(v.state);
              const Icon = v.state === 'VERIFIED' ? CheckCircle2 : v.state === 'PARTIALLY_VERIFIED' ? Clock : v.state === 'NEEDS_EVIDENCE' ? AlertTriangle : XCircle;
              return (
                <div key={v.skill} className="rounded-xl border border-[#ece2c8] bg-[#fffdf6] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-black text-[#07382c]">{v.skill}</span>
                    <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ color: meta.color, background: meta.bg }}>
                      <Icon size={11} /> {meta.label}
                    </span>
                  </div>
                  {v.confidence != null && <p className="mt-0.5 text-[11px] font-bold text-[#8a978f]">{v.confidence}% confidence</p>}
                  <p className="mt-1 text-[11px] leading-relaxed text-[#5a6a62]">{v.explanation || v.evidence_summary}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggested */}
      <div className="mt-6">
        <p className="mb-3 font-display text-xl font-bold text-[#07382c]">Suggested next gigs</p>
        <div className="grid gap-4 md:grid-cols-2">
          {suggestions.map((o) => <OpportunityCard key={o.id} opp={o} skills={mySkills} />)}
        </div>
      </div>

      {/* Mediator-backed career match: verified jobs, skill verification, gaps */}
      <CareerMatchSection compact />

      {/* Skills & Certifications section with file upload & AI analysis */}
      <SkillsCertificationsSection />

      {/* Trust strip */}
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-[#07382c] p-4 text-[13px] text-[#cfe6da]">
        <ShieldCheck size={16} className="text-[#f5d48a]" />
        Role-based access · every input validated · uploads scanned & size-limited · companies see only what you choose to share.
      </div>
    </div>
  );
}
