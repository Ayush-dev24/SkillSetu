import supabase from './db-client.js';

// ---------------------------------------------------------------------------
// Server-side proxy for the External Verified Jobs Service (TrustJob.in v1.2.0)
// ---------------------------------------------------------------------------
// This endpoint fetches verified job listings from the external service via
// the mediator base URL (MEDIATOR_BASE_URL). It enforces:
//
//   ZERO-PII MANDATE: Student profile data (names, emails, IDs, GPAs,
//   transcripts, raw resumes) NEVER leaves this server. Only anonymous
//   filter parameters (q, city, skills, work_mode, sort, limit, page) are
//   sent to the external API.
//
//   SERVER-SIDE ONLY: This runs exclusively in the `api/` serverless
//   environment. No browser-exposed environment variables are used.
//
//   RESILIENCE: Handles upstream bugs (pagination HTTP 500 when page >
//   totalPages, skill tokenization, limit clamping) and provides in-memory
//   caching aligned with upstream Cache-Control: public, max-age=60.
//
// The external service base URL is configured via MEDIATOR_BASE_URL:
//   https://zd7pyl-1ost4ckeh-arcadawebapps9.vercel.app/api/v1/jobs
//
// Response is normalized to the existing FeedJob contract used by the UI.

const CACHE_TTL_MS = 60 * 1000; // 60 seconds, aligned with upstream Cache-Control
const MAX_LIMIT = 50; // upstream hard cap
const DEFAULT_LIMIT = 20;
const DEFAULT_SORT = 'recent';
const DEFAULT_COUNTRY = 'IN'; // India-only catalog

const TYPE_COLORS = {
  internship: '#0d7a5f',
  'micro-internship': '#2563eb',
  'same-day-task': '#e8930c',
  'part-time': '#7c3aed',
  'full-time': '#0e7490',
  challenge: '#dc2626',
};

const cache = new Map(); // queryString -> { fetchedAt, payload }

function getJobsApiCandidates() {
  const list = [];
  if (process.env.VERIFIED_JOBS_API_BASE) {
    const base = process.env.VERIFIED_JOBS_API_BASE.replace(/\/+$/, '');
    list.push(base.endsWith('/jobs') ? base : `${base}/jobs`);
  }
  const primaryMediator = (process.env.MEDIATOR_BASE_URL || 'https://skill-setu-mediator-e5l5.arcada.app').replace(/\/+$/, '');
  list.push(`${primaryMediator}/api/v1/jobs`);

  const fallbackMediator = (process.env.MEDIATOR_FALLBACK_URL || 'https://skill-setu-mediator-e5l5.arcada.app').replace(/\/+$/, '');
  list.push(`${fallbackMediator}/api/v1/jobs`);

  list.push('https://3jmczl-r104kkoiy-arcadawebapps8.vercel.app/api/v1/jobs');
  list.push('https://3jmczl-r104kkoiy-arcadawebapps8.vercel.app/api/jobs');

  return Array.from(new Set(list));
}

function buildQuery(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  return sp.toString();
}

function normalizeSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return null;
  // Split multi-word skills into comma tokens for reliable upstream matching
  const tokens = skills.flatMap(s => String(s).trim().toLowerCase().split(/\s+/).filter(Boolean));
  return tokens.length ? tokens.join(',') : null;
}

function clampLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

