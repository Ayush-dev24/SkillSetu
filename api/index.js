import applications from './handlers/applications.js';
import careerAssessments from './handlers/career-assessments.js';
import careerMatchProfile from './handlers/career-match-profile.js';
import careerMatch from './handlers/career-match.js';
import careers from './handlers/careers.js';
import certificates from './handlers/certificates.js';
import companies from './handlers/companies.js';
import courses from './handlers/courses.js';
import dbWake from './handlers/db-wake.js';
import jobsFeed from './handlers/jobs-feed.js';
import mediatorValidate from './handlers/mediator-validate.js';
import mediator from './handlers/mediator.js';
import opportunities from './handlers/opportunities.js';
import placementOverview from './handlers/placement-overview.js';
import placementStudentStatus from './handlers/placement-student-status.js';
import placements from './handlers/placements.js';
import profilePrefs from './handlers/profile-prefs.js';
import profiles from './handlers/profiles.js';
import skillDemand from './handlers/skill-demand.js';
import skillGap from './handlers/skill-gap.js';
import skillsVerify from './handlers/skills-verify.js';
import studentInternshipsActive from './handlers/student-internships-active.js';
import studentPortfolio from './handlers/student-portfolio.js';
import studentSkills from './handlers/student-skills.js';
import students from './handlers/students.js';
import taskWorkspaces from './handlers/task-workspaces.js';

const routes = {
  'applications': applications,
  'career-assessments': careerAssessments,
  'career/assessments': careerAssessments,
  'career-match-profile': careerMatchProfile,
  'career-match': careerMatch,
  'careers': careers,
  'certificates': certificates,
  'companies': companies,
  'courses': courses,
  'db-wake': dbWake,
  'jobs-feed': jobsFeed,
  'mediator-validate': mediatorValidate,
  'mediator': mediator,
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
