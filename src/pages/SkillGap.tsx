import { useEffect, useMemo, useState } from 'react';
import { ScanSearch, Target, Clock3, BookOpenCheck, ChevronRight, Sparkles, TrendingUp, CalendarCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { levelOf } from '../lib/engine';
import type { Career, Course, Opportunity, StudentSkill } from '../lib/engine';
import { SectionTitle, Chip, MatchRing, SkillBar, Empty } from '../components/ui';

interface GapResp {
  score: number;
  breakdown: { skill: string; required_level: number; current_level: number; weight: number; verified: boolean; gap: number }[];
  missing: { skill: string; required_level: number; current_level: number; weight: number }[];
  estimated_hours: number; estimated_weeks: number;
  recommended_courses: { id: number; title: string; provider: string; duration: string; rating: number; free: boolean; hits: number }[];
  recommended_opportunities: { id: number; title: string; type: string; stipend: string; overlap: number }[];
}

function analyzeLocally(career: Career, skills: StudentSkill[], courses: Course[], opportunities: Opportunity[]): GapResp {
  const byName = Object.fromEntries(skills.map((skill) => [skill.skill_name.toLowerCase(), skill]));
  let totalWeight = 0;
  let earnedWeight = 0;
  const breakdown = career.required_skills.map((required) => {
    const mine = byName[required.skill.toLowerCase()];
    const current = mine ? levelOf(mine.proficiency_pct) : 0;
    const ratio = required.level ? Math.min(current / required.level, 1) : 1;
    totalWeight += required.weight || 1;
    earnedWeight += (required.weight || 1) * ratio;
    return {
      skill: required.skill,
      required_level: required.level,
      current_level: current,
      weight: required.weight || 1,
      verified: mine?.verified ?? false,
      gap: Math.max(0, required.level - current),
    };
  });
  const missing = breakdown.filter((item) => item.gap > 0).sort((a, b) => b.weight * b.gap - a.weight * a.gap);
  const missingNames = missing.map((item) => item.skill.toLowerCase());
  const recommendedCourses = courses.map((course) => {
    const hits = course.skills_covered.filter((covered) => missingNames.some((missingName) => covered.toLowerCase().includes(missingName) || missingName.includes(covered.toLowerCase()))).length;
    return { ...course, hits };
  }).filter((course) => course.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 4);
  const recommendedOpportunities = opportunities.filter((opportunity) => opportunity.status === 'open').map((opportunity) => {
    const requiredSkills = opportunity.skills_required.map((skill) => skill.toLowerCase());
    const overlap = requiredSkills.length ? requiredSkills.filter((skill) => byName[skill]).length / requiredSkills.length : 0;
    return { id: Number(opportunity.id), title: opportunity.title, type: opportunity.type, stipend: opportunity.stipend, overlap };
  }).sort((a, b) => b.overlap - a.overlap).slice(0, 4);

  return {
    score: totalWeight ? Math.round((earnedWeight / totalWeight) * 100) : 0,
    breakdown,
    missing,
    estimated_hours: missing.reduce((sum, item) => sum + item.gap * 9, 0),
    estimated_weeks: Math.max(1, Math.ceil(missing.reduce((sum, item) => sum + item.gap * 9, 0) / 6)),
    recommended_courses: recommendedCourses,
    recommended_opportunities: recommendedOpportunities,
  };
}

export default function SkillGap() {
  const { careers, student, mySkills, courses, opportunities, loading } = useApp();
  const [careerId, setCareerId] = useState<number | null>(null);
  const [resp, setResp] = useState<GapResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const career = useMemo(() => careers.find((c) => c.id === careerId) ?? careers[0], [careers, careerId]);
  const activeId = career?.id ?? null;

  const analyze = async (id: number) => {
    if (!student) return;
    setBusy(true); setErr('');
    try {
      const selectedCareer = careers.find((item) => item.id === id);
      if (!selectedCareer) throw new Error('Career data is still loading.');
      setResp(analyzeLocally(selectedCareer, mySkills, courses, opportunities));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Analysis failed');
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (activeId && student && !resp && !busy) analyze(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, student?.id]);

  const radar = useMemo(() => {
    if (!resp) return [];
    const max = 5;
    return resp.breakdown.map((b) => ({
      skill: b.skill,
      reqPct: Math.round((b.required_level / max) * 100),
      curPct: Math.round((b.current_level / max) * 100),
    }));
  }, [resp]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SectionTitle
        kicker="AI skill-gap engine"
        title="Where you stand vs your dream career"
        sub="Pick a target career. The engine compares required vs current levels, explains every gap, estimates prep time, and builds a sequenced learning path with matched gigs."
      />

      {/* Career picker */}
      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {careers.map((c) => (
          <button
            key={c.id}
            onClick={() => { setCareerId(c.id); analyze(c.id); }}
            className={`rounded-2xl border-2 p-4 text-left transition ${activeId === c.id ? 'border-[#0d7a5f] bg-white card-shadow' : 'border-[#e5dcc3] bg-white/70 hover:border-[#0d7a5f]'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="h-2.5 w-8 rounded-full" style={{ background: c.color }} />
              <Chip color="#0d7a5f">Demand {c.demand_index}</Chip>
            </div>
            <p className="mt-1.5 font-display text-[16px] font-bold text-[#07382c]">{c.title}</p>
            <p className="text-xs font-semibold text-[#5a6a62]">{c.avg_stipend} · {c.growth}</p>
          </button>
        ))}
      </div>

      {loading || busy ? (
        <div className="rounded-2xl border border-[#e5dcc3] bg-white p-8 card-shadow">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#0d7a5f]"><ScanSearch className="animate-pulse" size={18} /> AI is mapping your skills…</div>
          <div className="h-4 rounded-full bg-[#f1e9d2] shimmer" />
          <div className="mt-2 h-4 w-2/3 rounded-full bg-[#f1e9d2] shimmer" />
        </div>
      ) : err ? (
        <Empty title="Analysis failed" sub={err} />
      ) : resp && career ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Score + map */}
          <div className="rounded-2xl bg-[#07382c] p-5 text-white card-shadow-lg">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#f5d48a]"><Sparkles size={13} /> AI readiness for this role</p>
            <div className="mt-3 flex items-center gap-4">
              <MatchRing score={resp.score} size={92} />
              <div>
                <p className="font-display text-xl font-bold leading-tight">{career.title}</p>
                <p className="text-xs text-[#cfe6da]">{resp.score >= 80 ? 'Eligible — apply now' : resp.score >= 55 ? 'Nearly eligible — short sprint left' : 'Foundation phase — follow the path below'}</p>
                <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-[#f5d48a]"><Clock3 size={13} /> ~{resp.estimated_hours} hrs · {resp.estimated_weeks} week{resp.estimated_weeks > 1 ? 's' : ''} to eligibility</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2.5">
              {radar.map((r) => (
                <div key={r.skill}>
                  <div className="mb-1 flex justify-between text-[11px] font-bold">
                    <span>{r.skill}</span>
                    <span className="text-[#f5d48a]">{r.curPct}% / need {r.reqPct}%</span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-white/15">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${r.reqPct}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-[#f5a623]" style={{ width: `${r.curPct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-[#cfe6da]">
              <span className="inline-block h-2 w-4 rounded-full bg-[#f5a623]" /> You
              <span className="ml-2 inline-block h-2 w-4 rounded-full bg-white/30" /> Required
            </div>
          </div>

          {/* Gap detail */}
          <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#0d7a5f]"><Target size={13} /> Skill-by-skill breakdown</p>
            <div className="grid gap-2.5">
              {resp.breakdown.map((b) => (
                <div key={b.skill} className="rounded-xl bg-[#faf7ef] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-[#07382c]">{b.skill} {b.verified && <span className="text-[10px] font-black text-[#0d7a5f]">✓ VERIFIED</span>}</p>
                    {b.gap === 0
                      ? <Chip color="#0d7a5f">Covered</Chip>
                      : <Chip color="#e8930c">Gap: L{b.current_level} → L{b.required_level}</Chip>}
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {[1, 2, 3, 4, 5].map((l) => (
                      <span key={l} className="h-1.5 flex-1 rounded-full" style={{ background: l <= b.current_level ? '#0d7a5f' : l <= b.required_level ? '#f5c86e' : '#e7dcc0' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {resp.missing.length > 0 && (
              <div className="mt-3 rounded-xl border border-[#e8930c66] bg-[#fef6e7] p-3 text-[13px] text-[#6b4a08]">
                <b>Why these gaps matter:</b> employers hiring for “{career.title}” filter first on {resp.missing.slice(0, 2).map((m) => m.skill).join(' + ')}. Close one gap and your match scores jump 10–20 points across {opportunities.filter((o) => o.status === 'open').length} open roles.
              </div>
            )}
          </div>

          {/* Learning path */}
          <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#0d7a5f]"><BookOpenCheck size={13} /> Your personalised path · {resp.estimated_weeks} weeks</p>
            <div className="relative grid gap-0">
              {resp.missing.slice(0, 3).map((m, i) => {
                const courseHit = resp.recommended_courses[i] ?? resp.recommended_courses[0];
                return (
                  <div key={m.skill} className="relative pb-4 pl-7 last:pb-0">
                    <span className="absolute left-0 top-0 grid h-5 w-5 place-items-center rounded-full bg-[#0d7a5f] text-[10px] font-black text-white">{i + 1}</span>
                    {i < Math.min(3, resp.missing.length) - 1 && <span className="absolute bottom-0 left-[9px] top-5 w-0.5 bg-[#e5dcc3]" />}
                    <p className="text-[13px] font-bold text-[#07382c]">Week {i + 1}: Close “{m.skill}”</p>
                    <p className="text-xs text-[#5a6a62]">Level {m.current_level} → {m.required_level} · ~{m.required_level - m.current_level === 0 ? 4 : (m.required_level - m.current_level) * 9} hrs of focused work</p>
                    {courseHit && <p className="mt-0.5 text-xs font-semibold text-[#0d7a5f]">📘 {courseHit.title} ({courseHit.provider})</p>}
                  </div>
                );
              })}
              {resp.missing.length === 0 && <p className="text-sm font-semibold text-[#0d7a5f]">🎉 No gaps — you're eligible. Apply to the matched gigs below.</p>}
              <div className="relative pb-1 pl-7 pt-1">
                <span className="absolute left-0 top-1 grid h-5 w-5 place-items-center rounded-full bg-[#e8930c] text-white"><CalendarCheck size={12} /></span>
                <p className="text-[13px] font-bold text-[#07382c]">Week {Math.min(4, resp.estimated_weeks + 1)}: Ship proof of work</p>
                <p className="text-xs text-[#5a6a62]">Take a same-day task or micro-internship below to convert the new skill into a verified credential.</p>
              </div>
            </div>

            <p className="mb-2 mt-4 text-[11px] font-black uppercase tracking-widest text-[#0d7a5f]"><TrendingUp size={12} className="mr-1 inline" /> Recommended courses</p>
            <div className="grid gap-2">
              {(resp.recommended_courses.length ? resp.recommended_courses : courses.slice(0, 3)).map((c) => (
                <div key={c.id} className="rounded-xl border border-[#ece2c8] bg-[#fffdf6] p-2.5 text-[13px]">
                  <p className="font-bold text-[#07382c]">{c.title}</p>
                  <p className="text-xs text-[#5a6a62]">{c.provider} · {c.duration} · ⭐ {c.rating} {c.free ? '· Free' : ''}</p>
                </div>
              ))}
            </div>

            <p className="mb-2 mt-4 text-[11px] font-black uppercase tracking-widest text-[#0d7a5f]">Gigs that build these exact skills</p>
            <div className="grid gap-2">
              {resp.recommended_opportunities.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#faf7ef] p-2.5 text-[13px]">
                  <span><b className="text-[#07382c]">{o.title}</b><br /><span className="text-xs text-[#5a6a62]">{o.stipend} · {Math.round(o.overlap * 100)}% skill overlap</span></span>
                  <a href="/opportunities" className="shrink-0 rounded-lg bg-[#0d7a5f] px-3 py-1.5 text-xs font-bold text-white">View</a>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* current skills strip */}
      <div className="mt-6 rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-[#0d7a5f]">Your verified skill map (inputs to the engine)</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {mySkills.map((s) => <SkillBar key={s.id} name={s.skill_name} pct={s.proficiency_pct} verified={s.verified} />)}
        </div>
        <p className="mt-3 flex items-start gap-1 text-xs text-[#5a6a62]"><ChevronRight size={13} className="mt-0.5 shrink-0" /> Levels derive from proficiency: L{1}–L5 ≈ 0–100%. Verified badges come from college/company endorsements and completed gigs.</p>
        <p className="mt-1 text-xs text-[#5a6a62]">Debug: L{mySkills.length ? levelOf(mySkills[0].proficiency_pct) : 0} sample mapping active · engine v1 (weighted coverage scoring).</p>
      </div>
    </div>
  );
}
