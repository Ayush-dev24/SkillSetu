import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiGet, smartFetch } from '../lib/engine';
import supabase from '../lib/supabase';
import { demoCompanies, demoStudents, demoSkills, demoOpportunities, demoCourses, demoCareers, demoSkillDemand, demoPlacements, demoApplications, demoCertificates, demoWorkspaces, demoFeed } from '../lib/demo-data';
import type { Student, StudentSkill, Opportunity, Company, Career, Course, SkillDemand, Placement, Application, Certificate, TaskWorkspace } from '../lib/engine';

export type Role = 'student' | 'company' | 'college' | 'ministry';

interface Overview {
  students: number; companies: number; opportunities: number;
  instant_count: number; open_count: number; applications: number;
  avg_readiness: number; colleges: { name: string; count: number }[];
}

export interface FeedJob {
  id: string | number; internal_id: number | null;
  title: string; company_name: string; company_id: number;
  location: string; remote: boolean; type: string; domain: string;
  stipend: string; salary_text: string; source: string; source_url: string;
  external_id: string | null; skills: string[]; skills_required: string[];
  summary: string; description: string; posted_text: string; posted_at: string;
  urgency: string; starts_in: string; duration: string; openings: number;
  applicants_count: number; status: string; color: string;
  verified: boolean; external: boolean; trust_score?: number; experience_min?: number;
  work_mode?: string; employment_type?: string;
}

interface FeedMeta {
  count: number; internal_count: number; external_count: number;
  sources: Record<string, string>; updated_at: string; notice: string;
  page: number; limit: number; total_pages: number; has_next_page: boolean;
}

export interface JobsQuery {
  q?: string; city?: string; location?: string; company?: string; skills?: string;
  work_mode?: string; employment_type?: string; experience?: string;
  min_trust?: string; sort?: string; page?: number; limit?: number;
}

interface AppState {
  loading: boolean; error: string | null;
  students: Student[]; allSkills: StudentSkill[]; opportunities: Opportunity[];
  companies: Company[]; careers: Career[]; courses: Course[];
  demand: SkillDemand[]; placements: Placement[]; applications: Application[];
  certificates: Certificate[]; workspaces: TaskWorkspace[];
  feed: FeedJob[]; feedMeta: FeedMeta | null; feedLoading: boolean;
  overview: Overview | null;
  studentId: number; setStudentId: (n: number) => void;
  role: Role; setRole: (r: Role) => void;
  student: Student | undefined;
  mySkills: StudentSkill[];
  myApplications: Application[];
  myCertificates: Certificate[];
  myWorkspaces: TaskWorkspace[];
  companyOf: (id: number) => Company | undefined;
  refresh: () => Promise<void>;
  fetchFeed: (query?: JobsQuery, silent?: boolean) => Promise<void>;
}

