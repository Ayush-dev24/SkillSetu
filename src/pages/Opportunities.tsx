import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, MapPin, Map as MapIcon, LocateFixed, X, Globe, BellRing, ExternalLink, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { FeedJob, JobsQuery } from '../context/AppContext';
import { oppTypeMeta } from '../lib/engine';
import { useUserLocation, haversineKm, formatDistance, opportunityCoords, COMPANY_GEO } from '../lib/geo';
import { SectionTitle, Chip, Empty } from '../components/ui';
import OpportunityCard from '../components/OpportunityCard';

const RADII = [50, 150, 500, 2000];

export default function Opportunities() {
  const { opportunities, companies, mySkills, loading, feed, feedMeta, feedLoading, fetchFeed } = useApp();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [company, setCompany] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [employmentType, setEmploymentType] = useState(() => params.get('employment_type') ?? '');
  const [experience, setExperience] = useState('');
  const [minTrust, setMinTrust] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [radiusKm, setRadiusKm] = useState(500);
  const [nearMeOnly, setNearMeOnly] = useState(false);
  const [includeRemote, setIncludeRemote] = useState(true);
  const [includeExternal, setIncludeExternal] = useState(true);
  const [skillsQuery, setSkillsQuery] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [alertsOn, setAlertsOn] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [seenCount, setSeenCount] = useState(0);
  const geo = useUserLocation();

  // Real-time "new vacancy" alerts: compare the live feed size against what
  // the student has already seen this session.
  useEffect(() => {
    if (feed.length > 0 && seenCount === 0) setSeenCount(feed.length);
  }, [feed.length, seenCount]);
  const newSinceSeen = Math.max(0, feed.length - seenCount);
  useEffect(() => {
    if (!alertsOn || newSinceSeen <= 0) return;
    setAlertMsg(`🔔 ${newSinceSeen} new verified vacanc${newSinceSeen === 1 ? 'y' : 'ies'} just landed — refresh the list below.`);
    const t = setTimeout(() => setAlertMsg(''), 9000);
    return () => clearTimeout(t);
  }, [alertsOn, newSinceSeen]);

  const type = params.get('employment_type') ?? 'all';
  const setType = (t: string) => {
    if (t === 'all') params.delete('employment_type'); else params.set('employment_type', t);
    setParams(params);
    setEmploymentType(t === 'all' ? '' : t);
    setPage(1);
  };

  useEffect(() => {
    const query: JobsQuery = {
      q: search, city, location, company,
      skills: skillsQuery,
      work_mode: workMode, employment_type: employmentType,
      experience, min_trust: minTrust, sort, page, limit: 50,
    };
    const timer = setTimeout(() => fetchFeed(query), 300);
    return () => clearTimeout(timer);
  }, [search, city, location, company, skillsQuery, workMode, employmentType, experience, minTrust, sort, page, fetchFeed]);

  // Internal DB opportunities mapped to the same row shape.
  const internalRows = useMemo(() => {
    return opportunities
      .filter((o) => o.status === 'open')
      .map((o) => {
        const co = companies.find((c) => c.id === o.company_id);
        const [lat, lng] = opportunityCoords(o, co?.location);
        let km: number | null = null;
        if (geo.coords && !o.remote) km = haversineKm(geo.coords, { lat, lng });
        return { o, co, km, lat, lng, feedJob: null as FeedJob | null };
      });
  }, [opportunities, companies, geo.coords]);

  // Verified external postings merged into the same list (clearly badged).
  const externalRows = useMemo(() => {
    if (!includeExternal) return [] as { o: (typeof opportunities)[number]; co: undefined; km: number | null; lat: number; lng: number; feedJob: FeedJob | null }[];
    return feed
      .filter((j) => j.external)
      .map((j) => {
        const [lat, lng] = opportunityCoords({ id: j.id, location: j.location, remote: j.remote, company_id: j.company_id }, undefined);
        let km: number | null = null;
        if (geo.coords && !j.remote) km = haversineKm(geo.coords, { lat, lng });
        const pseudo = {
          id: j.id, title: j.title, company_id: j.company_id, type: j.type, domain: j.domain,
          location: j.location, remote: j.remote, stipend: j.salary_text || j.stipend,
          stipend_num: 0, duration: j.duration, urgency: j.urgency, starts_in: j.starts_in,
          skills_required: j.skills || [], description: j.summary || '',
          openings: j.openings, applicants_count: j.applicants_count, status: j.status,
          posted_at: j.posted_text, deadline: 'See source listing', color: j.color,
          external: { source: j.source, source_url: j.source_url, verified: j.verified },
        } as unknown as (typeof opportunities)[number];
        return { o: pseudo, co: undefined, km, lat, lng, feedJob: j as FeedJob };
      });
  }, [feed, includeExternal, geo.coords]);

  // Merge internal DB rows + external feed rows into one list.
  const allRows = useMemo(() => [...internalRows, ...externalRows], [internalRows, externalRows]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const rows = allRows.filter(({ o, km, feedJob }) => {
      if (o.status !== 'open') return false;
      if (!includeRemote && o.remote) return false;
      if (s && !`${o.title} ${o.description} ${(o.skills_required || []).join(' ')} ${feedJob?.company_name ?? ''}`.toLowerCase().includes(s)) return false;
      if (nearMeOnly && geo.coords) {
        if (o.remote) return true;
        if (km == null || km > radiusKm) return false;
      }
      return true;
    });
    if (geo.coords) {
      rows.sort((a, b) => {
        if (a.o.remote && !b.o.remote) return 1;
        if (!a.o.remote && b.o.remote) return -1;
        if (a.km != null && b.km != null) return a.km - b.km;
        if (a.km != null) return -1;
        if (b.km != null) return 1;
        return 0;
      });
    }
    return rows;
  }, [allRows, search, includeRemote, nearMeOnly, radiusKm, geo.coords]); // eslint-disable-line react-hooks/exhaustive-deps

  const instant = filtered.filter((x) => x.o.urgency === 'instant');
  const rest = filtered.filter((x) => x.o.urgency !== 'instant');
  const externalCount = filtered.filter((x) => x.feedJob).length;
  const nearbyOnsite = geo.coords ? filtered.filter((x) => !x.o.remote && x.km != null && x.km <= radiusKm) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SectionTitle
        kicker="Instant opportunity rails · real employers"
        title="Vacancies near you, matched to your skills"
        sub="Verified postings from 40 real companies — heritage pharmacies, hospital networks, FMCG majors, health-tech unicorns and neighbourhood studios. Share your location and on-site roles sort by true distance."
      />

      {/* Live feed status — real-time updates */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#e5dcc3] bg-white px-4 py-2.5 text-xs font-bold text-[#3c4a44] card-shadow">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${feedLoading ? 'bg-[#e8930c] pulse-dot' : 'bg-[#0d7a5f]'}`} />
          {feedLoading ? 'Syncing live vacancies…' : `Live · ${feedMeta?.count ?? filtered.length} verified vacancies · updated ${feedMeta?.updated_at ? new Date(feedMeta.updated_at).toLocaleTimeString() : 'just now'}`}
        </span>
        {feedMeta && (
          <span className="rounded-full bg-[#effaf4] px-2.5 py-1 text-[11px] font-black text-[#0d7a5f]">
            {feedMeta.internal_count} on-platform + {feedMeta.external_count} via {Array.from(new Set(feed.filter((j) => j.external).map((j) => j.source))).slice(0, 4).join(' · ') || 'verified boards'}
          </span>
        )}
        <button
          onClick={() => {
            const on = !alertsOn;
            setAlertsOn(on);
            if (on) { setSeenCount(feed.length); setAlertMsg('🔔 Live alerts on — new verified vacancies will pop up here within a minute.'); }
            else setAlertMsg('');
          }}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition ${alertsOn ? 'bg-[#07382c] text-white' : 'bg-[#f1e9d2] text-[#6b6250] hover:bg-[#e5dcc3]'}`}
        >
          <BellRing size={13} /> {alertsOn ? 'Alerts on' : 'Notify me of new vacancies'}
        </button>
      </div>
      {alertMsg && (
        <div className="tick mb-3 rounded-2xl bg-[#07382c] px-4 py-2.5 text-[13px] font-bold text-[#f5d48a]">
          {alertMsg}{' '}
          <button onClick={() => { setSeenCount(feed.length); setAlertMsg(''); }} className="ml-1 underline hover:text-white">Mark seen</button>
        </div>
      )}

      {/* Location bar */}
      <div className="mb-3 rounded-2xl border border-[#e5dcc3] bg-white p-3 card-shadow">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          {!geo.coords ? (
            <>
              <button
                onClick={geo.request}
                disabled={geo.status === 'locating'}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1d4ed8] disabled:opacity-60"
              >
                <LocateFixed size={16} /> {geo.status === 'locating' ? 'Locating…' : '📍 Find vacancies near me'}
              </button>
              <div className="flex flex-1 items-center gap-2">
                <input
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') geo.setManualCity(manualCity); }}
                  placeholder="Or type your city (e.g. Nagpur, Jaipur, Kochi)…"
                  className="w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2.5 text-sm outline-none focus:border-[#0d7a5f]"
                />
                <button
                  onClick={() => geo.setManualCity(manualCity)}
                  className="shrink-0 rounded-xl border-2 border-[#0d7a5f] px-4 py-2 text-sm font-bold text-[#0d7a5f] hover:bg-[#0d7a5f] hover:text-white"
                >
                  Set
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#effaf4] px-3 py-1.5 text-[13px] font-bold text-[#0d7a5f]">
                <MapPin size={14} /> {geo.label || 'Location set'}
                {nearbyOnsite.length > 0 && <span className="rounded-full bg-[#0d7a5f] px-2 py-0.5 text-[11px] font-black text-white">{nearbyOnsite.length} near you</span>}
              </span>
              <label className="flex items-center gap-1.5 rounded-xl bg-[#faf7ef] px-3 py-1.5 text-xs font-bold text-[#3c4a44]">
                Within
                <select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="bg-transparent font-black text-[#07382c] outline-none">
                  {RADII.map((r) => <option key={r} value={r}>{r >= 2000 ? 'All India' : `${r} km`}</option>)}
                </select>
              </label>
              <button
                onClick={() => setNearMeOnly(!nearMeOnly)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${nearMeOnly ? 'bg-[#07382c] text-white' : 'bg-[#f1e9d2] text-[#6b6250] hover:bg-[#e5dcc3]'}`}
              >
                {nearMeOnly ? `✓ Within ${radiusKm >= 2000 ? 'India' : `${radiusKm} km`}` : 'Filter: near me'}
              </button>
              <button onClick={() => { geo.clear(); setNearMeOnly(false); setManualCity(''); }} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-[#8a978f] hover:text-[#dc2626]">
                <X size={13} /> Clear
              </button>
            </div>
          )}
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#3c4a44]">
            <input type="checkbox" checked={includeRemote} onChange={(e) => setIncludeRemote(e.target.checked)} className="h-4 w-4 accent-[#0d7a5f]" />
            Include remote
          </label>
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#3c4a44]" title="Verified listings from legal external boards (Naukri, LinkedIn, Internshala, Wellfound, Cutshort, NCS)">
            <input type="checkbox" checked={includeExternal} onChange={(e) => setIncludeExternal(e.target.checked)} className="h-4 w-4 accent-[#0d7a5f]" />
            External boards
          </label>
        </div>
        {geo.error && <p className="mt-2 text-xs font-bold text-[#b45309]">{geo.error}</p>}
      </div>

      <Link to="/map" className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-[#07382c] px-4 py-3 text-white card-shadow transition hover:bg-[#095844]">
        <span className="flex items-center gap-2 text-sm font-bold"><MapIcon size={17} className="text-[#f5d48a]" /> Prefer a map? See all {allRows.length} jobs plotted live across India.</span>
        <span className="shrink-0 rounded-lg bg-[#f5a623] px-3 py-1.5 text-xs font-black text-[#07382c]">Open map →</span>
      </Link>

      {/* Employment type */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setType('all')}
          className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition ${type === 'all' ? 'bg-[#07382c] text-white' : 'border border-[#d8cdae] bg-white text-[#3c4a44] hover:border-[#0d7a5f]'}`}>
          All jobs
        </button>
        {[['FULL_TIME', 'Full-time'], ['PART_TIME', 'Part-time'], ['CONTRACT', 'Contract'], ['INTERNSHIP', 'Internship']].map(([key, label]) => {
          return (
            <button key={key} onClick={() => setType(key)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition ${type === key ? 'bg-[#07382c] text-white' : 'border border-[#d8cdae] bg-white text-[#3c4a44] hover:border-[#0d7a5f]'}`}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-[#e5dcc3] bg-white p-3 card-shadow lg:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl bg-[#faf7ef] px-3 py-2">
          <Search size={16} className="text-[#8a978f]" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search title, company, description or location…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#a89e83]" />
        </label>
        <label className="flex items-center gap-2 rounded-xl bg-[#faf7ef] px-3 py-2 text-sm font-semibold" title="Works for every skill — clinical, digital, research, marketing">
          <SlidersHorizontal size={15} className="text-[#7c3aed]" />
          <input value={skillsQuery} onChange={(e) => { setSkillsQuery(e.target.value); setPage(1); }} placeholder="Skills: Python,React" className="w-36 bg-transparent outline-none placeholder:text-[#a89e83]" />
        </label>
        <input value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} placeholder="City" className="rounded-xl bg-[#faf7ef] px-3 py-2 text-sm outline-none" />
        <input value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} placeholder="Location" className="rounded-xl bg-[#faf7ef] px-3 py-2 text-sm outline-none" />
        <input value={company} onChange={(e) => { setCompany(e.target.value); setPage(1); }} placeholder="Company" className="rounded-xl bg-[#faf7ef] px-3 py-2 text-sm outline-none" />
        <select value={workMode} onChange={(e) => { setWorkMode(e.target.value); setPage(1); }} className="rounded-xl bg-[#faf7ef] px-3 py-2 text-sm font-semibold outline-none">
          <option value="">Any work mode</option><option value="ON_SITE">On-site</option><option value="HYBRID">Hybrid</option><option value="REMOTE">Remote</option>
        </select>
        <select value={experience} onChange={(e) => { setExperience(e.target.value); setPage(1); }} className="rounded-xl bg-[#faf7ef] px-3 py-2 text-sm font-semibold outline-none">
          <option value="">Any experience</option><option value="0">0 years</option><option value="1">Up to 1 year</option><option value="3">Up to 3 years</option><option value="5">Up to 5 years</option>
        </select>
        <select value={minTrust} onChange={(e) => { setMinTrust(e.target.value); setPage(1); }} className="rounded-xl bg-[#faf7ef] px-3 py-2 text-sm font-semibold outline-none">
          <option value="">Any trust score</option><option value="80">80+ trust</option><option value="90">90+ trust</option><option value="95">95+ trust</option>
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="rounded-xl bg-[#faf7ef] px-3 py-2 text-sm font-semibold outline-none">
          <option value="recent">Newest</option><option value="trust_score">Highest trust</option><option value="salary">Highest salary</option><option value="relevance">Relevance</option>
        </select>
      </div>

      {feedMeta && feedMeta.total_pages > 1 && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-[#e5dcc3] bg-white px-3 py-2 text-sm font-bold text-[#3c4a44]">
          <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg px-3 py-1.5 hover:bg-[#faf7ef] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
          <span>Page {page} of {feedMeta.total_pages}</span>
          <button disabled={!feedMeta.has_next_page} onClick={() => setPage((current) => current + 1)} className="rounded-lg px-3 py-1.5 hover:bg-[#faf7ef] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2"><div className="h-56 rounded-2xl bg-white shimmer" /><div className="h-56 rounded-2xl bg-white shimmer" /></div>
      ) : filtered.length === 0 ? (
        <Empty
          title={nearMeOnly && geo.coords ? `Nothing within ${radiusKm} km — widen the radius` : 'No opportunities match these filters'}
          sub="Remote roles are available everywhere — enable 'Include remote' or widen the radius."
        />
      ) : (
        <>
          {geo.coords && nearbyOnsite.length > 0 && !nearMeOnly && (
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <MapPin size={18} className="text-[#2563eb]" />
                <h3 className="font-display text-xl font-bold text-[#07382c]">📍 Near you — within {radiusKm >= 2000 ? 'India' : `${radiusKm} km`} ({nearbyOnsite.length})</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {nearbyOnsite.slice(0, 4).map(({ o, km, lat, lng }) => (
                  <div key={o.id} className="relative">
                    <span className="absolute -top-2 left-4 z-10 rounded-full bg-[#2563eb] px-2.5 py-0.5 text-[11px] font-black text-white shadow">{km != null ? formatDistance(km) : o.location}</span>
                    <OpportunityCard opp={o} skills={mySkills} distanceKm={km} userCoords={geo.coords} destCoords={{ lat, lng }} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {instant.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="pulse-dot inline-block h-2.5 w-2.5 rounded-full bg-[#e8930c]" />
                <h3 className="font-display text-xl font-bold text-[#07382c]">⚡ Instant — start today ({instant.length})</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {instant.map(({ o, km, lat, lng }) => <OpportunityCard key={o.id} opp={o} skills={mySkills} distanceKm={km} userCoords={geo.coords} destCoords={{ lat, lng }} />)}
              </div>
            </div>
          )}
          {externalCount > 0 && (
            <div className="mb-8">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="flex items-center gap-1.5 font-display text-xl font-bold text-[#07382c]">
                  <ShieldCheck size={19} className="text-[#0d7a5f]" /> Verified listings from the web ({externalCount})
                </h3>
                <Chip color="#0d7a5f">Legal sources only</Chip>
              </div>
              <p className="mb-3 max-w-3xl text-[13px] text-[#5a6a62]">
                Curated from official career pages and established boards — never scraped from behind logins. Each card links straight to the source listing; always confirm there before applying.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {filtered.filter((x) => x.feedJob).map(({ o, km, lat, lng, feedJob }) => (
                  <div key={o.id} className="relative rounded-2xl">
                    <OpportunityCard opp={o} skills={mySkills} distanceKm={km} userCoords={geo.coords} destCoords={{ lat, lng }} />
                    {feedJob && (
                      <a href={feedJob.source_url} target="_blank" rel="noreferrer"
                        className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-[#0d7a5f33] bg-[#effaf4] px-3 py-2 text-xs font-bold text-[#0d7a5f] hover:bg-[#0d7a5f] hover:text-white">
                        <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> Verified via {feedJob.source} · {feedJob.posted_text}</span>
                        <span className="flex shrink-0 items-center gap-1">Apply on source <ExternalLink size={12} /></span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-1.5 font-display text-xl font-bold text-[#07382c]">
                <MapPin size={18} className="text-[#0d7a5f]" /> Scheduled & flexible ({rest.length}){geo.coords ? ' · nearest first' : ''}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {rest.filter((x) => !x.feedJob).map(({ o, km, lat, lng }) => <OpportunityCard key={o.id} opp={o} skills={mySkills} distanceKm={km} userCoords={geo.coords} destCoords={{ lat, lng }} />)}
              </div>
            </div>
          )}
          {/* Internal DB-based instant gigs that aren't external */}
          {filtered.filter((x) => !x.feedJob && x.o.urgency === 'instant').length > 0 && filtered.filter((x) => x.feedJob).length === 0 && (
            <div className="mt-2 rounded-2xl border border-[#e5dcc3] bg-[#faf7ef] p-4 text-sm text-[#5a6a62]">
              <span className="font-bold text-[#07382c]">💡 Tip:</span> Enable <b>External boards</b> above to see verified listings from Naukri, LinkedIn, Internshala and more.
            </div>
          )}
          {type !== 'all' && (
            <div className="mt-6 rounded-2xl bg-[#07382c] p-4 text-[13px] text-[#cfe6da]">
              <b className="text-white">{oppTypeMeta(type).label}:</b> {oppTypeMeta(type).desc}. Tip: open any card's “Why %?” panel to see missing skills and prep time before applying.
              <div className="mt-2"><Chip color="#f5a623" bg="#ffffff1a">{filtered.length} open right now</Chip></div>
            </div>
          )}
          {/* Employer provenance */}
          <div className="mt-6 rounded-2xl border border-[#e5dcc3] bg-white p-4 card-shadow">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#0d7a5f]"><Globe size={13} /> {companies.length} verified employers · solo clinics → FMCG majors → unicorns</p>
            <p className="mb-2 text-xs text-[#5a6a62]">Every pin maps to a real HQ city. Small studios post same-day gigs; big majors post internships & full-time roles — one pipeline for every student.</p>
            <div className="flex flex-wrap gap-1.5">
              {companies.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#faf7ef] px-3 py-1.5 text-[11px] font-bold text-[#3c4a44]">
                  <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-white" style={{ background: c.color }}>{c.name.charAt(0)}</span>
                  {c.name} · {COMPANY_GEO[c.id]?.hq.split('(')[0].trim() ?? c.location}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