export async function fetchVerifiedJobs(filters = {}) {
  const {
    q, city, skills, work_mode, sort = DEFAULT_SORT, limit = DEFAULT_LIMIT, page = 1,
  } = filters;

  const queryParams = {
    q: q || null,
    city: city || null,
    skills: normalizeSkills(skills),
    work_mode: work_mode || null,
    country_code: DEFAULT_COUNTRY,
    sort,
    limit: clampLimit(limit),
    page: Math.max(1, Math.floor(Number(page) || 1)),
  };

  const queryString = buildQuery(queryParams);
  const cacheKey = queryString;

  // Cache lookup
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return { ...hit.payload, cached: true };
  }

  const endpoints = getJobsApiCandidates();
  let lastError = null;

  for (const baseEndpoint of endpoints) {
    const url = baseEndpoint.includes('?') ? `${baseEndpoint}&${queryString}` : `${baseEndpoint}?${queryString}`;
    try {
      const res = await fetchWithTimeout(url, 6000);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (res.status === 500 && /Requested range not satisfiable/i.test(text)) {
          return { success: true, data: [], pagination: { total: 0, page: queryParams.page, limit: queryParams.limit, totalPages: 0, has_next_page: false, has_prev_page: false }, filters_applied: queryParams, meta: { api_version: 'v1.2.0', timestamp: new Date().toISOString() }, cached: false };
        }
        console.warn(`[fetchVerifiedJobs] Endpoint ${url} returned status ${res.status}`);
        continue;
      }

      const payload = await res.json().catch(() => null);
      if (!payload) continue;

      const jobsData = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload.jobs) ? payload.jobs : []);

      const normalized = {
        success: true,
        data: jobsData,
        pagination: payload.pagination || { total: jobsData.length, page: queryParams.page, limit: queryParams.limit, totalPages: 1, has_next_page: false, has_prev_page: false },
        filters_applied: payload.filters_applied || queryParams,
        meta: payload.meta || { api_version: 'v1.2.0', timestamp: new Date().toISOString() },
        cached: false,
      };

      cache.set(cacheKey, { fetchedAt: Date.now(), payload: normalized });
      return normalized;
    } catch (e) {
      console.warn(`[fetchVerifiedJobs] ${url} failed:`, e.message);
      lastError = e;
    }
  }

  throw lastError || new Error('All verified jobs service endpoints were unreachable');
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function mapExternalJob(j) {
  const salary = j.salary || {};
  const experience = j.experience || {};
  const workMode = String(j.work_mode || 'ON_SITE');
  const employmentType = String(j.employment_type || 'FULL_TIME');
  const publishedAt = String(j.published_at || '');
  const type = employmentType.toLowerCase();

  return {
    id: String(j.id),
    internal_id: null,
    title: String(j.title || 'Untitled role'),
    company_name: String(j.company || 'Verified employer'),
    company_id: 0,
    location: String(j.location || j.city || 'India'),
    remote: workMode === 'REMOTE',
    type,
    domain: 'Jobs',
    stipend: String(salary.formatted || 'See listing'),
    salary_text: String(salary.formatted || ''),
    source: String(j.source || 'TrustJob.in'),
    source_url: String(j.application_url || ''),
    external_id: String(j.id),
    skills: Array.isArray(j.skills) ? j.skills.map(String) : [],
    skills_required: Array.isArray(j.skills) ? j.skills.map(String) : [],
    summary: String(j.summary || j.description || ''),
    description: String(j.description || j.summary || ''),
    posted_text: publishedAt ? new Date(publishedAt).toLocaleDateString() : 'Recently posted',
    posted_at: publishedAt,
    urgency: 'flexible',
    starts_in: workMode === 'REMOTE' ? 'Remote start' : String(j.city || 'India'),
    duration: employmentType,
    openings: 1,
    applicants_count: 0,
    status: 'open',
    color: TYPE_COLORS[type] || '#0d7a5f',
    verified: j.verification?.status === 'VERIFIED_SAFE',
    external: true,
    trust_score: Number(j.trust_score || 0),
    experience_min: Number(experience.min || 0),
    work_mode: workMode,
    employment_type: employmentType,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { q, city, type, work_mode, sort, limit, page, skills } = req.query;

    // 1) Fetch verified external jobs from the mediator (TrustJob.in)
    let external = [];
    let extMeta = null;
    try {
      const result = await fetchVerifiedJobs({
        q: q || undefined,
        city: city || undefined,
        work_mode: work_mode || undefined,
        sort: sort || undefined,
        limit: limit || undefined,
        page: page || undefined,
        skills: skills ? String(skills).split(',') : undefined,
      });
      external = (result.data || []).map(mapExternalJob);
      extMeta = {
        total: result.pagination?.total ?? 0,
        page: result.pagination?.page ?? 1,
        limit: result.pagination?.limit ?? DEFAULT_LIMIT,
        totalPages: result.pagination?.totalPages ?? 0,
        has_next_page: result.pagination?.has_next_page ?? false,
        sources: { 'TrustJob.in': 'https://trustjob.in' },
        updated_at: result.meta?.timestamp || new Date().toISOString(),
        notice: 'Verified India jobs from TrustJob.in. Confirm details on the employer listing before applying.',
        cached: result.cached,
      };
    } catch (e) {
      console.warn('Verified jobs feed unavailable, falling back to internal only:', e.message);
      external = [];
      extMeta = {
        total: 0,
        page: 1,
        limit: DEFAULT_LIMIT,
        totalPages: 0,
        has_next_page: false,
        sources: { 'TrustJob.in': 'https://trustjob.in' },
        updated_at: new Date().toISOString(),
        notice: 'Using internal postings only because the verified jobs feed is temporarily unavailable.',
        cached: false,
      };
    }

    // 2) Internal postings reshaped to the same card contract
    // (Resilient to PostgREST relationship errors: resolve the company name
    // separately so a missing FK/relation never breaks the whole feed.)
    let iq = supabase.from('opportunities').select('*').eq('status', 'open');
    if (type) iq = iq.eq('type', type);
    if (q) {
      const s = String(q).slice(0, 80);
      iq = iq.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    }
    const { data: intRows, error: intErr } = await iq.order('id', { ascending: false }).limit(200);
    if (intErr) throw intErr;

    // Load company names once (best-effort; missing column/table → fallback).
    let companyNames = {};
    try {
      const { data: comps } = await supabase.from('companies').select('id,name').limit(100);
      for (const c of comps || []) companyNames[String(c.id)] = c.name;
    } catch (e) {
      console.warn('[jobs-feed] companies lookup failed, using placeholders:', e.message);
    }

    const internal = (intRows || []).map((o) => ({
      id: `in-${o.id}`,
      internal_id: o.id,
      title: o.title,
      company_name: companyNames[String(o.company_id)] ?? 'Partner company',
      company_id: o.company_id,
      location: o.remote ? 'Remote' : o.location,
      remote: o.remote,
      type: o.type,
      domain: o.domain,
      stipend: o.stipend,
      salary_text: o.stipend,
      source: 'SkillSetu Verified',
      source_url: '',
      external_id: null,
      skills: o.skills_required || [],
      skills_required: o.skills_required || [],
      summary: o.description,
      description: o.description,
      posted_text: o.posted_at,
      posted_at: daysAgo(0),
      urgency: o.urgency,
      starts_in: o.starts_in,
      duration: o.duration,
      openings: o.openings,
      applicants_count: o.applicants_count,
      status: o.status,
      color: o.color || TYPE_COLORS[o.type] || '#0d7a5f',
      verified: true,
      external: false,
    }));

    let rows = [...internal, ...external];
    const lim = Math.max(1, Math.min(200, Number(limit) || 200));
    rows = rows.slice(0, lim);

    return res.status(200).json({
      jobs: rows,
      count: rows.length,
      internal_count: internal.length,
      external_count: external.length,
      updated_at: new Date().toISOString(),
      meta: extMeta,
    });
  } catch (err) {
    console.error('jobs-feed API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
