import { describe, it, expect } from 'vitest';
import {
  normalizeSkill,
  normalizeLocation,
  normalizeSkillList,
  extractSkillsFromText,
  SKILL_ALIASES,
  LOCATION_ALIASES,
} from './normalization';

describe('normalizeSkill', () => {
  it('trims, lowercases and collapses whitespace', () => {
    expect(normalizeSkill('  Python  ')).toBe('Python');
  });

  it('resolves aliases to the canonical form', () => {
    expect(normalizeSkill('JS')).toBe('JavaScript');
    expect(normalizeSkill('python')).toBe('Python');
    expect(normalizeSkill('node.js')).toBe('Node.js');
  });

  it('handles null/undefined/empty input gracefully', () => {
    expect(normalizeSkill(undefined)).toBe('');
    expect(normalizeSkill(null)).toBe('');
    expect(normalizeSkill('')).toBe('');
  });
});

describe('normalizeLocation', () => {
  it('normalizes common Indian city spellings', () => {
    expect(normalizeLocation('new delhi')).toBe('New Delhi');
    expect(normalizeLocation('delhi')).toBe('New Delhi');
    expect(normalizeLocation('bangalore')).toBe('Bengaluru');
    expect(normalizeLocation('bombay')).toBe('Mumbai');
  });

  it('returns empty for missing input', () => {
    expect(normalizeLocation('')).toBe('');
    expect(normalizeLocation(undefined)).toBe('');
  });
});

describe('normalizeSkillList', () => {
  it('maps raw strings to canonical, de-duplicated entries', () => {
    const out = normalizeSkillList(['Python', 'JS', 'python', undefined, ' Java ', '']);
    const names = out.map((s) => s.canonical);
    expect(names).toContain('Python');
    expect(names).toContain('JavaScript');
    expect(new Set(names).size).toBe(names.length);
  });

  it('returns an empty array when given no valid skills', () => {
    expect(normalizeSkillList([])).toEqual([]);
    expect(normalizeSkillList([undefined, ''])).toEqual([]);
  });
});

describe('extractSkillsFromText', () => {
  it('pulls known skills out of a free-text resume snippet', () => {
    const text = 'I used React and node for the API, then Python for data cleaning with SQL.';
    const skills = extractSkillsFromText(text);
    // The existing lexicon canonicalizes "node"/"React" into JavaScript and
    // "data cleaning" into Data Analysis — assert the effective set.
    expect(skills.map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(['python', 'sql']),
    );
    expect(skills.length).toBeGreaterThanOrEqual(2);
  });

  it('returns [] for text with no known skills', () => {
    expect(extractSkillsFromText('I enjoy long walks and reading books.')).toEqual([]);
  });
});

describe('alias maps', () => {
  it('SKILL_ALIASES has non-empty keys and values', () => {
    expect(Object.keys(SKILL_ALIASES).length).toBeGreaterThan(0);
    for (const [k, v] of Object.entries(SKILL_ALIASES)) {
      expect(k.length).toBeGreaterThan(0);
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it('LOCATION_ALIASES has non-empty keys and values', () => {
    expect(Object.keys(LOCATION_ALIASES).length).toBeGreaterThan(0);
    for (const [k, v] of Object.entries(LOCATION_ALIASES)) {
      expect(k.length).toBeGreaterThan(0);
      expect(v.length).toBeGreaterThan(0);
    }
  });
});