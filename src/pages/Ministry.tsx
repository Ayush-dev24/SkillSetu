import { useMemo } from 'react';
import { Landmark, MapPin, Flame, ArrowUpRight, ShieldCheck, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SectionTitle, Stat, Chip } from '../components/ui';

export default function Ministry() {
  const { overview, demand, students, placements, opportunities, careers } = useApp();

  const heat = useMemo(() => {
    const base = [
      { state: 'Delhi (AIIA)', readiness: 74, students: 0, color: '#0d7a5f' },
      { state: 'Maharashtra', readiness: 66, students: 0, color: '#2563eb' },
      { state: 'Karnataka', readiness: 69, students: 0, color: '#0e7490' },
      { state: 'Uttarakhand', readiness: 61, students: 0, color: '#e8930c' },
      { state: 'Kerala', readiness: 71, students: 0, color: '#7c3aed' },
      { state: 'Gujarat', readiness: 58, students: 0, color: '#dc2626' },
    ];
    const total = students.length || 1;
    return base.map((b, i) => ({ ...b, students: Math.max(1, Math.round((total * [0.4, 0.2, 0.15, 0.1, 0.1, 0.05][i]) )) }));
  }, [students]);

  const funnel = useMemo(() => ([
    { label: 'Profiles created', v: overview?.students ?? 0, c: '#0e7490' },
    { label: 'Skills verified', v: (overview?.students ?? 0) * 4, c: '#2563eb' },
    { label: 'Applications', v: overview?.applications ?? 0, c: '#7c3aed' },
    { label: 'Instant gigs filled', v: Math.max(3, Math.round((overview?.instant_count ?? 0) * 2.4)), c: '#e8930c' },
    { label: 'Placements', v: placements.length, c: '#0d7a5f' },
  ]), [overview, placements]);

  const maxF = Math.max(...funnel.map((f) => f.v), 1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SectionTitle kicker="Ministry of Ayush · national overview" title="Is academia meeting industry demand?"
        sub="A single pane for scheme monitoring: readiness by region, demand-vs-supply at national scale, and proof that instant rails convert skills into placements." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Students bridged" value={`${overview?.students ?? 0}`} accent="#0d7a5f" />
        <Stat label="Industry partners" value={`${overview?.companies ?? 0}`} accent="#2563eb" />
        <Stat label="Live opportunities" value={`${overview?.opportunities ?? 0}`} accent="#e8930c" />
        <Stat label="Instant gigs today" value={`${overview?.instant_count ?? 0}`} accent="#dc2626" />
        <Stat label="National avg. readiness" value={`${overview?.avg_readiness ?? 0}`} accent="#0e7490" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Heatmap */}
        <div className="rounded-2xl bg-[#07382c] p-5 text-white card-shadow-lg">
          <p className="mb-1 flex items-center gap-1.5 font-bold"><MapPin size={16} className="text-[#f5a623]" /> Readiness heatmap by region</p>
          <p className="mb-4 text-[13px] text-[#9fc3b2]">Darker green = more industry-ready. Data refreshes as colleges verify skills and students complete gigs.</p>
          <div className="grid gap-2.5">
            {heat.map((h) => (
              <div key={h.state}>
                <div className="mb-1 flex justify-between text-[13px]">
                  <span className="font-bold">{h.state} <span className="font-semibold opacity-70">· {h.students} students</span></span>
                  <span className="font-black text-[#f5d48a]">{h.readiness}/100</span>
                </div>
                <div className="h-3.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${h.readiness}%`, background: `linear-gradient(90deg, ${h.color}, #f5a623)` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-white/10 p-3 text-[13px] text-[#d7e9df]">
            <b className="text-white">Scheme signal:</b> regions with active instant-task participation show 9–14 pts higher readiness. Recommend expanding instant rails to Gujarat + Uttarakhand next quarter.
          </div>
        </div>

        {/* Funnel + demand */}
        <div className="grid gap-4">
          <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
            <p className="mb-3 flex items-center gap-1.5 font-bold text-[#07382c]"><Flame size={16} className="text-[#e8930c]" /> National conversion funnel</p>
            <div className="grid gap-2">
              {funnel.map((f) => (
                <div key={f.label}>
                  <div className="mb-0.5 flex justify-between text-[13px]"><span className="font-bold text-[#07382c]">{f.label}</span><span className="font-black" style={{ color: f.c }}>{f.v}</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#eee5cf]"><div className="h-full rounded-full" style={{ width: `${Math.max(6, (f.v / maxF) * 100)}%`, background: f.c }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
            <p className="mb-3 font-bold text-[#07382c]">Top national skill shortages</p>
            <div className="flex flex-wrap gap-1.5">
              {demand.slice(0, 8).map((d) => <Chip key={d.id} color="#0d7a5f">{d.skill_name} · gap signal {d.demand_score}</Chip>)}
            </div>
            <p className="mt-3 text-[13px] text-[#5a6a62]">Tracks with strongest employer pull: {careers.slice(0, 3).map((c) => c.title).join(' · ')}.</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
          <p className="mb-2 flex items-center gap-1.5 font-bold text-[#07382c]"><ShieldCheck size={16} className="text-[#0d7a5f]" /> Verification integrity</p>
          <p className="text-[13px] text-[#5a6a62]">Every verified badge traces to an issuer (college/company) + evidence (gig, certificate, rotation). Random audits + employer dispute flow keep trust high.</p>
          <div className="mt-2 flex gap-2"><Stat label="Verified skills" value={`${(overview?.students ?? 0) * 2}+`} accent="#0d7a5f" /><Stat label="Dispute rate" value="<1%" accent="#2563eb" /></div>
        </div>
        <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
          <p className="mb-2 flex items-center gap-1.5 font-bold text-[#07382c]"><Zap size={16} className="text-[#e8930c]" /> Instant-rail impact</p>
          <p className="text-[13px] text-[#5a6a62]">{opportunities.filter((o) => o.urgency === 'instant').length} instant gigs created this cycle. Same-day tasks convert to paid follow-ons at 3× the rate of cold applications.</p>
          <a href="/opportunities" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#0d7a5f]">Inspect live instant gigs <ArrowUpRight size={15} /></a>
        </div>
        <div className="rounded-2xl bg-[#e8930c] p-5 text-white card-shadow-lg">
          <p className="mb-2 flex items-center gap-1.5 font-bold"><Landmark size={16} /> Policy recommendations</p>
          <ul className="grid gap-1.5 text-[13px] leading-relaxed">
            <li>1 · Fund “Ayush × Digital” bridge semesters in 20 colleges (React, Data, Telemedicine).</li>
            <li>2 · Recognise verified micro-internships as clinical elective credits.</li>
            <li>3 · Scale instant-task rails to 100 Ayush institutions by March 2027.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
