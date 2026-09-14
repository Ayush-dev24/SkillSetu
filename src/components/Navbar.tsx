import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Leaf, Menu, X, Zap, GraduationCap, Building2, Landmark, LayoutDashboard, Map as MapIcon, LogIn, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../context/AppContext';

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; roles?: Role[] }[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/opportunities', label: 'Opportunities', icon: Zap },
  { to: '/map', label: 'Job Map', icon: MapIcon },
  { to: '/skill-gap', label: 'AI Skill-Gap', icon: GraduationCap, roles: ['student'] },
  { to: '/profile', label: 'My Profile', icon: GraduationCap, roles: ['student'] },
  { to: '/company', label: 'Company Studio', icon: Building2, roles: ['company'] },
  { to: '/college', label: 'College Insights', icon: GraduationCap, roles: ['college'] },
  { to: '/ministry', label: 'Ministry View', icon: Landmark, roles: ['ministry'] },
];

const ROLE_META: Record<Role, { label: string; color: string }> = {
  student: { label: 'Student', color: '#0d7a5f' },
  company: { label: 'Company', color: '#2563eb' },
  college: { label: 'College', color: '#7c3aed' },
  ministry: { label: 'Ministry', color: '#e8930c' },
};

export default function Navbar() {
  const { student, students, overview, setStudentId, studentId } = useApp();
  const { role, isAuthed, profile, signOut, authEmail } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const visibleNav = NAV.filter((n) => !n.roles || (isAuthed && n.roles.includes(role)));

  const doSignOut = async () => {
    await signOut();
    setOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#e5dcc3] bg-[#faf7ef]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#0d7a5f] text-white shadow-md">
            <Leaf size={20} strokeWidth={2.2} />
          </span>
          <span className="leading-tight">
            <span className="font-display block text-[17px] font-bold text-[#07382c]">SkillSetu</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0d7a5f]">Ayush Career Bridge</span>
          </span>
        </NavLink>

        {overview && (
          <NavLink to="/opportunities?type=same-day-task" className="ml-2 hidden items-center gap-1.5 rounded-full bg-[#e8930c] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#d1820a] lg:flex">
            <Zap size={13} strokeWidth={2.6} />
            {overview.instant_count} INSTANT gigs live
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-white" />
          </NavLink>
        )}

        <nav className="ml-auto hidden items-center gap-1 xl:flex">
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-[13px] font-semibold transition ${isActive ? 'bg-[#0d7a5f] text-white' : 'text-[#3c4a44] hover:bg-[#efe7d2]'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 xl:ml-3">
          {isAuthed ? (
            <>
              <span
                className="hidden rounded-full px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-white sm:block"
                style={{ background: ROLE_META[role].color }}
                title={`Signed in as ${ROLE_META[role].label}`}
              >
                {ROLE_META[role].label}
              </span>
              {role === 'student' && students.length > 0 && (
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(Number(e.target.value))}
                  className="hidden rounded-lg border border-[#d8cdae] bg-white px-2 py-1.5 text-xs font-semibold text-[#07382c] outline-none sm:block"
                  title="Demo student profile linked to your login"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name.split(' ')[0]} · {s.readiness_score}</option>
                  ))}
                </select>
              )}
              <NavLink
                to="/profile"
                className="hidden items-center gap-2 rounded-full border border-[#d8cdae] bg-white py-1 pl-1 pr-3 text-left transition hover:border-[#0d7a5f] md:flex"
                title={profile?.email ?? authEmail}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-black text-white" style={{ background: student?.avatar_color ?? ROLE_META[role].color }}>
                  {(profile?.display_name ?? profile?.email ?? 'U').charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[110px] truncate text-xs font-bold text-[#07382c]">
                  {(profile?.display_name ?? profile?.email ?? 'Account').split(' ')[0]}
                </span>
              </NavLink>
              <button
                onClick={doSignOut}
                className="flex items-center gap-1.5 rounded-lg border border-[#d8cdae] bg-white px-2.5 py-1.5 text-xs font-bold text-[#07382c] transition hover:border-[#dc2626] hover:text-[#dc2626]"
                title="Sign out"
              >
                <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <NavLink
              to="/login"
              className="flex items-center gap-1.5 rounded-lg bg-[#07382c] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#095844]"
            >
              <LogIn size={14} /> Sign in
            </NavLink>
          )}
          <button onClick={() => setOpen(!open)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#d8cdae] bg-white text-[#07382c] xl:hidden" aria-label="Menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-[#e5dcc3] bg-[#faf7ef] px-4 py-3 xl:hidden">
          <div className="grid gap-1">
            {visibleNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-[#0d7a5f] text-white' : 'text-[#3c4a44] hover:bg-[#efe7d2]'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
            {!isAuthed && (
              <NavLink
                to="/login"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg bg-[#07382c] px-3 py-2.5 text-sm font-bold text-white"
              >
                <LogIn size={15} /> Sign in / Sign up
              </NavLink>
            )}
            {isAuthed && (
              <button
                onClick={doSignOut}
                className="flex items-center gap-2 rounded-lg border border-[#d8cdae] bg-white px-3 py-2.5 text-left text-sm font-bold text-[#dc2626]"
              >
                <LogOut size={15} /> Sign out ({profile?.email})
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
