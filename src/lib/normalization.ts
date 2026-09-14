/**
 * Skill Setu — in-house skill & location normalization.
 *
 * This module is the single source of truth for turning the many ways a user
 * (or a job) can write a skill into one canonical, comparable token. It is
 * pure, deterministic, and dependency-free so it can run both in the browser
 * (TypeScript / Vite) and be mirrored in the backend (Node / Vercel) without
 * any external calls.
 *
 * Rules:
 *  - Lower-case, trimmed comparison keys (case-insensitive matching).
 *  - Abbreviations + common misspellings map to a canonical name.
 *  - "Related" synonyms (e.g. MySQL/PostgreSQL) collapse to one canonical
 *    token so scoring stays consistent, but the ORIGINAL user value is
 *    always preserved by callers via `normalizeSkillList`.
 *  - Locations are normalized so "Bangalore"/"Bengaluru" match the same job.
 */

type AliasMap = Record<string, string>;

/**
 * Core alias table. Keys are lower-cased, trimmed lookup tokens.
 * Values are the canonical skill names Skill Setu keeps internally.
 */
export const SKILL_ALIASES: AliasMap = {
  // ── Programming languages ──
  python: 'Python',
  'c++': 'C++',
  cpp: 'C++',
  'c#': 'C#',
  java: 'Java',
  'core java': 'Java',
  javascript: 'JavaScript',
  js: 'JavaScript',
  es6: 'JavaScript',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  'node.js': 'Node.js',
  nodejs: 'Node.js',
  'node js': 'Node.js',
  'express js': 'Express',
  express: 'Express',
  go: 'Go',
  golang: 'Go',
  'go lang': 'Go',
  rust: 'Rust',
  kotlin: 'Kotlin',
  swift: 'Swift',
  'c language': 'C',
  ' c ': 'C',

  // ── Web / frontend ──
  react: 'React',
  'react.js': 'React',
  'reactjs': 'React',
  angular: 'Angular',
  angularjs: 'Angular',
  'vue js': 'Vue',
  vuejs: 'Vue',
  vue: 'Vue',
  svelte: 'Svelte',
  html: 'HTML',
  'html5': 'HTML',
  css: 'CSS',
  'css3': 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  tailwind: 'Tailwind CSS',
  'tailwindcss': 'Tailwind CSS',
  bootstrap: 'Bootstrap',
  rest: 'REST APIs',
  'rest api': 'REST APIs',
  'restful api': 'REST APIs',
  'apis': 'REST APIs',
  graphql: 'GraphQL',
  websocket: 'WebSockets',

  // ── Backend / cloud / infra ──
  'aws': 'AWS',
  amazon: 'AWS',
  sagemaker: 'AWS SageMaker',
  lambda: 'AWS Lambda',
  'gcp': 'GCP',
  google: 'GCP',
  'google cloud': 'GCP',
  azure: 'Azure',
  'microsoft azure': 'Azure',
  docker: 'Docker',
  kubernetes: 'Kubernetes',
  k8s: 'Kubernetes',
  'jenkins': 'CI/CD',
  'ci/cd': 'CI/CD',
  'github actions': 'CI/CD',
  'git': 'Git',
  github: 'Git',
  gitlab: 'Git',
  'agile': 'Agile',
  'scrum': 'Scrum',
  devops: 'DevOps',
  'microservices': 'Microservices',
  'distributed systems': 'Distributed Systems',

  // ── Databases ──
  sql: 'SQL',
  'sql server': 'SQL Server',
  mysql: 'SQL',
  postgresql: 'SQL',
  postgres: 'SQL',
  'postgre sql': 'SQL',
  mongodb: 'MongoDB',
  'mongo db': 'MongoDB',
  redis: 'Redis',
  elasticsearch: 'Elasticsearch',

  // ── Data / ML ──
  'machine learning': 'Machine Learning',
  ml: 'Machine Learning',
  'deep learning': 'Deep Learning',
  dl: 'Deep Learning',
  'natural language processing': 'NLP',
  nlp: 'Natural Language Processing',
  'computer vision': 'Computer Vision',
  tensorflow: 'TensorFlow',
  pytorch: 'PyTorch',
  'scikit learn': 'Scikit-Learn',
  sklearn: 'Scikit-Learn',
  pandas: 'Pandas',
  numpy: 'NumPy',
  matplotlib: 'Matplotlib',
  'data analysis': 'Data Analysis',
  'data science': 'Data Science',
  'data visualization': 'Data Visualization',
  tableau: 'Tableau',
  'power bi': 'Power BI',
  excel: 'Excel',
  'r language': 'R',
  ' r ': 'R',
  'statistical analysis': 'Statistics',

  // ── Testing ──
  testing: 'Testing',
  'qa': 'Testing',
  selenium: 'Selenium',
  'unit testing': 'Testing',

  // ── Security ──
  cybersecurity: 'Cybersecurity',
  security: 'Cybersecurity',
  'penetration testing': 'Penetration Testing',
  'pen testing': 'Penetration Testing',

  // ── Ayush / wellness domain ──
  ayurveda: 'Ayurveda',
  ayurvedic: 'Ayurveda',
  'panchakarma': 'Panchakarma',
  'basti': 'Panchakarma',
  'vamana': 'Panchakarma',
  'virechana': 'Panchakarma',
  'nasya': 'Panchakarma',
  'abhyanga': 'Panchakarma',
  'pulse diagnosis': 'Ayurvedic Diagnosis',
  'nadi pariksha': 'Ayurvedic Diagnosis',
  'pariksha': 'Ayurvedic Diagnosis',
  'diagnosis': 'Ayurvedic Diagnosis',
  'clinical documentation': 'Clinical Documentation',
  'case sheet': 'Clinical Documentation',
  'patient counselling': 'Patient Counselling',
  'patient counseling': 'Patient Counselling',
  'nutrition': 'Nutrition & Dietetics',
  'dietetics': 'Nutrition & Dietetics',
  'herbal pharmacology': 'Herbal Pharmacology',
  'dravyaguna': 'Herbal Pharmacology',
  'formulation': 'Herbal Pharmacology',
  'telemedicine': 'Telemedicine',
  'content strategy': 'Content Strategy',
  'content writing': 'Content Writing',
  'digital marketing': 'Digital Marketing',
  'seo': 'SEO',
  'sem': 'SEM',
  'public speaking': 'Public Speaking',
  'presentation': 'Public Speaking',
  'yoga therapy': 'Yoga Therapy',
  'asana': 'Yoga Therapy',
  'pranayama': 'Yoga Therapy',
  research: 'Research Writing',
  'research writing': 'Research Writing',
  'literature review': 'Research Writing',
  'paper publication': 'Research Writing',

  // ── Design / product ──
  'ui design': 'UI Design',
  'ui': 'UI Design',
  'ux design': 'UX Design',
  'ux': 'UX Design',
  figma: 'Figma',
  'wireframing': 'UI Design',
  'product management': 'Product Management',
};

