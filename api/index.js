import applications from './_handlers/applications.js';
import careerAssessments from './_handlers/career-assessments.js';
import careerMatch from './_handlers/career-match.js';
import careers from './_handlers/careers.js';
import certificates from './_handlers/certificates.js';
import companies from './_handlers/companies.js';
import courses from './_handlers/courses.js';
import jobsFeed from './_handlers/jobs-feed.js';
import opportunities from './_handlers/opportunities.js';
import placementOverview from './_handlers/placement-overview.js';
import placementStudentStatus from './_handlers/placement-student-status.js';
import placements from './_handlers/placements.js';
import profilePrefs from './_handlers/profile-prefs.js';
import profiles from './_handlers/profiles.js';
import skillDemand from './_handlers/skill-demand.js';
import skillGap from './_handlers/skill-gap.js';
import skillsVerify from './_handlers/skills-verify.js';
import studentInternshipsActive from './_handlers/student-internships-active.js';
import studentPortfolio from './_handlers/student-portfolio.js';
import studentSkills from './_handlers/student-skills.js';
import students from './_handlers/students.js';
import taskWorkspaces from './_handlers/task-workspaces.js';

const routes = {
  'applications': applications,
  'career-assessments': careerAssessments,
  'career/assessments': careerAssessments,
  'career-match': careerMatch,
  'careers': careers,
  'certificates': certificates,
  'companies': companies,
  'courses': courses,
  'jobs-feed': jobsFeed,
  'opportunities': opportunities,
  'placement-overview': placementOverview,
  'v1/placement/overview': placementOverview,
  'placement-student-status': placementStudentStatus,
  'v1/placement/student-status': placementStudentStatus,
  'placements': placements,
  'profile-prefs': profilePrefs,
  'profiles': profiles,
  'skill-demand': skillDemand,
  'skill-gap': skillGap,
  'skills/verify': skillsVerify,
  'student-internships-active': studentInternshipsActive,
  'v1/student/internships/active': studentInternshipsActive,
  'student-portfolio': studentPortfolio,
  'v1/student/portfolio': studentPortfolio,
  'student-skills': studentSkills,
  'students': students,
  'task-workspaces': taskWorkspaces,
};

export default async function handler(req, res) {
  let routePath = '';

  if (req.query && req.query.path) {
    routePath = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path);
  } else if (req.url) {
    const rawPath = req.url.split('?')[0];
    routePath = rawPath.replace(/^\/api\//, '').replace(/\/$/, '');
  }

  const routeHandler = routes[routePath];

  if (routeHandler) {
    return routeHandler(req, res);
  }

  return res.status(404).json({ error: `API route not found: /api/${routePath}` });
}
