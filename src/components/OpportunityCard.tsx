import { useState } from 'react';
import { MapPin, Users, Clock, Zap, ChevronRight, CheckCircle2, X, Globe, Navigation } from 'lucide-react';
import { oppTypeMeta, matchForOpportunity, matchColor, apiSend } from '../lib/engine';
import type { Opportunity, StudentSkill } from '../lib/engine';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { COMPANY_GEO, formatDistance, directionsUrl, type GeoPoint } from '../lib/geo';
import { MatchRing, Chip } from './ui';

const URGENCY_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  instant: { label: '⚡ INSTANT · Start today', bg: '#e8930c', fg: '#fff' },
  soon: { label: 'Starts within days', bg: '#2563eb', fg: '#fff' },
  flexible: { label: 'Flexible start', bg: '#0d7a5f', fg: '#fff' },
};

export default function OpportunityCard({ opp, skills, compact, distanceKm, userCoords, destCoords }: { opp: Opportunity; skills: StudentSkill[]; compact?: boolean; distanceKm?: number | null; userCoords?: GeoPoint | null; destCoords?: GeoPoint | null }) {
  const { student, companyOf, myApplications, refresh } = useApp();
  const { isAuthed, authToken } = useAuth();
  const [showMatch, setShowMatch] = useState(false);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');

  const match = matchForOpportunity(skills, opp);
  const already = myApplications.some((a) => String(a.opportunity_id) === String(opp.id));
  const co = companyOf(opp.company_id);
  const meta = oppTypeMeta(opp.type);
  const urg = URGENCY_STYLE[opp.urgency] ?? URGENCY_STYLE.flexible;
  const hq = COMPANY_GEO[opp.company_id];
  const ext = opp.external;

  const apply = async () => {
    if (!isAuthed || !student) {
      setMsg('Please sign in as a student to apply.');
      return;
    }
    if (already || ext) return;
    const oppId = Number(opp.id);
    if (!Number.isFinite(oppId)) {
      setMsg('External listings apply on the source site (button below).');
      return;
    }
    setApplying(true); setMsg('');
    try {
      const token = await authToken();
      await apiSend('/api/applications', 'POST', {
        student_id: student.id, opportunity_id: oppId,
        match_score: match.score, cover_note: note.slice(0, 1000),
      }, token);
      await refresh();
      setMsg('Applied! The company can now see your skill-matched profile.');
      setNote('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Application failed');
    } finally { setApplying(false); }
  };

  return (
    <div className={`tick rounded-2xl border bg-white card-shadow transition hover:-translate-y-0.5 hover:card-shadow-lg ${opp.urgency === 'instant' ? 'border-[#e8930c]' : 'border-[#e5dcc3]'}`}>
      {opp.urgency === 'instant' && (
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-[#e8930c] to-[#f5a623] px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
          <span className="flex items-center gap-1"><Zap size={12} strokeWidth={3} /> Instant opportunity</span>
          <span>{opp.starts_in}</span>
        </div>
      )}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black text-white" style={{ background: co?.color ?? opp.color }}>
            {(co?.name ?? '?').charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip color={meta.color}>{meta.label}</Chip>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: urg.bg }}>{urg.label}</span>
              {ext && <span className="inline-flex items-center gap-1 rounded-full bg-[#0d7a5f] px-2.5 py-1 text-[11px] font-black text-white">✓ Verified · {ext.source}</span>}
            </div>
            <h3 className="mt-1.5 font-display text-[17px] font-bold leading-snug text-[#07382c]">{opp.title}</h3>
            <p className="text-xs font-semibold text-[#5a6a62]">
              {co?.name ?? 'Partner company'} {co?.verified && <span className="font-black text-[#0d7a5f]">✓ Verified</span>} · <MapPin size={11} className="inline" />{' '}
              {opp.remote ? 'Remote · work from anywhere' : opp.location}
              {!opp.remote && distanceKm != null && (
                <span className="ml-1 rounded-full bg-[#2563eb14] px-2 py-0.5 font-black text-[#2563eb]">· {formatDistance(distanceKm)} from you</span>
              )}
            </p>
            {!opp.remote && hq && !compact && (
              <a href={hq.website} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#8a978f] hover:text-[#0d7a5f]">
                <Globe size={11} /> HQ: {hq.hq}
              </a>
            )}
            {!opp.remote && userCoords && destCoords && !compact && (
              <a
                href={directionsUrl(userCoords, destCoords)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 rounded-lg bg-[#2563eb14] px-2 py-1 text-[11px] font-black text-[#2563eb] hover:bg-[#2563eb] hover:text-white"
              >
                <Navigation size={11} /> Get directions{distanceKm != null ? ` · ${formatDistance(distanceKm)}` : ''}
              </a>
            )}
          </div>
          <MatchRing score={match.score} size={compact ? 56 : 66} />
        </div>

        {!compact && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-[#3c4a44]">{opp.description}</p>}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(opp.skills_required || []).map((s) => {
            const has = skills.some((k) => k.skill_name.toLowerCase() === s.toLowerCase());
            return (
              <span key={s} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${has ? 'bg-[#0d7a5f] text-white' : 'bg-[#f1e9d2] text-[#6b6250]'}`}>
                {has && <CheckCircle2 size={11} />} {s}
              </span>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-[#5a6a62]">
          <span className="font-black text-[#0d7a5f]">{opp.stipend}</span>
          <span className="flex items-center gap-1"><Clock size={12} /> {opp.duration}</span>
          <span className="flex items-center gap-1"><Users size={12} /> {opp.applicants_count} applied · {opp.openings} openings</span>
        </div>

        {msg && <p className={`mt-2 text-xs font-bold ${msg.startsWith('Applied') ? 'text-[#0d7a5f]' : 'text-[#dc2626]'}`}>{msg}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setShowMatch(!showMatch)}
            className="flex-1 rounded-xl border-2 border-[#0d7a5f] px-3 py-2 text-[13px] font-bold text-[#0d7a5f] transition hover:bg-[#0d7a5f] hover:text-white"
          >
            Why {match.score}%? Explain
          </button>
          {ext?.source_url ? (
            <a
              href={ext.source_url}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#07382c] px-3 py-2 text-center text-[13px] font-bold text-white transition hover:bg-[#095844]"
            >
              Apply on {ext.source} ↗
            </a>
          ) : !isAuthed ? (
            <a
              href="/login"
              className="flex flex-1 items-center justify-center rounded-xl bg-[#07382c] px-3 py-2 text-center text-[13px] font-bold text-white transition hover:bg-[#095844]"
            >
              Sign in to apply
            </a>
          ) : (
            <button
              onClick={apply}
              disabled={applying || already}
              className={`flex-1 rounded-xl px-3 py-2 text-[13px] font-bold text-white transition ${already ? 'bg-[#9db3a9]' : 'bg-[#0d7a5f] hover:bg-[#0b6a52]'}`}
            >
              {already ? '✓ Applied' : applying ? 'Applying…' : opp.urgency === 'instant' ? '⚡ Apply instantly' : 'Apply now'}
            </button>
          )}
        </div>

        {showMatch && (
          <div className="mt-3 rounded-xl bg-[#faf7ef] p-3 text-[13px]">
            <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest" style={{ color: matchColor(match.score) }}>AI match explanation</p>
            <ul className="grid gap-1 text-[#3c4a44]">
              {match.explanation.map((e, i) => <li key={i} className="flex gap-1.5"><ChevronRight size={14} className="mt-0.5 shrink-0 text-[#0d7a5f]" />{e}</li>)}
            </ul>
            {match.missing.length > 0 && (
              <p className="mt-2 text-[#3c4a44]"><b>Missing:</b> {match.missing.map((m) => `${m.skill} (need L${m.required}${m.current ? `, you L${m.current}` : ', not started'})`).join(' · ')}</p>
            )}
            <p className="mt-1.5 text-[#3c4a44]"><b>Prep plan:</b> {match.prep.join(' → ')}</p>
            <p className="mt-1 font-bold text-[#07382c]">
              {match.weeksToEligible === 0 ? '✅ Eligible right now — apply before the slot fills.' : `⏳ ~${match.weeksToEligible} week${match.weeksToEligible > 1 ? 's' : ''} of focused prep to become fully eligible.`}
            </p>
            {!opp.remote && hq && (
              <p className="mt-1.5 text-xs font-semibold text-[#5a6a62]">📍 On-site in {opp.location} — employer HQ: {hq.hq}.</p>
            )}
            {!opp.remote && userCoords && destCoords && (
              <a
                href={directionsUrl(userCoords, destCoords)}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-1.5 text-xs font-black text-white hover:bg-[#1d4ed8]"
              >
                <Navigation size={13} /> Get directions from my location
              </a>
            )}
            {!already && !ext && (
              <div className="mt-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a 1-line note for the employer (optional)…"
                  className="w-full rounded-lg border border-[#d8cdae] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#0d7a5f]" maxLength={200} />
              </div>
            )}
            {ext && (
              <p className="mt-2 text-xs font-semibold text-[#5a6a62]">
                External verified listing — applications happen on {ext.source}. Always confirm the live post there before sharing personal details.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MatchModal({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-bold text-[#07382c]">Quick match</p>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-600">{opp.title}</p>
      </div>
    </div>
  );
}
