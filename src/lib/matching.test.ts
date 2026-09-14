import { describe, it, expect } from 'vitest';
import type { StudentSkill } from './engine';
import {
  inferSkillVerification,
  verifySkills,
  scoreJobAgainstProfile,
  matchJobs,
  categoryOfScore,
  categorizeRecommendations,
  CATEGORY_META,
  computeSkillGaps,
  buildImproveMyMatch,
  summarizeProfile,
} from './matching';

const skill = (name: string, over: Partial<StudentSkill> = {}): StudentSkill => ({
  id: 1,
  student_id: 1,
  skill_name: name,
  category: 'Technical',
  level: 3,
  proficiency_pct: 70,
  verified: false,
  source: 'test',
  ...over,
});

describe('inferSkillVerification', () => {
  it('marks an endorsed high-proficiency skill as VERIFIED', () => {
    const skills = [skill('Python', { verified: true, proficiency_pct: 95 })];
    const v = inferSkillVerification('Python', { skills, verified: true, assessmentScores: { Python: 90 } });
    expect(v.state).toBe('VERIFIED');
    expect(v.confidence).toBeGreaterThan(50);
  });

  it('treats an endorsement as partially verified without a high assessment', () => {
    const skills = [skill('Python', { verified: true })];
    const v = inferSkillVerification('Python', { skills, verified: true });
    expect(v.state).toBe('PARTIALLY_VERIFIED');
  });

  it('marks an unverified low-confidence skill as UNVERIFIED', () => {
    const skills = [skill('Python', { verified: false, proficiency_pct: 15 })];
    const v = inferSkillVerification('Python', { skills });
    expect(v.state).toBe('UNVERIFIED');
  });

  it('treats a high assessment score as verified', () => {
    const skills = [skill('SQL', { proficiency_pct: 60 })];
    const v = inferSkillVerification('SQL', { skills, assessmentScores: { SQL: 92 } });
    expect(v.state).toBe('VERIFIED');
  });
});

describe('verifySkills', () => {
  it('never crashes on empty input', () => {
    expect(verifySkills([])).toEqual([]);
  });

  it('returns one row per skill', () => {
    const rows = verifySkills([skill('React'), skill('Node.js')]);
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.skill)).toEqual(expect.arrayContaining(['React', 'Node.js']));
  });
});

describe('scoreJobAgainstProfile', () => {
  const prof = {
    skills: [
      skill('Python', { proficiency_pct: 85, verified: true }),
      skill('SQL', { proficiency_pct: 60 }),
    ],
    preferredLocations: ['Pune'],
    maxExperienceYears: 0,
    verifiedSkills: new Set(['python']),
  };

  it('scores high when the profile covers the required skills', () => {
    const r = scoreJobAgainstProfile(
      { title: 'Data Intern', company: 'Acme', location: 'Pune', skills: ['Python', 'SQL'], verified: true, experience_min: 0 },
      prof,
    );
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.matched).toContain('Python');
    expect(r.verifiedMatched).toContain('Python');
  });

  it('scores low when the profile is missing most skills', () => {
    const r = scoreJobAgainstProfile(
      { title: 'ML Engineer', location: 'Remote', skills: ['PyTorch', 'Kubernetes', 'Docker'], experience_min: 4 },
      prof,
    );
    expect(r.score).toBeLessThanOrEqual(45);
    expect(r.missing).toContain('pytorch');
    expect(r.missing).toContain('kubernetes');
    expect(r.blockers.some((b) => b.toLowerCase().includes('missing skills'))).toBe(true);
  });

  it('reports location fit', () => {
    const ok = scoreJobAgainstProfile({ title: 'x', location: 'Pune', skills: [] }, prof);
    const bad = scoreJobAgainstProfile({ title: 'x', location: 'Mumbai', skills: [] }, prof);
    expect(ok.locationOk).toBe(true);
    expect(bad.locationOk).toBe(false);
  });
});

describe('matchJobs', () => {
  it('sorts best-first and respects the limit', () => {
    const prof = { skills: [skill('Python', { verified: true, proficiency_pct: 90 })] };
    const jobs = [
      { title: 'A', skills: ['Python'] },
      { title: 'B', skills: ['C#'] },
      { title: 'C', skills: ['Python'] },
      { title: 'D', skills: ['Python'] },
    ];
    const recs = matchJobs(jobs, prof, 3);
    expect(recs.length).toBe(3);
    expect(recs[0].match_score).toBeGreaterThanOrEqual(recs[1].match_score);
  });
});

describe('categories', () => {
  it('sorts scores into strong/good/stretch buckets', () => {
    expect(categoryOfScore(85)).toBe('STRONG');
    expect(categoryOfScore(65)).toBe('GOOD');
    expect(categoryOfScore(40)).toBe('STRETCH');
  });

  it('categorizeRecommendations groups by bucket', () => {
    const recs = [
      { match_score: 90 } as any,
      { match_score: 60 } as any,
      { match_score: 30 } as any,
    ];
    const { strong, good, stretch } = categorizeRecommendations(recs);
    expect(strong.length).toBe(1);
    expect(good.length).toBe(1);
    expect(stretch.length).toBe(1);
  });

  it('CATEGORY_META covers every bucket', () => {
    for (const cat of ['STRONG', 'GOOD', 'STRETCH'] as const) {
      expect(CATEGORY_META[cat].label.length).toBeGreaterThan(0);
    }
  });
});

describe('computeSkillGaps', () => {
  it('flags missing high-demand skills as the highest priority', () => {
    const gaps = computeSkillGaps({
      skills: [skill('Python')],
      jobSkillDemand: { Kubernetes: 12, Python: 20 },
      protectedSkills: new Set(),
    });
    expect(gaps.length).toBeGreaterThan(0);
    const kubernetes = gaps.find((g) => g.skill === 'Kubernetes');
    expect(kubernetes?.priority).toBe(5);
  });

  it('never flags protected (verified) skills as gaps', () => {
    const gaps = computeSkillGaps({
      skills: [skill('Python', { verified: true })],
      jobSkillDemand: { Python: 30 },
      protectedSkills: new Set(['python']),
    });
    expect(gaps.find((g) => g.skill === 'Python')).toBeUndefined();
  });
});

describe('buildImproveMyMatch', () => {
  it('turns gaps into concrete improvement steps', () => {
    const steps = buildImproveMyMatch(
      [{ skill: 'Docker', priority: 5, reason: 'missing', jobs_requiring: [] }],
      [{ skill: 'Python', state: 'NEEDS_EVIDENCE', confidence: 40, explanation: '', evidence_summary: '' }],
    );
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some((s) => s.title.includes('Docker'))).toBe(true);
  });

  it('always includes durable habits when the plan is small', () => {
    const steps = buildImproveMyMatch([], []);
    expect(steps.some((s) => s.id === 'refine-resume')).toBe(true);
  });
});

describe('summarizeProfile', () => {
  it('computes readiness, top skills and verified count', () => {
    const s = summarizeProfile([
      skill('Python', { proficiency_pct: 95, verified: true }),
      skill('SQL', { proficiency_pct: 50 }),
    ]);
    expect(s.top_skills[0].skill).toBe('Python');
    expect(s.verified_count).toBe(1);
    expect(s.readiness).toBeGreaterThanOrEqual(20);
    expect(s.readiness).toBeLessThanOrEqual(98);
    expect(s.target_role.length).toBeGreaterThan(0);
  });
});