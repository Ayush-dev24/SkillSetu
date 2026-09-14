// Server-side mirror of src/lib/normalization.ts (ESM, dependency-free).
// Keep in sync with the frontend copy — any alias added here must be added
// there too, and vice versa.

/** Canonical location tokens (lower-cased keys → canonical city). */
const LOCATION_ALIASES = {
  bangalore: 'Bengaluru',
  'bangalore rural': 'Bengaluru',
  bengaluru: 'Bengaluru',
  bengalurur: 'Bengaluru',
  'new delhi': 'New Delhi',
  delhi: 'New Delhi',
  'new delhi ncr': 'New Delhi',
  ncr: 'New Delhi',
  gurgaon: 'Gurugram',
  gurugram: 'Gurugram',
  mumbai: 'Mumbai',
  bombay: 'Mumbai',
  'new york': 'New York',
  'san francisco': 'San Francisco',
  'bay area': 'San Francisco',
  london: 'London',
  remote: 'Remote',
};

export function normalizeCity(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const t = s.toLowerCase();
  if (LOCATION_ALIASES[t]) return LOCATION_ALIASES[t];
  for (const [key, val] of Object.entries(LOCATION_ALIASES)) {
    if (t.includes(key)) return val;
  }
  return s;
}

export const normalizeLocation = normalizeCity;

export function workModeOf(raw) {
  const s = String(raw || '').toLowerCase().replace(/[\s_]+/g, '');
  if (!s) return null;
  if (s.includes('remote') || s.includes('workfromhome') || s.includes('wfh')) return 'REMOTE';
  if (s.includes('hybrid')) return 'HYBRID';
  if (s.includes('onsite') || s.includes('on-site') || s.includes('office')) return 'ON_SITE';
  return null;
}