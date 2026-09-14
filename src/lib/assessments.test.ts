import { describe, it, expect } from 'vitest';
import {
  ASSESSMENTS,
  getAssessment,
  scoreAssessment,
  getLevelFromScore,
  passedAssessment,
  outcomeForAssessment,
} from './assessments';

describe('assessment catalog', () => {
  it('contains the core expected assessments', () => {
    const ids = ASSESSMENTS.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([
      'python-core',
      'javascript-core',
      'sql-basics',
      'react-basics',
      'data-analysis-basics',
      'ayush-clinical',
    ]));
  });

  it('every assessment has a valid skill, passScore and questions', () => {
    for (const a of ASSESSMENTS) {
      expect(a.skill.length).toBeGreaterThan(0);
      expect(a.passScore).toBeGreaterThan(0);
      expect(a.questions.length).toBeGreaterThan(0);
      expect(a.durationMin).toBeGreaterThan(0);
    }
  });

  it('looks up assessments by id', () => {
    expect(getAssessment('python-core')?.title).toBe('Python Core');
    expect(getAssessment('does-not-exist')).toBeUndefined();
  });
});

describe('scoreAssessment', () => {
  it('scores a perfect run to 100', () => {
    const a = getAssessment('python-core')!;
    const best: Record<string, unknown> = {};
    for (const q of a.questions) {
      if (q.kind === 'range') best[q.id] = 10;
      else best[q.id] = 0; // index of the highest-points option
    }
    const res = scoreAssessment(a, best);
    expect(res.score).toBe(100);
    expect(res.unanswered).toBe(0);
    expect(res.earnedPoints).toBe(res.maxPoints);
  });

  it('scores a blank submission to 0 with all questions unanswered', () => {
    const a = getAssessment('sql-basics')!;
    const res = scoreAssessment(a, {});
    expect(res.score).toBe(0);
    expect(res.unanswered).toBe(a.questions.length);
  });

  it('accepts the AnswerValue[] form', () => {
    const a = getAssessment('sql-basics')!;
    const arr = a.questions.map((q) => ({ q: q.id, value: q.kind === 'range' ? 10 : 0 }));
    const res = scoreAssessment(a, arr);
    expect(res.score).toBe(100);
  });
});

describe('level inference', () => {
  it('maps scores to the 1-5 skill level scale', () => {
    expect(getLevelFromScore(95)).toBe(5);
    expect(getLevelFromScore(75)).toBe(4);
    expect(getLevelFromScore(60)).toBe(3);
    expect(getLevelFromScore(40)).toBe(2);
    expect(getLevelFromScore(10)).toBe(1);
  });

  it('clamps out-of-range scores', () => {
    expect(getLevelFromScore(150)).toBe(5);
    expect(getLevelFromScore(-5)).toBe(1);
  });
});

describe('passedAssessment + outcome', () => {
  it('marks pass/fail against the assessment threshold', () => {
    const a = getAssessment('react-basics')!;
    expect(passedAssessment(a, 90)).toBe(true);
    expect(passedAssessment(a, 30)).toBe(false);
  });

  it('produces a skill-verifying outcome on pass', () => {
    const a = getAssessment('javascript-core')!;
    const answers: Record<string, unknown> = {};
    for (const q of a.questions) answers[q.id] = q.kind === 'range' ? 10 : 0;
    const out = outcomeForAssessment(a, answers);
    expect(out.passed).toBe(true);
    expect(out.skills_verified).toContain('JavaScript');
    expect(out.level).toBe(5);
  });

  it('produces a non-verifying outcome on fail', () => {
    const a = getAssessment('python-core')!;
    const out = outcomeForAssessment(a, {});
    expect(out.passed).toBe(false);
    expect(out.skills_verified).toEqual([]);
  });
});