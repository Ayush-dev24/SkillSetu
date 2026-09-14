// Map the real Skill Setu profile onto the mediator request schema.
// ---------------------------------------------------------------------------
// Skill Setu remains the source of truth for the user account and profile.
// This module only TRANSLATES existing data into the mediator's expected
// layout ({ user_id, name, education, skills, experience, projects,
// certifications, preferred_roles, preferred_locations, experience_level,
// cgpa, ... }). No new profile fields are created here and nothing private
// or unrelated is forwarded.

// Map the real Skill Setu profile onto the mediator request schema.
// --------------------------------------------------------------------------
// Skill Setu remains the source of truth for the user account and profile.
// This module only TRANSLATES existing data into the mediator's expected
// layout ({ user_id, name, education, skills, experience, projects,
// certifications, preferred_roles, preferred_locations, experience_level,
// cgpa, ... }). No new profile fields are created here and nothing private
// or unrelated is forwarded.

function normalizeSkillsForSearch(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return null;
  // Split multi-word skills into comma tokens for reliable upstream matching
  const tokens = skills.flatMap(s => String(s).trim().toLowerCase().split(/\s+/).filter(Boolean));
  return tokens.length ? tokens.join(',') : null;
}

export function mapProfileToMediatorSchema({ user, profile, student, skills: studentSkills, certificates, opportunities }) {
  // ...existing code...
  const preferredRoles = [];
  const headline = (student?.headline || '').trim();
  if (headline && headline.length <= 80) preferredRoles.push(headline);

  const education = {
    degree: (student?.degree || '').trim() || undefined,
    branch: (student?.college || '').trim() || undefined,
    // Existing dataset stores year as free text ("3rd Year"). Try to derive
    // a graduation year only when it is an unambiguous 4-digit value.
    graduation_year: (() => {
      const y = Number(String(student?.year || '').match(/\b(20\d{2})\b/)?.[1] ?? 0);
      return y >= 2000 && y <= 2100 ? y : undefined;
    })(),
  };

  const skillNames = Array.isArray(studentSkills)
    ? studentSkills.map((s) => String(s.skill_name || s).trim()).filter(Boolean).slice(0, 60)
    : [];

  return {
    user_id: user?.id ? String(user.id) : profile?.user_id ? String(profile.user_id) : '',
    name: (student?.name || profile?.display_name || '').trim() || undefined,
    education,
    skills: skillNames,
    // No experience/projects tables exist in Skill Setu today: send [] so the
    // mediator sees the honest state instead of fabricated entries.
    experience: [],
    projects: [],
    certifications: Array.isArray(certificates)
      ? certificates.slice(0, 20).map((c) => String(c.opportunity_title || c.cert_code || '').trim()).filter(Boolean)
      : [],
    preferred_roles: preferredRoles,
    preferred_locations: [],
    experience_level: 'entry',
    cgpa: (() => {
      // Skill Setu has no CGPA column; when a student row carries one in the
      // future it flows through automatically. Today we send nothing.
      const cg = Number(student?.cgpa);
      return Number.isFinite(cg) ? cg : undefined;
    })(),
  };
}

// Map the real Skill Setu profile onto the external Verified Jobs Service
// query filters (Zero-PII mandate).
// ---------------------------------------------------------------------------
// Student profile data (names, emails, IDs, GPAs, transcripts, raw resumes)
// NEVER leaves this server. Only anonymous filter parameters (q, city, skills,
// work_mode, sort, limit, page, country_code) are sent.

export function mapProfileToJobFilters({ student, skills: studentSkills }) {
  const query = (student?.headline || '').trim();
  const city = (student?.location || '').trim();
  const studentDesiredSkills = Array.isArray(studentSkills)
    ? studentSkills.map(s => s.skill_name)
    : [];

  return {
    q: query || null,
    city: city || null,
    skills: normalizeSkillsForSearch(studentDesiredSkills),
    work_mode: null, // Student profile does not specify work_mode preference
    country_code: 'IN', // Enforced as 'IN' (India)
    sort: 'recent', // Default sorting for now
    limit: 20, // Default limit per external API spec
    page: 1, // Default page per external API spec
  };
}
