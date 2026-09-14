import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ScanSearch, Map, Trophy, ShieldCheck, ArrowRight, Briefcase, Clock, ChevronRight, Sparkles, Building2, GraduationCap, Landmark } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { oppTypeMeta, matchForOpportunity } from '../lib/engine';
import { SectionTitle, Stat, Chip, MatchRing } from '../components/ui';
import OpportunityCard from '../components/OpportunityCard';
import CareerMatchSection from '../components/CareerMatchSection';

const fade = { initial: { opacity: 0, y: 22 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' } };

export default function Home() {
  const { overview, opportunities, mySkills, demand, placements, careers, student } = useApp();
  const { isAuthed } = useAuth();
  const instant = opportunities.filter((o) => o.urgency === 'instant' && o.status === 'open');
  const topMatched = [...opportunities.filter((o) => o.status === 'open')]
    .map((o) => ({ o, s: matchForOpportunity(mySkills, o).score }))
    .sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.o);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#07382c] text-white">
        <div className="hero-pattern absolute inset-0" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#0d7a5f] blur-3xl opacity-60" />
        <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-[#e8930c] blur-3xl opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#f5d48a] ring-1 ring-white/20">
                  <Sparkles size={12} /> Ministry of Ayush · AIIA
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8930c] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white">
                  <Zap size={12} strokeWidth={3} /> {overview?.instant_count ?? 0} instant gigs live
                </span>
              </div>
              <h1 className="font-display text-4xl font-black leading-[1.05] sm:text-5xl lg:text-[3.4rem]">
                Turn classroom skills into <span className="text-[#f5a623]">verified real-world</span> experience.
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#cfe6da]">
                SkillSetu is the AI-powered Academia–Industry Career Bridge: build a verified skill profile, get an AI skill-gap analysis for your dream career, and grab <b className="text-white">INSTANT OPPORTUNITIES</b> — same-day tasks, micro-internships and jobs matched to your skills with a transparent match score.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {!isAuthed && (
                  <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-[#07382c] shadow-lg transition hover:bg-[#efe7d2]">
                    Sign in / Sign up <ArrowRight size={16} />
                  </Link>
                )}
                <Link to="/opportunities" className="inline-flex items-center gap-2 rounded-xl bg-[#f5a623] px-5 py-3 text-sm font-black text-[#07382c] shadow-lg transition hover:bg-[#ffbe45]">
                  <Zap size={16} strokeWidth={2.8} /> Find instant work <ArrowRight size={16} />
                </Link>
                <Link to="/map" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-[#07382c] shadow-lg transition hover:bg-[#efe7d2]">
                  <Map size={16} /> Live job map
                </Link>
                <Link to="/skill-gap" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/20">
                  <ScanSearch size={16} /> AI skill-gap analysis
                </Link>
              </div>
              <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
                {[
                  { v: `${overview?.students ?? 0}+`, l: 'Verified students' },
                  { v: `${overview?.companies ?? 0}`, l: 'Partner companies' },
                  { v: `${overview?.opportunities ?? 0}`, l: 'Live opportunities' },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                    <p className="font-display text-2xl font-black text-[#f5d48a]">{s.v}</p>
                    <p className="text-[11px] font-semibold text-[#cfe6da]">{s.l}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Instant ticker card */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
              <div className="rounded-3xl bg-[#faf7ef] p-5 text-[#07382c] card-shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#b97a06]">
                    <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-[#e8930c]" /> Instant · starts today
                  </p>
                  <Link to="/opportunities" className="text-xs font-bold text-[#0d7a5f] hover:underline">View all →</Link>
                </div>
                <div className="grid gap-2.5">
                  {instant.slice(0, 3).map((o) => (
                    <Link key={o.id} to="/opportunities" className="group flex items-center gap-3 rounded-2xl border border-[#e5dcc3] bg-white p-3 transition hover:border-[#e8930c]">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8930c] text-white"><Zap size={18} strokeWidth={2.6} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold">{o.title}</span>
                        <span className="block text-[11px] font-semibold text-[#5a6a62]">{o.stipend} · {o.starts_in}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-[#b3a87f] transition group-hover:translate-x-0.5 group-hover:text-[#e8930c]" />
                    </Link>
                  ))}
                  {instant.length === 0 && <p className="text-sm text-gray-500">No instant gigs right now — check back soon.</p>}
                </div>
                <div className="mt-3 rounded-2xl bg-[#07382c] p-3.5 text-white">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#f5d48a]">How matching works</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#d7e9df]">Every card shows a <b>match score</b> with a plain-language explanation — what you have, what's missing, how to prepare, and how long eligibility takes.</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        {/* marquee */}
        <div className="relative border-t border-white/10 bg-[#062e24] py-2.5 overflow-hidden">
          <div className="marquee flex w-max gap-8 whitespace-nowrap text-[12px] font-bold uppercase tracking-widest text-[#9fc3b2]">
            {[0, 1].map((k) => (
              <span key={k} className="flex gap-8">
                <span>⚡ Same-day tasks</span><span>·</span><span>Micro-internships</span><span>·</span><span>Verified skills</span><span>·</span><span>AI skill-gap engine</span><span>·</span><span>Career readiness score</span><span>·</span><span>Industry challenges</span><span>·</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 6 opportunity types */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <motion.div {...fade}>
          <SectionTitle kicker="Instant opportunity system" title="Six ways to start earning experience" sub="Not just 6-month internships — pick work that fits your timetable, from a task you finish tonight to a full-time placement." />
        </motion.div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { key: 'internship', icon: Briefcase, blurb: 'Classic 4–24 week guided programs with mentors and PPO tracks.' },
            { key: 'micro-internship', icon: Zap, blurb: '1–4 week outcome-based sprints. Perfect between semesters.' },
            { key: 'same-day-task', icon: Clock, blurb: 'Real company tasks — landing pages, bug fixes, reels. Start today, get paid on delivery.' },
            { key: 'part-time', icon: Clock, blurb: 'Async-friendly paid roles alongside classes, ~15 hrs/week.' },
            { key: 'full-time', icon: Trophy, blurb: 'Final placements and associate roles with verified-skill fast lanes.' },
            { key: 'challenge', icon: Trophy, blurb: 'National competitions judged by industry + AIIA certification.' },
          ].map((t, i) => {
            const meta = oppTypeMeta(t.key);
            const count = opportunities.filter((o) => o.type === t.key && o.status === 'open').length;
            const Icon = t.icon;
            return (
              <motion.div key={t.key} {...fade} transition={{ delay: i * 0.04 }}>
                <Link to={`/opportunities?type=${t.key}`} className="group flex h-full items-start gap-3 rounded-2xl border border-[#e5dcc3] bg-white p-4 card-shadow transition hover:-translate-y-1 hover:card-shadow-lg">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: meta.color }}><Icon size={20} /></span>
                  <span>
                    <span className="flex items-center gap-2 font-bold text-[#07382c]">{meta.label}
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-black text-white" style={{ background: meta.color }}>{count} live</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-[#5a6a62]">{t.blurb}</span>
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Top matches for you */}
      <section className="border-y border-[#e5dcc3] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <motion.div {...fade}>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#0d7a5f]">Personalised for {student?.name.split(' ')[0] ?? 'you'}</p>
                <h2 className="font-display text-2xl font-bold text-[#07382c] sm:text-3xl">Your top skill-matches right now</h2>
              </div>
              <div className="flex gap-2">
                <Link to="/map" className="inline-flex items-center gap-1 rounded-xl border-2 border-[#0d7a5f] px-4 py-2 text-sm font-bold text-[#0d7a5f] transition hover:bg-[#0d7a5f] hover:text-white"><Map size={15} /> Job map</Link>
                <Link to="/opportunities" className="inline-flex items-center gap-1 rounded-xl bg-[#0d7a5f] px-4 py-2 text-sm font-bold text-white hover:bg-[#0b6a52]">Browse all <ArrowRight size={15} /></Link>
              </div>
            </div>
          </motion.div>
          <div className="grid gap-4 lg:grid-cols-3">
            {topMatched.map((o) => <OpportunityCard key={o.id} opp={o} skills={mySkills} compact />)}
          </div>
          {/* Map teaser */}
          <Link to="/map" className="group mt-6 flex flex-col items-center gap-4 overflow-hidden rounded-2xl bg-[#07382c] p-6 text-white card-shadow-lg sm:flex-row">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#f5a623] text-[#07382c]"><Map size={26} /></span>
            <span className="flex-1 text-center sm:text-left">
              <span className="block text-[11px] font-black uppercase tracking-widest text-[#f5d48a]">New · real-time job map</span>
              <span className="font-display block text-xl font-bold">See every opportunity plotted live across India — tap a pin for full details.</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-[#07382c] transition group-hover:bg-[#f5d48a]">Open live map <ArrowRight size={15} /></span>
          </Link>
        </div>
      </section>

      {/* Career match: mediator-backed verified jobs, skill verification & gaps */}
      {isAuthed && <CareerMatchSection />}

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <motion.div {...fade}>
          <SectionTitle kicker="How SkillSetu works" title="From classroom to career in four steps" />
        </motion.div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: ShieldCheck, t: '1 · Verify your skills', d: 'Upload resume, certificates & projects. AI parses and extracts skills; colleges & companies verify them.' },
            { icon: ScanSearch, t: '2 · See your skill gap', d: 'Pick a target career. The AI engine maps required vs current skills, missing gaps and prep time.' },
            { icon: Map, t: '3 · Follow a learning path', d: 'Get courses, micro-projects and challenges sequenced into weeks — with XP and streaks.' },
            { icon: Zap, t: '4 · Grab instant work', d: 'Apply in one click to same-day tasks and internships, matched with transparent scores.' },
          ].map((s, i) => (
            <motion.div key={s.t} {...fade} transition={{ delay: i * 0.06 }} className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[#0d7a5f] text-white"><s.icon size={20} /></span>
              <p className="font-bold text-[#07382c]">{s.t}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#5a6a62]">{s.d}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#07382c] p-5 text-white"><Stat label="Avg. career readiness" value={`${overview?.avg_readiness ?? 0}/100`} /></div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Applications via bridge" value={`${overview?.applications ?? 0}`} accent="#0d7a5f" />
            <Stat label="Open roles" value={`${overview?.open_count ?? 0}`} accent="#2563eb" />
          </div>
          <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
            <p className="text-xs font-black uppercase tracking-widest text-[#0d7a5f]">Hottest skills in demand</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {demand.slice(0, 6).map((d) => <Chip key={d.id} color="#0d7a5f">{d.skill_name} · {d.demand_score}</Chip>)}
            </div>
          </div>
        </div>
      </section>

      {/* Role entry */}
      <section className="border-t border-[#e5dcc3] bg-[#efe7d2]/50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <motion.div {...fade}>
            <SectionTitle kicker="Built for everyone" title="One bridge, four dashboards" />
          </motion.div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { to: '/company', icon: Building2, t: 'Companies', d: isAuthed ? 'Post same-day tasks & internships, rank applicants by skill-match, verify skills with one click.' : 'Sign in as a company to post tasks, rank applicants by skill-match and verify skills.', c: '#2563eb' },
              { to: '/college', icon: GraduationCap, t: 'Colleges', d: isAuthed ? 'Industry Skill Demand dashboard, placement outcomes, curriculum gap alerts.' : 'Sign in as a college to see demand data, placement outcomes and curriculum alerts.', c: '#7c3aed' },
              { to: '/ministry', icon: Landmark, t: 'Ministry of Ayush', d: isAuthed ? 'National readiness heatmap, demand vs supply, scheme impact across institutions.' : 'Sign in as ministry to see the national readiness picture across institutions.', c: '#e8930c' },
            ].map((r, i) => (
              <motion.div key={r.t} {...fade} transition={{ delay: i * 0.06 }}>
                <Link to={isAuthed ? r.to : '/login'} className="group block h-full rounded-2xl bg-[#07382c] p-6 text-white card-shadow-lg transition hover:-translate-y-1">
                  <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: r.c }}><r.icon size={20} /></span>
                  <p className="font-display text-xl font-bold">{r.t}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#cfe6da]">{r.d}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#f5d48a]">{isAuthed ? 'Open dashboard' : 'Sign in to continue'} <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* placements strip */}
          <div className="mt-8 rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-[#0d7a5f]">Recent wins via the bridge</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {placements.slice(0, 3).map((p) => (
                <div key={p.id} className="rounded-xl bg-[#faf7ef] p-3 text-[13px]">
                  <p className="font-bold text-[#07382c]">{p.student_name} → {p.company_name}</p>
                  <p className="text-[#5a6a62]">{p.role_title} · {p.package_text}</p>
                  <Chip color="#0d7a5f">{p.via}</Chip>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {careers.slice(0, 6).map((c) => (
                <Link key={c.id} to="/skill-gap" className="rounded-full border border-[#d8cdae] bg-white px-3 py-1 text-xs font-bold text-[#07382c] hover:border-[#0d7a5f]">🎯 {c.title}</Link>
              ))}
            </div>
          </div>

          {/* Match preview */}
          {topMatched[0] && (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-r from-[#e8930c] to-[#f5a623] p-6 text-center text-white sm:flex-row sm:text-left">
              <MatchRing score={matchForOpportunity(mySkills, topMatched[0]).score} size={72} />
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-widest opacity-90">Why you're matched</p>
                <p className="font-display text-lg font-bold leading-snug">“{matchForOpportunity(mySkills, topMatched[0]).explanation[0]}”</p>
              </div>
              <Link to="/opportunities" className="rounded-xl bg-white px-5 py-2.5 text-sm font-black text-[#b97a06]">Claim it now</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
