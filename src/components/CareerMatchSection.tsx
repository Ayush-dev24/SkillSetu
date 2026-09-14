import { useMemo } from 'react';
import { RefreshCw, ShieldCheck, BadgeCheck, TrendingUp, ExternalLink, Clock, AlertTriangle, XCircle, CheckCircle2, Sparkles, Target, Briefcase, Layers, Lightbulb } from 'lucide-react';
import { useCareerMatch } from '../context/CareerMatchContext';
import { useAuth } from '../context/AuthContext';
import { skillVerificationMeta, matchColor } from '../lib/engine';
import type { MediatorRecommendation, MediatorSkillGap, MediatorSkillVerification, MediatorMatchResponse } from '../lib/engine';
import { categorizeRecommendations, CATEGORY_META } from '../lib/matching';
import type { MatchCategory } from '../lib/matching';
import { Chip } from './ui';

function freshnessLabel(fetchedAt: string | null): string | null {
  if (!fetchedAt) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60000));
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `Updated ${hours}h ago`;
}

function VerificationRow({ v }: { v: MediatorSkillVerification }) {
  const meta = skillVerificationMeta(v.state);
  const Icon = v.state === 'VERIFIED' ? CheckCircle2 : v.state === 'PARTIALLY_VERIFIED' ? Clock : v.state === 'NEEDS_EVIDENCE' ? AlertTriangle : XCircle;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#ece2c8] bg-[#fffdf6] p-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: meta.color }}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-bold text-[#07382c]">{v.skill}</span>
          <Chip color={meta.color} bg={meta.bg}>{meta.label}</Chip>
          {v.confidence != null && <span className="text-[11px] font-black text-[#8a978f]">{v.confidence}% confidence</span>}
        </div>
        {(v.explanation || v.evidence_summary) && (
          <p className="mt-1 text-[12px] leading-relaxed text-[#5a6a62]">{v.explanation || v.evidence_summary}</p>
        )}
      </div>
    </div>
  );
}

function SkillPill({ name, kind }: { name: string; kind?: 'matched' | 'verified' | 'partial' | 'missing' }) {
  const style =
    kind === 'verified' ? { color: '#0d7a5f', bg: '#effaf4', border: '#0d7a5f33' }
    : kind === 'matched' ? { color: '#2563eb', bg: '#eef3ff', border: '#2563eb33' }
    : kind === 'partial' ? { color: '#e8930c', bg: '#fff6e6', border: '#e8930c33' }
    : kind === 'missing' ? { color: '#dc2626', bg: '#fdeeee', border: '#dc262633' }
    : { color: '#5a6a62', bg: '#f3f1ea', border: '#8a978f33' };
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}>
      {kind === 'verified' && <BadgeCheck size={11} />}
      {kind === 'missing' && <XCircle size={11} />}
      {name}
    </span>
  );
}

