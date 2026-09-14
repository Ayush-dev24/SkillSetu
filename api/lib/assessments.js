// Server-side mirror of src/lib/assessments.ts (ESM, dependency-free).
// Keep in sync with the frontend copy. This is the AUTHORITATIVE scoring
// source — /api/career-assessments scores submissions with this module, so
// clients can never tamper with results.

export const ASSESSMENTS = [
  {
    id: 'python-core',
    title: 'Python Core',
    description: 'Syntax, data structures, functions and error handling.',
    skill: 'Python',
    durationMin: 8,
    passScore: 60,
    questions: [
      { id: 'py-1', text: 'How confident are you writing Python functions with default arguments?', kind: 'range', hint: '1 = I have not tried; 10 = I write them daily without looking anything up.' },
      { id: 'py-2', text: 'Which of these is a valid way to iterate over both index and value in Python?', kind: 'mcq', options: [
        { label: 'for i, v in enumerate(items)', points: 3 },
        { label: 'for v in items', points: 1 },
        { label: 'while i < len(items)', points: 1 },
        { label: 'for i in items', points: 1 },
      ] },
      { id: 'py-3', text: 'When should you prefer a tuple over a list?', kind: 'mcq', options: [
        { label: 'When the data should not change (immutable sequence)', points: 3 },
        { label: 'When you need to append frequently', points: 1 },
        { label: 'When you need random access with index', points: 1 },
        { label: 'Never — lists are always better', points: 0 },
      ] },
      { id: 'py-4', text: 'How do you handle exceptions cleanly in Python?', kind: 'mcq', options: [
        { label: 'try / except with specific exception types', points: 3 },
        { label: 'Bare except: that catches everything', points: 1 },
        { label: 'Let the program crash — the user will see the error', points: 0 },
        { label: 'Wrap the whole file in one try block', points: 1 },
      ] },
      { id: 'py-5', text: 'What does a list comprehension `[x*2 for x in range(3)]` produce?', kind: 'mcq', options: [
        { label: '[0, 2, 4]', points: 3 },
        { label: '[2, 4, 6]', points: 1 },
        { label: '[0, 1, 2]', points: 1 },
        { label: 'Syntax error', points: 0 },
      ] },
      { id: 'py-6', text: 'You need to load a CSV with 50,000 rows. Which tool do you reach for?', kind: 'mcq', options: [
        { label: 'pandas (read_csv)', points: 3 },
        { label: 'A text editor, manually', points: 0 },
        { label: 'json.load, even though it is JSON', points: 0 },
        { label: 'print every line in a for loop', points: 1 },
      ] },
    ],
  },
  {
    id: 'javascript-core',
    title: 'JavaScript Core',
    description: 'Variables, functions, arrays/objects and async basics.',
    skill: 'JavaScript',
    durationMin: 8,
    passScore: 60,
    questions: [
      { id: 'js-1', text: 'How comfortable are you with arrow functions?', kind: 'range', hint: '1 = never used; 10 = I use them in every file.' },
      { id: 'js-2', text: 'What does `const` mean in modern JavaScript?', kind: 'mcq', options: [
        { label: 'The binding cannot be reassigned', points: 3 },
        { label: 'The value is frozen and cannot change', points: 1 },
        { label: 'The variable is hidden from other files', points: 0 },
        { label: 'Older syntax for functions', points: 0 },
      ] },
      { id: 'js-3', text: 'How do you fetch data from an API in the browser?', kind: 'mcq', options: [
        { label: 'await fetch(url) and parse the response', points: 3 },
        { label: 'document.write(url)', points: 0 },
        { label: 'Open a new tab', points: 0 },
        { label: 'alert(url)', points: 0 },
      ] },
      { id: 'js-4', text: 'Which of these is a valid array method to transform every element?', kind: 'mcq', options: [
        { label: 'arr.map(fn)', points: 3 },
        { label: 'arr.toUpperCase()', points: 0 },
        { label: 'arr == fn', points: 0 },
        { label: 'arr.loop(fn)', points: 0 },
      ] },
      { id: 'js-5', text: 'How do you safely check an object "own" property in modern JS?', kind: 'mcq', options: [
        { label: 'Object.hasOwn(obj, key)', points: 3 },
        { label: 'obj.exists(key)', points: 0 },
        { label: 'obj[key] != null', points: 1 },
        { label: 'key in Object.keys(obj)', points: 1 },
      ] },
      { id: 'js-6', text: 'What is a Promise?', kind: 'mcq', options: [
        { label: 'An object representing a future value', points: 3 },
        { label: 'A function that never runs', points: 0 },
        { label: 'A CSS class', points: 0 },
        { label: 'A debugging tool', points: 0 },
      ] },
    ],
  },
  {
    id: 'sql-basics',
    title: 'SQL Basics',
    description: 'Queries, joins, filtering and aggregations.',
    skill: 'SQL',
    durationMin: 6,
    passScore: 55,
    questions: [
      { id: 'sql-1', text: 'Which clause filters rows before grouping?', kind: 'mcq', options: [
        { label: 'WHERE', points: 3 },
        { label: 'HAVING', points: 1 },
        { label: 'ORDER BY', points: 0 },
        { label: 'SELECT', points: 0 },
      ] },
      { id: 'sql-2', text: 'How do you combine two tables on a shared key?', kind: 'mcq', options: [
        { label: 'JOIN … ON a.id = b.id', points: 3 },
        { label: 'MERGE a WITH b', points: 0 },
        { label: 'APPEND a, b', points: 0 },
        { label: 'LINK a TO b', points: 0 },
      ] },
      { id: 'sql-3', text: 'What does `GROUP BY department` do?', kind: 'mcq', options: [
        { label: 'Groups rows so aggregates are computed per department', points: 3 },
        { label: 'Sorts rows by department', points: 1 },
        { label: 'Deletes duplicate departments', points: 0 },
        { label: 'Renames the department column', points: 0 },
      ] },
      { id: 'sql-4', text: 'Which is the fastest way to look up one row by primary key?', kind: 'mcq', options: [
        { label: 'SELECT ... WHERE id = ?', points: 3 },
        { label: 'SELECT ... WHERE name LIKE "%a%"', points: 1 },
        { label: 'Fetch the whole table', points: 0 },
        { label: 'COUNT(*) then iterate', points: 0 },
      ] },
      { id: 'sql-5', text: 'How confident are you writing aggregate queries with COUNT/SUM/AVG?', kind: 'range', hint: '1 = never; 10 = I use them for daily reports.' },
    ],
  },
  {
    id: 'react-basics',
    title: 'React Basics',
    description: 'Components, props, state and hooks.',
    skill: 'React',
    durationMin: 6,
    passScore: 55,
    questions: [
      { id: 'rx-1', text: 'What is a React component?', kind: 'mcq', options: [
        { label: 'A function returning UI (JSX)', points: 3 },
        { label: 'A CSS stylesheet', points: 0 },
        { label: 'A browser tab', points: 0 },
        { label: 'An HTML file', points: 0 },
      ] },
      { id: 'rx-2', text: 'How do you pass data from a parent to a child component?', kind: 'mcq', options: [
        { label: 'props', points: 3 },
        { label: 'global variables', points: 0 },
        { label: 'document.title', points: 0 },
        { label: 'CSS variables', points: 0 },
      ] },
      { id: 'rx-3', text: 'Which hook holds per-component state?', kind: 'mcq', options: [
        { label: 'useState', points: 3 },
        { label: 'useFetch', points: 0 },
        { label: 'useDOM', points: 0 },
        { label: 'useWindow', points: 0 },
      ] },
      { id: 'rx-4', text: 'When does `useEffect(fn, [dep])` re-run?', kind: 'mcq', options: [
        { label: 'When `dep` changes after the first render', points: 3 },
        { label: 'Every millisecond', points: 0 },
        { label: 'Only on page refresh', points: 1 },
        { label: 'When the component unmounts', points: 1 },
      ] },
      { id: 'rx-5', text: 'What is the key prop used for?', kind: 'mcq', options: [
        { label: 'Stable identity for list items', points: 3 },
        { label: 'CSS class name', points: 0 },
        { label: 'Security token', points: 0 },
        { label: 'Database primary key', points: 0 },
      ] },
    ],
  },
  {
    id: 'data-analysis-basics',
    title: 'Data Analysis Basics',
    description: 'Cleaning, grouping and visualizing data.',
    skill: 'Data Analysis',
    durationMin: 6,
    passScore: 55,
    questions: [
      { id: 'da-1', text: 'Which step comes first in most analyses?', kind: 'mcq', options: [
        { label: 'Clean and validate the data', points: 3 },
        { label: 'Publish a chart', points: 0 },
        { label: 'Delete the raw file', points: 0 },
        { label: 'Copy values into slides', points: 1 },
      ] },
      { id: 'da-2', text: 'A column has blank cells. What is the safest move?', kind: 'mcq', options: [
        { label: 'Inspect the blanks before deciding how to handle them', points: 3 },
        { label: 'Delete every row with a blank', points: 1 },
        { label: 'Type 0 in all of them', points: 0 },
        { label: 'Ignore it — charts handle blanks', points: 0 },
      ] },
      { id: 'da-3', text: 'Which chart best shows a trend over time?', kind: 'mcq', options: [
        { label: 'Line chart', points: 3 },
        { label: 'Pie chart', points: 1 },
        { label: 'Scatter without time axis', points: 1 },
        { label: 'Table only', points: 0 },
      ] },
      { id: 'da-4', text: 'How do you summarize a group in a spreadsheet or tool?', kind: 'mcq', options: [
        { label: 'Pivot table / GROUP BY aggregate', points: 3 },
        { label: 'Search each cell manually', points: 0 },
        { label: 'Print the sheet', points: 0 },
        { label: 'Add a comment', points: 0 },
      ] },
      { id: 'da-5', text: 'How comfortable are you with pivot tables?', kind: 'range', hint: '1 = never tried; 10 = I build them without thinking.' },
    ],
  },
  {
    id: 'ayush-clinical',
    title: 'Ayush Clinical Basics',
    description: 'Panchakarma, diagnosis and patient documentation.',
    skill: 'Ayurvedic Diagnosis',
    skill2: 'Clinical Documentation',
    durationMin: 6,
    passScore: 55,
    questions: [
      { id: 'ay-1', text: 'Which is a core aim of Nadi Pariksha?', kind: 'mcq', options: [
        { label: 'Assessing dosha balance through pulse examination', points: 3 },
        { label: 'Measuring blood pressure', points: 1 },
        { label: 'Counting heartbeats per minute only', points: 1 },
        { label: 'Checking skin temperature', points: 0 },
      ] },
      { id: 'ay-2', text: 'What is Panchakarma primarily?', kind: 'mcq', options: [
        { label: 'A five-fold detoxification and purification therapy', points: 3 },
        { label: 'Five herbal teas', points: 0 },
        { label: 'A surgical kit', points: 0 },
        { label: 'A diet plan without procedures', points: 1 },
      ] },
      { id: 'ay-3', text: 'Why is a case sheet important in clinical practice?', kind: 'mcq', options: [
        { label: 'It documents history, findings and follow-up for continuity of care', points: 3 },
        { label: 'It is only a billing requirement', points: 1 },
        { label: 'It replaces the prescription entirely', points: 0 },
        { label: 'It is optional in most clinics', points: 0 },
      ] },
      { id: 'ay-4', text: 'A patient asks about diet changes alongside therapy. What is the right approach?', kind: 'mcq', options: [
        { label: 'Give tailored ahara (diet) guidance linked to their condition', points: 3 },
        { label: 'Tell them any diet works', points: 0 },
        { label: 'Refuse to discuss diet', points: 0 },
        { label: 'Only mention generic fitness tips', points: 1 },
      ] },
      { id: 'ay-5', text: 'How confident are you documenting a patient consultation?', kind: 'range', hint: '1 = never done it; 10 = I document every visit fully.' },
    ],
  },
];

