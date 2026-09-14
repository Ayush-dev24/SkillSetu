// Server-side Mediator client for the Skill Setu career-matching mediator.
// ---------------------------------------------------------------------------
// SECURITY: this module runs ONLY on the server (api/). It reads mediator
// configuration from server-side environment variables and never exposes
// them to the browser:
//
//   MEDIATOR_BASE_URL = the deployed mediator origin (staging / production)
//   MEDIATOR_API_KEY  = optional. When set, an `x-api-key` header is sent.
//                       When empty/unset, requests go out without a key
//                       (the deployed staging mediator currently allows
//                       unauthenticated access). Skill Setu never sends the
//                       key from the client.
//
// IMPORTANT: The mediator endpoints use .js extension (e.g., /api/match.js,
// /api/health.js). This file handles the correct routing.
//
// All outbound calls are wrapped in a configurable timeout (default 12s) so
// an unresponsive mediator can never hang a Skill Setu API route.

const DEFAULT_TIMEOUT_MS = 12000;

export const PRIMARY_MEDIATOR_URL = (process.env.MEDIATOR_BASE_URL || 'https://skill-setu-mediator-e5l5.arcada.app').replace(/\/+$/, '');
export const FALLBACK_MEDIATOR_URL = (process.env.MEDIATOR_FALLBACK_URL || 'https://skill-setu-mediator-e5l5.arcada.app').replace(/\/+$/, '');

export function mediatorBaseUrl() {
  return PRIMARY_MEDIATOR_URL || FALLBACK_MEDIATOR_URL;
}

export function mediatorConfigured() {
  return Boolean(mediatorBaseUrl());
}

// Map internal endpoint names to the actual mediator routes (with .js extension)
const ENDPOINT_MAP = {
  'health': '/api/health.js',
  'match': '/api/match.js',
  'profile': '/api/profile.js',
  'recommendations': '/api/recommendations.js',
  'skills/verify': '/api/skills/verify.js',
  'assessment/start': '/api/assessment/start.js',
  'assessment/submit': '/api/assessment/submit.js',
  'resume/analyze': '/api/resume/analyze.js',
};

function resolveMediatorPath(path) {
  // If path already has .js extension, use as-is
  if (path.endsWith('.js')) return path;
  // Check if it's a known endpoint
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  if (ENDPOINT_MAP[cleanPath]) return ENDPOINT_MAP[cleanPath];
  // Default: prepend /api/ and add .js
  return `/api/${cleanPath}.js`;
}

function buildHeaders(json = true) {
  const headers = { Accept: 'application/json' };
  if (json) headers['Content-Type'] = 'application/json';
  // Authentication-ready: only send a key when the operator configured one.
  const key = process.env.MEDIATOR_API_KEY || '';
  if (key) headers['x-api-key'] = key;
  return headers;
}

async function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS, label = 'request') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Mediator ${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Low-level fetch to the mediator with timeout + status normalization.
 * Returns { ok, status, body } where body is the parsed JSON (or null when
 * the payload was not JSON). Retries with fallback URL if primary fails.
 */
export async function mediatorFetch(path, options = {}) {
  const cleanPath = resolveMediatorPath(path);
  const bases = Array.from(new Set([PRIMARY_MEDIATOR_URL, FALLBACK_MEDIATOR_URL].filter(Boolean)));
  if (bases.length === 0) {
    throw new Error('Mediator is not configured (MEDIATOR_BASE_URL is empty).');
  }

  let lastError = null;
  for (let i = 0; i < bases.length; i++) {
    const base = bases[i];
    const url = `${base}${cleanPath}`;
    const { timeoutMs, ...fetchOpts } = options;
    try {
      const res = await withTimeout(fetch(url, {
        ...fetchOpts,
        headers: { ...buildHeaders(!(fetchOpts.body == null)), ...(fetchOpts.headers || {}) },
      }), timeoutMs || DEFAULT_TIMEOUT_MS, `request to ${cleanPath}`);

      let body = null;
      const raw = await res.text();
      if (raw) {
        try { body = JSON.parse(raw); } catch { body = null; }
      }

      if (!res.ok && (res.status >= 500 || res.status === 404) && i < bases.length - 1) {
        console.warn(`[mediatorFetch] ${url} returned status ${res.status}, retrying fallback mediator...`);
        continue;
      }

      return { ok: res.ok, status: res.status, body };
    } catch (e) {
      console.warn(`[mediatorFetch] Request to ${url} failed:`, e.message);
      lastError = e;
    }
  }

  throw lastError || new Error(`Mediator request failed for ${cleanPath}`);
}

/** GET ${base}/api/health.js — used for diagnostics, never for hard dependency. */
export async function mediatorHealth() {
  const res = await mediatorFetch('/api/health', { timeoutMs: 8000 });
  return { ok: res.ok, status: res.status, body: res.body };
}

/** POST ${base}/api/match.js — main matching pipeline. */
export async function mediatorMatch(payload, options = {}) {
  return mediatorFetch('/api/match', { method: 'POST', body: JSON.stringify(payload), ...options });
}

/** GET ${base}/api/profile/{userId}/skills.js — fast read of verified skills. */
export async function mediatorProfileSkills(userId) {
  return mediatorFetch(`/api/profile/${userId}/skills`, { timeoutMs: 8000 });
}

/** GET ${base}/api/recommendations/{userId}.js — fast read of existing recommendations. */
export async function mediatorRecommendations(userId) {
  return mediatorFetch(`/api/recommendations/${userId}`, { timeoutMs: 8000 });
}

/** POST ${base}/api/skills/verify.js — submit skill evidence for verification. */
export async function mediatorSkillVerify(payload) {
  return mediatorFetch('/api/skills/verify', { method: 'POST', body: JSON.stringify(payload) });
}

/** POST ${base}/api/assessment/start.js — start an assessment. */
export async function mediatorAssessmentStart(payload) {
  return mediatorFetch('/api/assessment/start', { method: 'POST', body: JSON.stringify(payload) });
}

/** POST ${base}/api/assessment/submit.js — submit assessment answers. */
export async function mediatorAssessmentSubmit(payload) {
  return mediatorFetch('/api/assessment/submit', { method: 'POST', body: JSON.stringify(payload) });
}

/** POST ${base}/api/resume/analyze.js — analyze resume for skills. */
export async function mediatorResumeAnalyze(payload) {
  return mediatorFetch('/api/resume/analyze', { method: 'POST', body: JSON.stringify(payload) });
}