function RecommendationCard({ r }: { r: MediatorRecommendation }) {
  const score = r.match_score;
  const col = matchColor(score);
  return (
    <div className="tick rounded-2xl border border-[#e5dcc3] bg-white p-4 card-shadow transition hover:-translate-y-0.5 hover:card-shadow-lg sm:p-5">
      <div className="flex items-start gap-3">
        {/* score */}
        <div className="relative grid h-16 w-16 shrink-0 place-items-center">
          <svg width={64} height={64} className="-rotate-90">
            <circle cx={32} cy={32} r={26} fill="none" stroke="#eee5cf" strokeWidth={6} />
            <circle cx={32} cy={32} r={26} fill="none" stroke={col} strokeWidth={6} strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 26} strokeDashoffset={2 * Math.PI * 26 * (1 - Math.min(100, score) / 100)} className="ring-anim" />
          </svg>
          <div className="absolute text-center">
            <p className="text-[15px] font-black leading-none" style={{ color: col }}>{score}%</p>
            <p className="text-[8px] font-bold uppercase tracking-wide text-[#8a978f]">match</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {r.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#0d7a5f] px-2.5 py-0.5 text-[11px] font-black text-white"><ShieldCheck size={11} /> Verified Job</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#8a978f] px-2.5 py-0.5 text-[11px] font-bold text-white">Unverified</span>
            )}
            {r.source && <Chip color="#2563eb">via {r.source}</Chip>}
          </div>
          <h4 className="mt-1 font-display text-[16px] font-bold leading-snug text-[#07382c]">{r.title}</h4>
          <p className="text-xs font-semibold text-[#5a6a62]">{r.company}{r.location ? ` · ${r.location}` : ''}</p>
        </div>
      </div>

      {/* skills summary */}
      {(r.matched_skills.length > 0 || r.verified_skills.length > 0) && (
        <p className="mt-3 text-[12px] font-semibold text-[#5a6a62]">
          {r.matched_skills.length}/{Math.max(1, r.matched_skills.length + r.missing_skills.length)} required skills matched
          {r.verified_skills.length > 0 && <span className="text-[#0d7a5f]"> · {r.verified_skills.length} verified</span>}
          {r.partially_verified_skills.length > 0 && <span className="text-[#e8930c]"> · {r.partially_verified_skills.length} partially verified</span>}
        </p>
      )}
      {(r.matched_skills.length > 0 || r.verified_skills.length > 0 || r.partially_verified_skills.length > 0 || r.missing_skills.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.verified_skills.map((s) => <SkillPill key={`v-${s}`} name={s} kind="verified" />)}
          {r.matched_skills.map((s) => <SkillPill key={`m-${s}`} name={s} kind="matched" />)}
          {r.partially_verified_skills.map((s) => <SkillPill key={`p-${s}`} name={s} kind="partial" />)}
          {r.missing_skills.map((s) => <SkillPill key={`x-${s}`} name={s} kind="missing" />)}
        </div>
      )}

      {r.why_matches && (
        <div className="mt-3 rounded-xl bg-[#faf7ef] p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#b97a06]">Why this matches</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[#07382c]">{r.why_matches}</p>
        </div>
      )}

      {(r.blockers.length > 0 || r.actions.length > 0) && (
        <div className="mt-2 grid gap-2 text-[12px] sm:grid-cols-2">
          {r.blockers.length > 0 && (
            <div className="rounded-xl bg-[#fdeeee] p-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#dc2626]">Possible blockers</p>
              <ul className="mt-0.5 list-disc pl-4 text-[#7a2b2b]">{r.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </div>
          )}
          {r.actions.length > 0 && (
            <div className="rounded-xl bg-[#effaf4] p-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#0d7a5f]">Recommended actions</p>
              <ul className="mt-0.5 list-disc pl-4 text-[#0b4a3a]">{r.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {r.application_url ? (
        <a
          href={r.application_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#0d7a5f] px-4 py-2 text-[13px] font-bold text-white transition hover:bg-[#0b6a52]"
        >
          Apply <ExternalLink size={13} />
        </a>
      ) : (
        <p className="mt-3 text-[11px] font-semibold text-[#8a978f]">Apply on the source listing</p>
      )}
    </div>
  );
}

function SkillGapRow({ g }: { g: MediatorSkillGap }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#ece2c8] bg-[#fffdf6] p-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e8930c] text-white text-[12px] font-black">{g.priority}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-bold text-[#07382c]">{g.skill}</span>
          <Chip color={g.priority >= 4 ? '#dc2626' : g.priority >= 3 ? '#e8930c' : '#2563eb'}>
            {g.priority >= 4 ? 'High priority' : g.priority >= 3 ? 'Medium priority' : 'Low priority'}
          </Chip>
        </div>
        {g.reason && <p className="mt-0.5 text-[12px] leading-relaxed text-[#5a6a62]">{g.reason}</p>}
        {g.jobs_requiring.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#8a978f]">Needed for</span>
            {g.jobs_requiring.slice(0, 3).map((j) => <Chip key={j} color="#2563eb">{j}</Chip>)}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Career Match dashboard section. Rendered on the Skill Setu landing page
 * and profile for signed-in students. Uses ONLY validated mediator values;
 * never invents jobs, scores, companies, skills or explanations.
 */
export default function CareerMatchSection({ compact = false }: { compact?: boolean }) {
  const { result, loading, fetchedAt, cached, refresh, usedFallback } = useCareerMatch();
  const { isAuthed, role } = useAuth();

  const valid = useMemo(() => Boolean(result && 'ok' in result && result.ok), [result]);
  const data = valid ? (result as MediatorMatchResponse) : null;
  const { strong, good, stretch } = useMemo(
    () => categorizeRecommendations(data?.recommendations ?? []),
    [data],
  );

  if (!isAuthed || role !== 'student') return null;

  const errorReason = !valid && result ? (result as { reason?: string; detail?: string; error: string }) : null;
  const jobsOk = data?.jobs_source_status.ok ?? false;
  const fresh = freshnessLabel(fetchedAt);
  const verifiedCount = data?.skill_verification.filter((v) => v.state === 'VERIFIED').length ?? 0;
  const partiallyCount = data?.skill_verification.filter((v) => v.state === 'PARTIALLY_VERIFIED').length ?? 0;
  const totalGaps = data?.skill_gaps.length ?? 0;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#0d7a5f]">Personalised career match</p>
          <h2 className="font-display text-2xl font-bold text-[#07382c] sm:text-3xl">Your verified job matches</h2>
          {fresh && (
            <p className="mt-1 text-[12px] font-semibold text-[#8a978f]">
              {fresh}{cached ? ' · from cached analysis' : ''}
              {usedFallback && !data ? ' · computed locally by the in-house engine' : ''}
            </p>
          )}
          {usedFallback && data && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#eef3ff] px-2.5 py-0.5 text-[11px] font-bold text-[#2563eb]">
              <Sparkles size={11} /> In-house engine · computed locally
            </p>
          )}
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0d7a5f] px-4 py-2 text-sm font-bold text-[#0d7a5f] transition hover:bg-[#0d7a5f] hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> {loading ? 'Analyzing…' : 'Refresh Recommendations'}
        </button>
      </div>

      {/* Strong / Good / Stretch strip */}
      {data && (data.recommendations.length > 0 || !jobsOk) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {([
            ['STRONG', strong],
            ['GOOD', good],
            ['STRETCH', stretch],
          ] as [MatchCategory, MediatorRecommendation[]][]).map(([cat, list]) => {
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} className="rounded-2xl border border-[#ece2c8] bg-[#fffdf6] p-4" style={{ borderLeft: `4px solid ${meta.color}` }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[13px] font-black text-[#07382c]">
                    <Layers size={14} style={{ color: meta.color }} /> {meta.label}
                  </p>
                  <span className="grid h-7 min-w-7 place-items-center rounded-lg px-1.5 text-[13px] font-black text-white" style={{ background: meta.color }}>
                    {list.length}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#5a6a62]">{meta.hint}</p>
              </div>
            );
          })}
        </div>
      )}

      {loading && !data && (
        <div className="rounded-2xl border border-[#e5dcc3] bg-white p-8 text-center card-shadow">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#0d7a5f] text-white"><Sparkles size={22} /></span>
          <p className="font-bold text-[#07382c]">Analyzing your skills and finding matching verified opportunities…</p>
          <div className="mx-auto mt-4 h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-[#eee5cf]">
            <div className="shimmer h-full w-full rounded-full" />
          </div>
          <p className="mt-2 text-[12px] text-[#8a978f]">This runs once against the verified-jobs engine — it never blocks your profile or the rest of the site.</p>
        </div>
      )}

      {/* unavailability, no fabrication */}
      {!loading && !data && errorReason && (
        <div className="rounded-2xl border border-[#e5dcc3] bg-white p-8 text-center card-shadow">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#e8930c] text-white"><AlertTriangle size={22} /></span>
          <p className="font-bold text-[#07382c]">{(errorReason as { error: string }).error || 'Recommendations are temporarily unavailable'}</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5a6a62]">
            {errorReason.detail || 'The matching service is unreachable right now. Your profile and the rest of Skill Setu keep working — try again in a moment.'}
          </p>
          <button onClick={() => void refresh()} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0d7a5f] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0b6a52]">
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      )}

      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Career match overview */}
          <div className="rounded-2xl bg-[#07382c] p-5 text-white card-shadow-lg">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#f5d48a]"><Target size={13} /> Career Match Overview</p>
            {data.profile_summary?.target_role && (
              <p className="font-display text-lg font-bold leading-snug">Targeting {data.profile_summary.target_role}</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="font-display text-2xl font-black text-[#f5d48a]">{data.recommendations.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Matched jobs</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="font-display flex items-center gap-1 text-2xl font-black text-[#f5d48a]"><ShieldCheck size={18} />{verifiedCount}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Verified skills</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="font-display text-2xl font-black text-[#f5a623]">{partiallyCount}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Partially verified</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="font-display text-2xl font-black text-[#f5a623]">{totalGaps}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Skills to improve</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[#9fc3b2]">
              Verification comes from evidence reviewed by the matching engine — listing a skill on your profile alone never marks it verified.
            </p>
          </div>

          {/* Skill verification */}
          <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
            <p className="mb-3 flex items-center gap-1.5 font-bold text-[#07382c]"><BadgeCheck size={17} className="text-[#0d7a5f]" /> Skill verification · {data.skill_verification.length}</p>
            {data.skill_verification.length === 0 ? (
              <p className="text-sm text-[#5a6a62]">No verification results yet — refresh after updating your profile or completing an assessment.</p>
            ) : (
              <div className="grid max-h-[380px] gap-2 overflow-y-auto pr-1">
                {data.skill_verification.map((v) => <VerificationRow key={v.skill} v={v} />)}
              </div>
            )}
          </div>

          {/* Skills to improve */}
          <div className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
            <p className="mb-3 flex items-center gap-1.5 font-bold text-[#07382c]"><TrendingUp size={17} className="text-[#e8930c]" /> Skills to improve · {totalGaps}</p>
            {data.skill_gaps.length === 0 ? (
              <p className="text-sm text-[#5a6a62]">No skill gaps reported — great fit for the roles reviewed.</p>
            ) : (
              <div className="grid max-h-[380px] gap-2 overflow-y-auto pr-1">
                {data.skill_gaps.map((g) => <SkillGapRow key={g.skill} g={g} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommended verified jobs */}
      {data && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h3 className="flex items-center gap-1.5 font-display text-xl font-bold text-[#07382c]"><Briefcase size={19} className="text-[#0d7a5f]" /> Recommended Verified Jobs</h3>
            {!jobsOk && (
              <Chip color="#e8930c"><AlertTriangle size={11} /> Job feed temporarily unavailable</Chip>
            )}
          </div>

          {!jobsOk && (
            <div className="mb-4 rounded-2xl border border-[#e5dcc3] bg-[#fff6e6] p-4 text-[13px] text-[#6b4a12]">
              <p className="font-bold">Job recommendations are temporarily unavailable.</p>
              <p className="mt-0.5 text-[12px]">Your skill verification and gap analysis above are still current — we're unable to refresh live jobs from the verified-jobs service right now. Use the refresh button above to try again.</p>
            </div>
          )}

          {jobsOk && data.recommendations.length === 0 && (
            <p className="rounded-2xl border border-dashed border-[#c9bd9c] bg-[#fffdf6] p-6 text-center text-sm text-[#5a6a62]">
              No matching verified jobs right now — update your profile or refresh to re-run the match.
            </p>
          )}

          <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'lg:grid-cols-2 xl:grid-cols-3'}`}>
            {jobsOk && data.recommendations.map((r) => <RecommendationCard key={r.job_id ?? `${r.title}-${r.company}`} r={r} />)}
          </div>
        </div>
      )}

      {/* Improve my match */}
      {data && (data.skill_gaps.length > 0 || data.skill_verification.some((v) => v.state === 'NEEDS_EVIDENCE' || v.state === 'UNVERIFIED')) && (
        <div className="mt-10 rounded-2xl border border-[#e5dcc3] bg-[#fffdf6] p-5 card-shadow">
          <p className="mb-1 flex items-center gap-1.5 font-display text-xl font-bold text-[#07382c]">
            <Lightbulb size={19} className="text-[#e8930c]" /> Improve your match
          </p>
          <p className="mb-4 text-[12px] text-[#5a6a62]">Targeted next steps raise your scores — verified skills and closed gaps are the fastest levers.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.skill_gaps.slice(0, 6).map((g) => (
              <div key={`imp-${g.skill}`} className="flex items-start gap-3 rounded-xl border border-[#ece2c8] bg-white p-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#07382c] text-[12px] font-black text-[#f5d48a]">{g.priority}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[#07382c]">Grow “{g.skill}”</p>
                  <p className="text-[11px] leading-relaxed text-[#5a6a62]">
                    {g.reason || 'Most-requested skill in your matched roles.'}
                    <span className="font-bold text-[#0d7a5f]"> Take a focused assessment → verified evidence.</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}