export function getAssessment(id) {
  return ASSESSMENTS.find((a) => a.id === id);
}

export function scoreAnswer(question, raw) {
  if (question.kind === 'range') {
    const n = Number(raw);
    const clamped = Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : 1;
    if (clamped <= 2) return 0;
    if (clamped <= 4) return 1;
    if (clamped <= 7) return 2;
    return 3;
  }
  const idx = Number(raw);
  const opt = question.options?.[idx];
  return opt ? opt.points : 0;
}

export function scoreAssessment(assessment, answers) {
  const map = Array.isArray(answers)
    ? Object.fromEntries(answers.map((a) => [a.q, a.value]))
    : answers || {};
  let maxPoints = 0;
  let earnedPoints = 0;
  let unanswered = 0;
  const perQuestion = assessment.questions.map((q) => {
    const max = q.kind === 'range' ? 3 : (q.options || []).reduce((s, o) => Math.max(s, o.points), 0);
    maxPoints += max;
    const has = map[q.id] !== undefined && map[q.id] !== null && map[q.id] !== '';
    const earned = has ? scoreAnswer(q, map[q.id]) : 0;
    if (!has) unanswered += 1;
    earnedPoints += earned;
    return { id: q.id, earned, max };
  });
  const score = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;
  return { score, maxPoints, earnedPoints, perQuestion, unanswered };
}

export function getLevelFromScore(score) {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 85) return 5;
  if (s >= 70) return 4;
  if (s >= 55) return 3;
  if (s >= 35) return 2;
  return 1;
}

export function passedAssessment(assessment, score) {
  return score >= assessment.passScore;
}

export function outcomeForAssessment(assessment, answers) {
  const { score } = scoreAssessment(assessment, answers);
  const level = getLevelFromScore(score);
  const passed = passedAssessment(assessment, score);
  const skills = [assessment.skill];
  if (assessment.skill2) skills.push(assessment.skill2);
  const summary = passed
    ? `Passed with ${score}% — ${assessment.skill} assessed at level ${level}.`
    : `Scored ${score}% — below the ${assessment.passScore}% pass mark. Retake after practice to verify ${assessment.skill}.`;
  return {
    assessment_id: assessment.id,
    assessment_title: assessment.title,
    score,
    level,
    passed,
    skills_verified: passed ? skills : [],
    summary,
  };
}