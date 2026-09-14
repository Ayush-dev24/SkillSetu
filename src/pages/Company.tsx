import { useMemo, useState } from 'react';
import { Building2, PlusCircle, Users, ShieldCheck, ChevronRight, X, Search, UserCheck, Filter, X as XIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { apiSend, apiGet, matchColor, levelOf } from '../lib/engine';
import { SectionTitle, Chip, Empty, Stat } from '../components/ui';

const TYPES = ['internship', 'micro-internship', 'same-day-task', 'part-time', 'full-time', 'challenge'];

export default function Company() {
  const { companies, opportunities, applications, students, allSkills, refresh } = useApp();
  const { profile, authToken } = useAuth();
  const [companyId, setCompanyId] = useState(5);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [filterOpp, setFilterOpp] = useState<string | number | null>(null);
  const [companySearch, setCompanySearch] = useState('');
  const [activeTab, setActiveTab] = useState<'postings' | 'find' | 'applicants'>('postings');
  const [findFilters, setFindFilters] = useState({
    skills: '',
    location: '',
    minReadiness: '',
    maxReadiness: '',
    college: '',
    search: '',
  });
  const [findStudents, setFindStudents] = useState<any[]>([]);
  const [findLoading, setFindLoading] = useState(false);
  const [form, setForm] = useState({
    title: '', type: 'same-day-task', domain: 'Web Development', location: 'Remote',
    stipend: '₹2,000 fixed', duration: '1 day', urgency: 'instant',
    starts_in: 'Today', skills_required: '', description: '', openings: 2,
  });

  const co = companies.find((c) => c.id === companyId) ?? companies[0];
  const mine = useMemo(() => opportunities.filter((o) => o.company_id === (co?.id ?? companyId)), [opportunities, co, companyId]);

  const pipeline = useMemo(() => {
    const ids = new Set((filterOpp ? mine.filter((m) => m.id === filterOpp) : mine).map((m) => m.id));
    return applications
      .filter((a) => ids.has(a.opportunity_id))
      .map((a) => {
        const st = students.find((s) => s.id === a.student_id);
        const opp = opportunities.find((o) => o.id === a.opportunity_id);
        const sk = allSkills.filter((s) => s.student_id === a.student_id);
        const overlap = opp?.skills_required?.length
          ? opp.skills_required.filter((r) => sk.some((k) => k.skill_name.toLowerCase() === String(r).toLowerCase())).length / opp.skills_required.length
          : 0;
        return { a, st, opp, overlap };
      })
      .sort((x, y) => y.a.match_score - x.a.match_score);
  }, [applications, mine, filterOpp, students, opportunities, allSkills]);

  const post = async () => {
    if (!form.title.trim() || !form.description.trim()) { setMsg('Title and task description are required.'); return; }
    setBusy(true); setMsg('');
    try {
      const token = await authToken();
      await apiSend('/api/opportunities', 'POST', {
        ...form, company_id: co.id, openings: Number(form.openings) || 1,
        remote: form.location.toLowerCase() === 'remote',
        color: co.color,
      }, token);
      await refresh();
      setMsg('Posted! Your opportunity is now live with instant skill-matching.');
      setShowForm(false);
      setForm({ title: '', type: 'same-day-task', domain: 'Web Development', location: 'Remote', stipend: '₹2,000 fixed', duration: '1 day', urgency: 'instant', starts_in: 'Today', skills_required: '', description: '', openings: 2 });
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Post failed'); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: number, status: string) => {
    try {
      const token = await authToken();
      await apiSend('/api/applications', 'PUT', { id, status }, token);
      await refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Status update failed'); }
  };

  const verifySkill = async (studentId: number, skillName: string) => {
    const rec = allSkills.find((s) => s.student_id === studentId && s.skill_name.toLowerCase() === skillName.toLowerCase());
    if (!rec) return;
    try {
      const token = await authToken();
      await apiSend('/api/student-skills', 'PUT', { id: rec.id, verified: true, source: `Verified by ${co?.name ?? 'company'}` }, token);
      await refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Verification failed'); }
  };

  const searchStudents = async () => {
    setFindLoading(true);
    try {
      const token = await authToken();
      const params = new URLSearchParams();
      Object.entries(findFilters).forEach(([k, v]) => {
        if (v) params.set(k, String(v));
      });
      params.set('limit', '50');
      const data = await apiGet<any[]>(`/api/students?${params.toString()}`, token);
      setFindStudents(data);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setFindLoading(false);
    }
  };

  const clearFindFilters = () => {
    setFindFilters({ skills: '', location: '', minReadiness: '', maxReadiness: '', college: '', search: '' });
    setFindStudents([]);
  };

  const renderStudentCard = (st: any) => {
    const sk = allSkills.filter((s) => s.student_id === st.id);
    return (
      <div key={st.id} className="rounded-xl border border-[#ece2c8] bg-[#fffdf6] p-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ background: st.avatar_color ?? '#0d7a5f' }}>{st.name.charAt(0)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-[#07382c]">{st.name} <span className="font-semibold text-[#5a6a62]">· {st.college}</span></p>
            <p className="truncate text-xs text-[#5a6a62]">{st.headline || 'Aspiring Ayush professional'}</p>
            <p className="truncate text-xs text-[#5a6a62]">{st.location} · Readiness: {st.readiness_score}/100</p>
          </div>
          <span className="shrink-0 text-lg font-black" style={{ color: matchColor(st.readiness_score) }}>{st.readiness_score}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sk.slice(0, 4).map((s) => (
            <Chip key={s.id} color={s.verified ? '#0d7a5f' : s.proficiency_pct >= 70 ? '#2563eb' : '#e8930c'}>{s.skill_name} {s.verified && '✓'}</Chip>
          ))}
          {sk.length > 4 && <Chip color="#8a978f">+{sk.length - 4} more</Chip>}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => setMsg(`Invite ${st.name} to apply — feature coming soon`)} className="rounded-lg bg-[#0d7a5f] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0b6a52]">Invite</button>
          <button onClick={() => setMsg(`View ${st.name}'s portfolio: ${st.portfolio_url || 'Not provided'}`)} className="rounded-lg border border-[#d8cdae] px-3 py-1.5 text-xs font-bold text-[#3c4a44] hover:border-[#0d7a5f]">Portfolio</button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SectionTitle kicker="Company studio" title="Hire verified Ayush talent in hours, not months"
        sub="Post anything from a tonight-sized bug fix to a 6-month internship. Applicants arrive pre-ranked by skill-match with transparent explanations." />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#e5dcc3] bg-white px-4 py-2.5 text-sm card-shadow">
        <ShieldCheck size={15} className="text-[#2563eb]" />
        <span className="font-bold text-[#07382c]">Signed in as {profile?.email ?? 'company'}</span>
        <span className="rounded-full bg-[#2563eb] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">Company</span>
      </div>

      <div className="mb-4 rounded-2xl border border-[#e5dcc3] bg-white p-3 card-shadow">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center gap-2 rounded-xl bg-[#faf7ef] px-3 py-2">
            <Search size={15} className="shrink-0 text-[#8a978f]" />
            <input value={companySearch} onChange={(e) => setCompanySearch(e.target.value)}
              placeholder={`Search ${companies.length} verified companies — from solo clinics to FMCG majors & unicorns…`}
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#a89e83]" />
          </label>
          <span className="shrink-0 rounded-full bg-[#0d7a5f] px-3 py-1.5 text-xs font-black text-white">{companies.length} on board</span>
        </div>
        <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
          <span className="text-xs font-bold text-[#5a6a62]">Posting as:</span>
          {companies
            .filter((c) => !companySearch.trim() || `${c.name} ${c.sector} ${c.location}`.toLowerCase().includes(companySearch.toLowerCase()))
            .map((c) => (
              <button key={c.id} onClick={() => setCompanyId(c.id)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${c.id === co?.id ? 'text-white' : 'border border-[#d8cdae] bg-white text-[#3c4a44] hover:border-[#0d7a5f]'}`}
                style={c.id === co?.id ? { background: c.color } : {}}>{c.name}</button>
            ))}
          {companySearch.trim() && companies.filter((c) => `${c.name} ${c.sector} ${c.location}`.toLowerCase().includes(companySearch.toLowerCase())).length === 0 && (
            <span className="text-xs font-semibold text-[#8a978f]">No company matches “{companySearch.trim()}” — clear the search to browse all.</span>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-[#e5dcc3] bg-white p-2 card-shadow">
        <button onClick={() => setActiveTab('postings')} className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === 'postings' ? 'bg-[#07382c] text-white' : 'bg-white text-[#3c4a44] hover:bg-[#f1e9d2]'}`}>
          <Building2 size={15} /> My Postings
        </button>
        <button onClick={() => { setActiveTab('find'); if (findStudents.length === 0) searchStudents(); }} className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === 'find' ? 'bg-[#07382c] text-white' : 'bg-white text-[#3c4a44] hover:bg-[#f1e9d2]'}`}>
          <UserCheck size={15} /> Find Students
        </button>
        <button onClick={() => setActiveTab('applicants')} className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === 'applicants' ? 'bg-[#07382c] text-white' : 'bg-white text-[#3c4a44] hover:bg-[#f1e9d2]'}`}>
          <Users size={15} /> Applicants ({pipeline.length})
        </button>
      </div>

      {activeTab === 'find' && (
        <div className="mb-6 rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
          <div className="mb-4 flex items-center gap-2">
            <UserCheck size={20} className="text-[#0d7a5f]" />
            <h3 className="font-display text-xl font-bold text-[#07382c]">Find suitable employees</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-[#3c4a44]">
              Skills (comma separated)
              <input value={findFilters.skills} onChange={(e) => setFindFilters({ ...findFilters, skills: e.target.value })} placeholder="Python, SQL, React" className="rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none focus:border-[#0d7a5f]" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-[#3c4a44]">
              Location
              <input value={findFilters.location} onChange={(e) => setFindFilters({ ...findFilters, location: e.target.value })} placeholder="e.g. Bengaluru, Remote" className="rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none focus:border-[#0d7a5f]" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-[#3c4a44]">
              College
              <input value={findFilters.college} onChange={(e) => setFindFilters({ ...findFilters, college: e.target.value })} placeholder="e.g. NIA" className="rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none focus:border-[#0d7a5f]" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-[#3c4a44]">
              Min Readiness Score
              <input type="number" min={0} max={100} value={findFilters.minReadiness} onChange={(e) => setFindFilters({ ...findFilters, minReadiness: e.target.value })} placeholder="e.g. 60" className="rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none focus:border-[#0d7a5f]" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-[#3c4a44]">
              Max Readiness Score
              <input type="number" min={0} max={100} value={findFilters.maxReadiness} onChange={(e) => setFindFilters({ ...findFilters, maxReadiness: e.target.value })} placeholder="e.g. 95" className="rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none focus:border-[#0d7a5f]" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-[#3c4a44]">
              Search text
              <input value={findFilters.search} onChange={(e) => setFindFilters({ ...findFilters, search: e.target.value })} placeholder="Name, headline, college" className="rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none focus:border-[#0d7a5f]" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={searchStudents} disabled={findLoading} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d7a5f] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0b6a52] disabled:opacity-50">
              <Search size={15} /> {findLoading ? 'Searching…' : 'Search Students'}
            </button>
            <button onClick={clearFindFilters} className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8cdae] px-4 py-2.5 text-sm font-bold text-[#3c4a44] hover:border-[#dc2626] hover:text-[#dc2626]">
              <XIcon size={14} /> Clear
            </button>
            <span className="ml-auto text-xs font-bold text-[#5a6a62]">{students.length} students on platform</span>
          </div>
        </div>
      )}

      {activeTab === 'find' && (
        <div className="grid gap-4 md:grid-cols-2">
          {findLoading ? (
            <div className="col-span-2 flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#e5dcc3] border-t-[#0d7a5f]" />
            </div>
          ) : findStudents.length === 0 ? (
            <div className="col-span-2">
              <Empty title="No students match these filters" sub="Try widening your search — clear filters to see all verified students." />
            </div>
          ) : (
            findStudents.map(renderStudentCard)
          )}
        </div>
      )}

      {activeTab !== 'find' && (
        <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl p-5 text-white card-shadow-lg" style={{ background: co?.color ?? '#0d7a5f' }}>
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest opacity-80"><Building2 size={13} /> Company profile</p>
          <p className="font-display mt-1 text-2xl font-bold">{co?.name}</p>
          <p className="text-[13px] opacity-90">{co?.sector} · {co?.location} · {co?.size_text} · ⭐ {co?.rating}</p>
          <p className="mt-2 text-[13px] leading-relaxed opacity-90">{co?.about}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/15 p-2"><p className="font-display text-xl font-black">{mine.length}</p><p className="text-[10px] font-bold uppercase">posts</p></div>
            <div className="rounded-xl bg-white/15 p-2"><p className="font-display text-xl font-black">{mine.reduce((s, o) => s + (o.applicants_count || 0), 0)}</p><p className="text-[10px] font-bold uppercase">applicants</p></div>
            <div className="rounded-xl bg-white/15 p-2"><p className="font-display text-xl font-black">{mine.filter((o) => o.urgency === 'instant').length}</p><p className="text-[10px] font-bold uppercase">instant</p></div>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-black" style={{ color: co?.color ?? '#0d7a5f' }}>
            {showForm ? <X size={16} /> : <PlusCircle size={16} />} {showForm ? 'Close composer' : 'Post an opportunity / task'}
          </button>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
          <p className="mb-3 flex items-center gap-1.5 font-bold text-[#07382c]"><Users size={17} className="text-[#0d7a5f]" /> Applicant pipeline · ranked by skill-match</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button onClick={() => setFilterOpp(null)} className={`rounded-full px-3 py-1 text-xs font-bold ${filterOpp === null ? 'bg-[#07382c] text-white' : 'bg-[#f1e9d2] text-[#6b6250]'}`}>All posts</button>
            {mine.map((m) => (
              <button key={m.id} onClick={() => setFilterOpp(m.id)} className={`rounded-full px-3 py-1 text-xs font-bold ${filterOpp === m.id ? 'bg-[#07382c] text-white' : 'bg-[#f1e9d2] text-[#6b6250]'}`}>
                #{m.id} · {m.title.slice(0, 28)}…
              </button>
            ))}
          </div>
          {pipeline.length === 0 ? (
            <Empty title="No applications on these posts yet" sub="Share the posting link or mark it INSTANT to get same-day applicants." />
          ) : (
            <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1">
              {pipeline.map(({ a, st, opp, overlap }) => (
                <div key={a.id} className="rounded-xl border border-[#ece2c8] bg-[#fffdf6] p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-black text-white" style={{ background: st?.avatar_color ?? '#0d7a5f' }}>{st?.name.charAt(0) ?? '?'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-[#07382c]">{st?.name ?? `Student #${a.student_id}`} <span className="font-semibold text-[#5a6a62]">· {st?.college}</span></p>
                      <p className="truncate text-xs text-[#5a6a62]">for “{opp?.title}” · {Math.round(overlap * 100)}% skill overlap</p>
                    </div>
                    <span className="text-lg font-black" style={{ color: matchColor(a.match_score) }}>{a.match_score}%</span>
                  </div>
                  {a.cover_note && <p className="mt-1.5 text-xs italic text-[#5a6a62]">“{a.cover_note}”</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Chip color={a.status === 'applied' ? '#2563eb' : a.status === 'shortlisted' ? '#0d7a5f' : a.status === 'hired' ? '#0d7a5f' : '#dc2626'}>{a.status}</Chip>
                    {['shortlisted', 'hired', 'rejected'].map((s) => (
                      <button key={s} onClick={() => setStatus(a.id, s)} className="rounded-lg border border-[#d8cdae] px-2 py-1 text-[11px] font-bold text-[#3c4a44] hover:border-[#0d7a5f]">{s}</button>
                    ))}
                    {opp?.skills_required?.slice(0, 2).map((r) => (
                      <button key={r} title="Verify this skill for the student" onClick={() => verifySkill(a.student_id, String(r))}
                        className="flex items-center gap-1 rounded-lg bg-[#effaf4] px-2 py-1 text-[11px] font-bold text-[#0d7a5f] hover:bg-[#0d7a5f] hover:text-white">
                        <ShieldCheck size={12} /> Verify {String(r).slice(0, 18)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* My postings */}
      {activeTab !== 'find' && (
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {mine.map((m) => (
          <div key={m.id} className="rounded-2xl border border-[#e5dcc3] bg-white p-4 card-shadow">
            <div className="flex items-center justify-between gap-2">
              <Chip color={m.urgency === 'instant' ? '#e8930c' : '#0d7a5f'}>{m.type} · {m.urgency}</Chip>
              <span className="text-xs font-bold text-[#5a6a62]">{m.applicants_count} applied</span>
            </div>
            <p className="mt-1.5 font-bold text-[#07382c]">{m.title}</p>
            <p className="text-xs text-[#5a6a62]">{m.stipend} · {m.duration} · {m.location}</p>
            <p className="mt-1 line-clamp-2 text-[13px] text-[#3c4a44]">{m.description}</p>
            <button onClick={() => setFilterOpp(m.id)} className="mt-2 flex items-center gap-1 text-[13px] font-bold text-[#0d7a5f]">Review applicants <ChevronRight size={14} /></button>
          </div>
        ))}
      </div>
      )}

      {msg && <p className="mt-3 text-sm font-bold text-[#0d7a5f]">{msg}</p>}

      {showForm && (
        <div className="tick mt-6 rounded-2xl border-2 border-[#0d7a5f] bg-white p-5 card-shadow-lg">
          <p className="mb-3 font-display text-xl font-bold text-[#07382c]">Post a task or role <span className="text-sm font-semibold text-[#5a6a62]">— validated before going live</span></p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">Title*<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} placeholder="e.g. Build a landing page for our new herbal tea" className="mt-1 w-full rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none focus:border-[#0d7a5f]" /></label>
            <label>Type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none">{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <label>Urgency<select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })} className="mt-1 w-full rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none"><option value="instant">⚡ instant (today)</option><option value="soon">soon (days)</option><option value="flexible">flexible</option></select></label>
            <label>Domain<input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="mt-1 w-full rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none" /></label>
            <label>Location<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Remote or city" className="mt-1 w-full rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none" /></label>
            <label>Stipend<input value={form.stipend} onChange={(e) => setForm({ ...form, stipend: e.target.value })} className="mt-1 w-full rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none" /></label>
            <label>Duration<input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="mt-1 w-full rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none" /></label>
            <label>Starts in<input value={form.starts_in} onChange={(e) => setForm({ ...form, starts_in: e.target.value })} className="mt-1 w-full rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none" /></label>
            <label>Openings<input type="number" min={1} max={100} value={form.openings} onChange={(e) => setForm({ ...form, openings: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none" /></label>
            <label className="sm:col-span-2">Skills required (comma separated)<input value={form.skills_required} onChange={(e) => setForm({ ...form, skills_required: e.target.value })} placeholder="React, Frontend Development, UI Design" className="mt-1 w-full rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none" /></label>
            <label className="sm:col-span-2">Task brief*<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} maxLength={3000} placeholder="Deliverables, acceptance criteria, review time, payout terms…" className="mt-1 w-full rounded-xl border border-[#d8cdae] px-3 py-2 text-sm outline-none" /></label>
          </div>
          <button onClick={post} disabled={busy} className="mt-3 rounded-xl bg-[#0d7a5f] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0b6a52] disabled:opacity-50">{busy ? 'Publishing…' : 'Publish opportunity'}</button>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Stat label="Avg. time to first applicant" value="47 min" accent="#e8930c" />
            <Stat label="Instant-task fill rate" value="86%" accent="#0d7a5f" />
            <Stat label="Verified hires YTD" value="312" accent="#2563eb" />
          </div>
        </div>
      )}
    </div>
  );
}
