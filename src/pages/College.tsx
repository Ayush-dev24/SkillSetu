import { useMemo } from 'react';
import { GraduationCap, TrendingDown, CircleAlert, Trophy, Briefcase } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SectionTitle, Stat, Chip, SkillBar } from '../components/ui';

function Bar({ label, value, max, color, sub }: { label: string; value: number; max: number; color: string; sub?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[13px]">
        <span className="font-bold text-[#07382c]">{label}</span>
        <span className="font-black" style={{ color }}>{value}{sub ?? ''}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#eee5cf]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export default function College() {
  const { demand, placements, students, allSkills, opportunities, careers } = useApp();

  const avgBySkill = useMemo(() => {
    const map: Record<string, { sum: number; n: number }> = {};
    allSkills.forEach((s) => {
      const k = s.skill_name;
      map[k] = map[k] ?? { sum: 0, n: 0 };
      map[k].sum += s.proficiency_pct; map[k].n += 1;
    });
    return Object.entries(map).map(([name, v]) => ({ name, avg: Math.round(v.sum / v.n) }));
  }, [allSkills]);

  const gaps = useMemo(() => {
    return demand.map((d) => {
      const mine = avgBySkill.find((a) => a.name.toLowerCase() === d.skill_name.toLowerCase());
      const supply = mine?.avg ?? 25;
      return { ...d, supply, gap: d.demand_score - supply };
    }).sort((a, b) => b.gap - a.gap);
  }, [demand, avgBySkill]);

  const topGaps = gaps.slice(0, 6);
  const viaCounts = useMemo(() => {
    const m: Record<string, number> = {};
    placements.forEach((p) => { m[p.via] = (m[p.via] ?? 0) + 1; });
    return Object.entries(m);
  }, [placements]);

  const readinessAvg = students.length ? Math.round(students.reduce((s, x) => s + x.readiness_score, 0) / students.length) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SectionTitle kicker="College insights · AIIA" title="Industry Skill Demand Dashboard"
        sub="Live demand pulled from open postings vs your students' verified supply. Close the biggest gaps first — each alert maps to a concrete curriculum action." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students on bridge" value={`${students.length}`} accent="#0d7a5f" />
        <Stat label="Avg. readiness" value={`${readinessAvg}/100`} accent="#2563eb" />
        <Stat label="Open industry roles" value={`${opportunities.filter((o) => o.status === 'open').length}`} accent="#e8930c" />
        <Stat label="Placements tracked" value={`${placements.length}`} accent="#7c3aed" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Demand vs supply */}
        <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
          <p className="mb-1 flex items-center gap-1.5 font-bold text-[#07382c]"><TrendingDown size={17} className="text-[#dc2626]" /> Demand vs student supply (top gaps)</p>
          <p className="mb-4 text-[13px] text-[#5a6a62]">Teal = industry demand · amber = current student supply. The wider the split, the more urgent the curriculum fix.</p>
          <div className="grid gap-3">
            {topGaps.map((g) => (
              <div key={g.id}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="font-bold text-[#07382c]">{g.skill_name} <span className="ml-1 rounded-full bg-[#dc262614] px-2 py-0.5 text-[10px] font-black text-[#dc2626]">GAP {g.gap}</span></span>
                  <span className="text-xs font-bold text-[#5a6a62]">D {g.demand_score} · S {g.supply}</span>
                </div>
                <div className="relative h-3.5 overflow-hidden rounded-full bg-[#eee5cf]">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-[#0d7a5f]" style={{ width: `${g.demand_score}%` }} />
                  <div className="absolute inset-y-[3px] left-0 rounded-full bg-[#f5a623]" style={{ width: `${g.supply}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 text-[11px] font-bold text-[#5a6a62]">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-[#0d7a5f]" /> Demand</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-[#f5a623]" /> Supply</span>
          </div>
        </div>

        {/* Curriculum alerts */}
        <div className="rounded-2xl bg-[#07382c] p-5 text-white card-shadow-lg">
          <p className="mb-3 flex items-center gap-1.5 font-bold"><CircleAlert size={17} className="text-[#f5a623]" /> Curriculum action alerts</p>
          <div className="grid gap-2.5">
            {topGaps.slice(0, 4).map((g, i) => (
              <div key={g.id} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
                <p className="text-[13px] font-bold text-[#f5d48a]">P{i + 1} · Add “{g.skill_name}” sprint</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-[#d7e9df]">
                  Demand {g.demand_score} vs supply {g.supply}. {g.openings} open roles pay {g.avg_stipend_boost} more.
                  Action: 2-week {g.skill_name} module + one {g.category.toLowerCase()} micro-internship for final-years.
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-[#f5a623] p-3 text-[13px] font-bold text-[#07382c]">
            Projected outcome: closing the top 3 gaps lifts avg. readiness {readinessAvg} → {Math.min(96, readinessAvg + 14)} and unlocks ~{gaps.slice(0, 3).reduce((s, g) => s + g.openings, 0)} matched roles.
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Supply detail */}
        <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
          <p className="mb-3 font-bold text-[#07382c]">Verified supply by skill</p>
          <div className="grid max-h-[300px] gap-2 overflow-y-auto pr-1">
            {avgBySkill.sort((a, b) => b.avg - a.avg).map((a) => <SkillBar key={a.name} name={a.name} pct={a.avg} small />)}
          </div>
        </div>

        {/* Placement outcomes */}
        <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
          <p className="mb-3 flex items-center gap-1.5 font-bold text-[#07382c]"><Briefcase size={16} className="text-[#0d7a5f]" /> Placement outcomes</p>
          <div className="grid gap-2">
            {placements.map((p) => (
              <div key={p.id} className="rounded-xl bg-[#faf7ef] p-2.5 text-[13px]">
                <p className="font-bold text-[#07382c]">{p.student_name} → {p.company_name}</p>
                <p className="text-[#5a6a62]">{p.role_title} · {p.package_text} · {p.year}</p>
                <Chip color="#0d7a5f">{p.via}</Chip>
              </div>
            ))}
          </div>
          <p className="mb-1 mt-3 text-xs font-black uppercase tracking-widest text-[#0d7a5f]">Conversion channel</p>
          <div className="grid gap-1.5">
            {viaCounts.map(([k, v]) => <Bar key={k} label={k} value={v} max={Math.max(...viaCounts.map((x) => x[1]))} color="#7c3aed" />)}
          </div>
        </div>

        {/* Career demand */}
        <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
          <p className="mb-3 flex items-center gap-1.5 font-bold text-[#07382c]"><Trophy size={16} className="text-[#e8930c]" /> Career tracks by demand</p>
          <div className="grid gap-2.5">
            {careers.map((c) => <Bar key={c.id} label={c.title} value={c.demand_index} max={100} color={c.color} sub="/100" />)}
          </div>
          <div className="mt-4 rounded-xl bg-[#effaf4] p-3 text-[13px] text-[#095844]">
            <b className="flex items-center gap-1"><GraduationCap size={14} /> Dean's takeaway:</b>
            Digital-health skills (React, Frontend, Data) now outrank several classical skills in posting volume.
            Recommend a compulsory “Ayush × Digital” bridge semester.
          </div>
        </div>
      </div>
    </div>
  );
}
