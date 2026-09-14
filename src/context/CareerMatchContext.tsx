import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchCareerMatch } from '../lib/engine';
import type { MediatorMatchResult, MediatorMatchResponse, StudentSkill } from '../lib/engine';
import { matchJobs, verifySkills, computeSkillGaps, summarizeProfile } from '../lib/matching';
import { useAuth } from './AuthContext';
import { useApp } from './AppContext';

/**
 * Client-side fallback: when Skill Setu's own /api/career-match boundary is
 * unreachable (network error, preview mode, server down), run the same pure
 * in-house engine in the browser against data the app already loaded
 * (student profile, skills, verified jobs feed). This keeps the dashboard
 * producing real, transparent recommendations instead of a dead error card.
 */
function runClientFallback(input: {
  student: { id: number; location?: string; headline?: string } | undefined;
  skills: StudentSkill[];
  feed: Array<{
    title: string; company_name: string; location?: string; work_mode?: string;
    skills?: string[]; skills_required?: string[]; experience_min?: number;
    verified?: boolean; source_url?: string;
  }>;
}): MediatorMatchResponse {
  const { student, skills, feed } = input;
  const verifiedSkills = new Set(
    skills.filter((s) => s.verified).map((s) => s.skill_name.trim().toLowerCase()),
  );

  // Demand map: how many feed jobs asked for each skill.
  const jobSkillDemand: Record<string, number> = {};
  for (const j of feed) {
    for (const s of j.skills_required?.length ? j.skills_required : (j.skills || [])) {
      const k = s.trim().toLowerCase();
      if (k) jobSkillDemand[k] = (jobSkillDemand[k] || 0) + 1;
    }
  }

  const recommendations = matchJobs(
    feed.map((j) => ({
      title: j.title,
      company: j.company_name,
      location: j.location,
      work_mode: j.work_mode,
      skills: j.skills_required?.length ? j.skills_required : (j.skills || []),
      experience_min: j.experience_min,
      verified: Boolean(j.verified),
      source_url: j.source_url,
    })),
    {
      skills,
      preferredLocations: student?.location ? [student.location] : [],
      maxExperienceYears: 0,
      verifiedSkills,
    },
    20,
  );

  const now = new Date().toISOString();
  return {
    ok: true,
    user_id: String(student?.id ?? 'local'),
    profile_summary: summarizeProfile(skills, { targetRole: student?.headline || undefined }),
    skill_verification: verifySkills(skills),
    recommendations,
    skill_gaps: computeSkillGaps({ skills, jobSkillDemand, protectedSkills: verifiedSkills }),
    jobs_source_status: {
      ok: true,
      message: feed.length > 0
        ? `In-house fallback matched against ${feed.length} verified listings loaded locally.`
        : 'In-house fallback — no job feed data loaded yet, recommendations will appear once the feed is available.',
      source: 'in-house',
    },
    metadata: { generated_at: now, engine: 'in-house-fallback', jobs_reviewed: feed.length },
    cached: false,
    fetched_at: now,
  };
}

/**
 * Career-match state for the dashboard. The mediator pipeline is expensive,
 * so we only run it when it can produce NEW value:
 *   - the dashboard opens and we have no valid result yet
 *   - the user explicitly hits "Refresh Recommendations"
 *   - the profile meaningfully changes or an assessment completes
 *     (callers trigger `refresh()` explicitly)
 * We never fire on every render or every navigation.
 */
interface CareerMatchState {
  result: MediatorMatchResult | null;
  loading: boolean;
  fetchedAt: string | null;
  /** Last call was served from the short-lived server cache. */
  cached: boolean;
  /** True when the last result was computed locally by the in-house engine. */
  usedFallback: boolean;
  /** Run a fresh /api/match through Skill Setu's API boundary. */
  refresh: () => Promise<void>;
  /** Best-effort load: skips when we already have a valid result. */
  ensureLoaded: () => Promise<MediatorMatchResult | null>;
}

const CareerMatchCtx = createContext<CareerMatchState | null>(null);

export function CareerMatchProvider({ children }: { children: ReactNode }) {
  const { isAuthed, role, authToken } = useAuth();
  const { student, mySkills, feed } = useApp();
  const [result, setResult] = useState<MediatorMatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const inFlight = useRef<Promise<MediatorMatchResult | null> | null>(null);
  const usedFallback = useRef(false);

  const run = useCallback(async (force: boolean): Promise<MediatorMatchResult | null> => {
    if (inFlight.current) return inFlight.current;
    const token = await authToken();
    const p = (async () => {
      setLoading(true);
      try {
        const r = await fetchCareerMatch(token, force);
        // If the API boundary is down/unreachable, fall back to the same
        // in-house engine running locally — never an empty dead card.
        if (!('ok' in r) || !r.ok) {
          const local = runClientFallback({
            student,
            skills: mySkills,
            feed,
          });
          usedFallback.current = true;
          setResult(local);
          setFetchedAt(new Date().toISOString());
          setCached(false);
          return local;
        }
        usedFallback.current = false;
        setResult(r);
        setFetchedAt(new Date().toISOString());
        setCached('cached' in r && Boolean(r.cached));
        return r;
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = p;
    return p;
  }, [authToken, student, mySkills, feed]);

  const refresh = useCallback(async () => {
    await run(true);
  }, [run]);

  const ensureLoaded = useCallback(async () => {
    // Already have something (valid or an explicit error state) → don't
    // re-run the whole pipeline just because the dashboard re-rendered.
    if (result) return result;
    return run(false);
  }, [result, run]);

  // Load once when a student lands on the dashboard with no saved result.
  useEffect(() => {
    if (isAuthed && role === 'student' && !result && !loading) {
      void ensureLoaded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, role]);

  return (
    <CareerMatchCtx.Provider value={{ result, loading, fetchedAt, cached, usedFallback: usedFallback.current, refresh, ensureLoaded }}>
      {children}
    </CareerMatchCtx.Provider>
  );
}

export function useCareerMatch() {
  const ctx = useContext(CareerMatchCtx);
  if (!ctx) throw new Error('useCareerMatch must be used inside CareerMatchProvider');
  return ctx;
}