/** Canonical location tokens (lower-cased keys → canonical city). */
export const LOCATION_ALIASES: AliasMap = {
  bangalore: 'Bengaluru',
  'bangalore rural': 'Bengaluru',
  'bengaluru': 'Bengaluru',
  'bengalurur': 'Bengaluru',
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

export type NormalizedSkill = { original: string; canonical: string };

/**
 * Normalize a single skill string.
 * Returns the canonical skill name, or the trimmed original (title-cased) if
 * no alias exists — so unknown skills are never dropped.
 */
export function normalizeSkill(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return '';
  if (SKILL_ALIASES[s]) return SKILL_ALIASES[s];
  // Try removing common multi-word fluff and re-look up.
  const cleaned = s.replace(/\s+/g, ' ').trim();
  if (SKILL_ALIASES[cleaned]) return SKILL_ALIASES[cleaned];
  // Fall back: title-case the original so it's displayable.
  return cleaned
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

/**
 * Normalize a location string to a canonical city (case-insensitive).
 */
export function normalizeLocation(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const t = s.toLowerCase();
  if (LOCATION_ALIASES[t]) return LOCATION_ALIASES[t];
  // Match on any known alias token present in the string.
  for (const [key, val] of Object.entries(LOCATION_ALIASES)) {
    if (t.includes(key)) return val;
  }
  return s;
}

/** Alias for normalizeLocation (used by matching.ts). */
export const normalizeCity = normalizeLocation;

/** Loose text match for "Remote"/"Hybrid"/"On-site" work-mode strings. */
export function workModeOf(raw: unknown): 'REMOTE' | 'HYBRID' | 'ON_SITE' | null {
  const s = String(raw || '').toLowerCase().replace(/[\s_]+/g, '');
  if (!s) return null;
  if (s.includes('remote') || s.includes('workfromhome') || s.includes('wfh')) return 'REMOTE';
  if (s.includes('hybrid')) return 'HYBRID';
  if (s.includes('onsite') || s.includes('on-site') || s.includes('office')) return 'ON_SITE';
  return null;
}

/**
 * Normalize a list of skill strings, de-duplicating by canonical name while
 * preserving the FIRST original spelling for display.
 */
export function normalizeSkillList(raw: (string | undefined)[]): NormalizedSkill[] {
  const seen = new Set<string>();
  const out: NormalizedSkill[] = [];
  for (const r of raw) {
    const original = String(r ?? '').trim();
    if (!original) continue;
    const canonical = normalizeSkill(original);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push({ original, canonical });
  }
  return out;
}

/**
 * Lexicon for extracting skills from free text (resumes, project
 * descriptions). Deterministic — never invents evidence it cannot cite.
 * Returns canonical, de-duplicated skill names.
 */
const EXTRACTION_LEXICON: [string, RegExp][] = [
  ['Python', /\b(python|pandas|numpy|django|flask)\b/i],
  ['Java', /\b(java|spring|jdbc)\b/i],
  ['JavaScript', /\b(javascript|js|react|node\.?js|nodejs|angular|vue|typescript)\b/i],
  ['SQL', /\b(sql|mysql|postgres|postgresql|queries|database|rdms)\b/i],
  ['Machine Learning', /\b(machine learning|ml\b|scikit|tensorflow|pytorch|model training)\b/i],
  ['Cloud Computing', /\b(aws|amazon web services|azure|gcp|google cloud|docker|deploy|kubernetes|k8s)\b/i],
  ['Data Analysis', /\b(data analysis|excel|power bi|tableau|data cleaning|dashboard)\b/i],
  ['REST APIs', /\b(rest api|restful|api development|postman|endpoints)\b/i],
  ['Software Testing', /\b(testing|qa|selenium|test cases|bug report)\b/i],
  ['UI Design', /\b(ui design|figma|wireframe|prototype|html|css)\b/i],
  ['Digital Marketing', /\b(seo|sem|digital marketing|content marketing|instagram|campaign)\b/i],
  ['Public Speaking', /\b(public speaking|presentation|anchoring|workshop)\b/i],
  ['Research Writing', /\b(research|paper|publication|literature review)\b/i],
  ['Git', /\b(git|github|gitlab|version control)\b/i],
  ['Ayurveda', /\b(ayurveda|ayurvedic|ayurveda)\b/i],
  ['Ayurvedic Diagnosis', /\b(nadi pariksha|pulse diagnosis|pariksha|dosha)\b/i],
  ['Clinical Documentation', /\b(clinical documentation|case sheet|case study|discharge summary)\b/i],
  ['Patient Counselling', /\b(counselling|counseling|patient communication|diet counselling)\b/i],
  ['Nutrition & Dietetics', /\b(nutrition|dietetics|diet|ahara)\b/i],
  ['Herbal Pharmacology', /\b(herbal|dravyaguna|pharmacology|formulation|churna)\b/i],
  ['Telemedicine', /\b(telemedicine|teleconsult|telehealth)\b/i],
  ['Yoga Therapy', /\b(yoga|asana|pranayama)\b/i],
];

export function extractSkillsFromText(text: unknown): string[] {
  const t = String(text ?? '');
  if (!t.trim()) return [];
  const found = new Set<string>();
  for (const [canonical, re] of EXTRACTION_LEXICON) {
    if (re.test(t)) found.add(canonical);
  }
  return Array.from(found);
}