const AppCtx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allSkills, setAllSkills] = useState<StudentSkill[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [careers, setCareers] = useState<Career[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [demand, setDemand] = useState<SkillDemand[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [workspaces, setWorkspaces] = useState<TaskWorkspace[]>([]);
  const [feed, setFeed] = useState<FeedJob[]>([]);
  const [feedMeta, setFeedMeta] = useState<FeedMeta | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [studentId, setStudentId] = useState(1);
  const [role, setRole] = useState<Role>('student');

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = session?.access_token ?? null;

      const fallback = {
        students: demoStudents,
        skills: demoSkills,
        opportunities: demoOpportunities,
        companies: demoCompanies,
        careers: demoCareers,
        courses: demoCourses,
        demand: demoSkillDemand,
        placements: demoPlacements,
        applications: demoApplications,
        overview: {
          students: demoStudents.length,
          companies: demoCompanies.length,
          opportunities: demoOpportunities.length,
          instant_count: demoOpportunities.filter((o) => o.urgency === 'instant').length,
          open_count: demoOpportunities.filter((o) => o.status === 'open').length,
          applications: demoApplications.length,
          avg_readiness: 82,
          colleges: [{ name: 'National Institute of Ayurveda', count: 1 }],
        },
        certificates: demoCertificates,
        workspaces: demoWorkspaces,
      };

      try {
        const [st, sk, op, co, ca, cu, de, pl, ap, ov, certs, ws] = await Promise.all([
          apiGet<Student[]>('/api/students'),
          apiGet<StudentSkill[]>('/api/student-skills'),
          apiGet<Opportunity[]>('/api/opportunities'),
          apiGet<Company[]>('/api/companies'),
          apiGet<Career[]>('/api/careers'),
          apiGet<Course[]>('/api/courses'),
          apiGet<SkillDemand[]>('/api/skill-demand'),
          apiGet<Placement[]>('/api/placements'),
          apiGet<Application[]>('/api/applications', token ?? undefined),
          apiGet<Overview>('/api/skill-gap'),
          apiGet<Certificate[]>('/api/certificates').catch(() => [] as Certificate[]),
          apiGet<TaskWorkspace[]>('/api/task-workspaces').catch(() => [] as TaskWorkspace[]),
        ]);

        setStudents(st); setAllSkills(sk); setOpportunities(op);
        setCompanies(co); setCareers(ca); setCourses(cu);
        setDemand(de); setPlacements(pl); setApplications(ap); setOverview(ov);
        setCertificates(certs); setWorkspaces(ws);
        return;
      } catch {
        setStudents(fallback.students);
        setAllSkills(fallback.skills);
        setOpportunities(fallback.opportunities);
        setCompanies(fallback.companies);
        setCareers(fallback.careers);
        setCourses(fallback.courses);
        setDemand(fallback.demand);
        setPlacements(fallback.placements);
        setApplications(fallback.applications);
        setOverview(fallback.overview);
        setCertificates(fallback.certificates);
        setWorkspaces(fallback.workspaces);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Unified live jobs feed (internal + verified external) with polling so
  // new vacancies reach students within a minute, without a page reload.
  const fetchFeed = useCallback(async (query: JobsQuery = {}, silent = false) => {
    if (!silent) setFeedLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries({ ...query, limit: query.limit ?? 50 }).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      const r = await smartFetch(`/api/jobs-feed?${params.toString()}`);
      if (!r.ok) throw new Error(`Feed failed (${r.status})`);
      const data = await r.json();

      // Support both our /api/jobs-feed shape ({jobs: [...]}) and the raw
      // external /api/v1/jobs shape ({success, data: [...]}) that smartFetch
      // may fall back to when the SkillSetu serverless function is unavailable.
      let rawJobs: unknown[] | null = null;
      let isRawExternal = false;
      if (Array.isArray(data.jobs)) {
        rawJobs = data.jobs;
      } else if (Array.isArray(data.data)) {
        rawJobs = data.data;
        isRawExternal = true;
      }

      if (rawJobs) {
        const TYPE_COLORS: Record<string, string> = {
          internship: '#0d7a5f', 'micro-internship': '#2563eb', 'same-day-task': '#e8930c',
          'part-time': '#7c3aed', 'full-time': '#0e7490', challenge: '#dc2626',
        };
        const jobs: FeedJob[] = isRawExternal
          ? (rawJobs as Record<string, unknown>[]).map((j) => {
              const salary = (j.salary as Record<string, unknown>) || {};
              const workMode = String(j.work_mode || 'ON_SITE');
              const empType = String(j.employment_type || 'FULL_TIME').toLowerCase();
              const publishedAt = String(j.published_at || '');
              return {
                id: String(j.id), internal_id: null,
                title: String(j.title || 'Untitled role'),
                company_name: String(j.company || 'Verified employer'),
                company_id: 0,
                location: String((j.location as string) || (j.city as string) || 'India'),
                remote: workMode === 'REMOTE', type: empType, domain: 'Jobs',
                stipend: String((salary as Record<string, unknown>).formatted || 'See listing'),
                salary_text: String((salary as Record<string, unknown>).formatted || ''),
                source: String(j.source || 'TrustJob.in'),
                source_url: String(j.application_url || ''),
                external_id: String(j.id),
                skills: Array.isArray(j.skills) ? (j.skills as string[]).map(String) : [],
                skills_required: Array.isArray(j.skills) ? (j.skills as string[]).map(String) : [],
                summary: String(j.summary || j.description || ''),
                description: String(j.description || j.summary || ''),
                posted_text: publishedAt ? new Date(publishedAt).toLocaleDateString() : 'Recently posted',
                posted_at: publishedAt,
                urgency: 'flexible', starts_in: workMode === 'REMOTE' ? 'Remote start' : String((j.city as string) || 'India'),
                duration: empType, openings: 1, applicants_count: 0, status: 'open',
                color: TYPE_COLORS[empType] || '#0d7a5f',
                verified: (j.verification as Record<string, unknown>)?.status === 'VERIFIED_SAFE',
                external: true, trust_score: Number(j.trust_score || 0),
                experience_min: Number(((j.experience as Record<string, unknown>)?.min) || 0),
                work_mode: workMode, employment_type: empType,
              } as FeedJob;
            })
          : (rawJobs as FeedJob[]);

        setFeed((prev) => {
          // Preserve object identity when nothing changed → no UI churn.
          if (prev.length === jobs.length && prev.every((p, i) => String(p.id) === String(jobs[i].id))) return prev;
          return jobs;
        });
        setFeedMeta({
          count: data.count ?? data.pagination?.total ?? jobs.length,
          internal_count: data.internal_count ?? 0,
          external_count: data.external_count ?? (isRawExternal ? jobs.length : 0),
          sources: data.meta?.sources || (isRawExternal ? { 'TrustJob.in': 'https://trustjob.in' } : {}),
          updated_at: data.updated_at || data.meta?.timestamp || new Date().toISOString(),
          notice: data.meta?.notice || 'Verified India jobs. Confirm details on the employer listing before applying.',
          page: data.meta?.page ?? data.pagination?.page ?? query.page ?? 1,
          limit: data.meta?.limit ?? data.pagination?.limit ?? query.limit ?? 50,
          total_pages: data.meta?.totalPages ?? data.pagination?.totalPages ?? 1,
          has_next_page: Boolean(data.meta?.has_next_page ?? data.pagination?.has_next_page),
        });
      }
    } catch {
      setFeed(demoFeed);
      setFeedMeta({
        count: demoFeed.length,
        internal_count: 0,
        external_count: demoFeed.length,
        sources: { LinkedIn: 'https://www.linkedin.com/jobs', Naukri: 'https://www.naukri.com/' },
        updated_at: new Date().toISOString(),
        notice: 'Using local preview data because the verified jobs feed is temporarily unavailable.',
        page: 1, limit: demoFeed.length, total_pages: 1, has_next_page: false,
      });
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); fetchFeed({ sort: 'recent', page: 1, limit: 50 }); }, [refresh, fetchFeed]);

  // Real-time updates: poll the feed every 60s + refresh instantly when the
  // tab regains focus or the network reconnects.
  useEffect(() => {
    const t = setInterval(() => fetchFeed({ sort: 'recent', page: 1, limit: 50 }, true), 60000);
    const onFocus = () => fetchFeed({ sort: 'recent', page: 1, limit: 50 }, true);
    const onOnline = () => { fetchFeed({ sort: 'recent', page: 1, limit: 50 }, true); refresh(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [fetchFeed, refresh]);

  const student = useMemo(() => students.find((s) => s.id === studentId) ?? students[0], [students, studentId]);
  const mySkills = useMemo(() => allSkills.filter((s) => s.student_id === (student?.id ?? studentId)), [allSkills, student, studentId]);
  const myApplications = useMemo(() => applications.filter((a) => a.student_id === (student?.id ?? studentId)), [applications, student, studentId]);
  const myCertificates = useMemo(() => certificates.filter((c) => c.student_id === (student?.id ?? studentId)), [certificates, student, studentId]);
  const myWorkspaces = useMemo(() => workspaces.filter((w) => w.student_id === (student?.id ?? studentId)), [workspaces, student, studentId]);
  const companyOf = useCallback((id: number) => companies.find((c) => c.id === id), [companies]);

  return (
    <AppCtx.Provider value={{
      loading, error, students, allSkills, opportunities, companies, careers,
      courses, demand, placements, applications, certificates, workspaces, overview,
      feed, feedMeta, feedLoading, fetchFeed,
      studentId: student?.id ?? studentId, setStudentId, role, setRole,
      student, mySkills, myApplications, myCertificates, myWorkspaces, companyOf, refresh,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
