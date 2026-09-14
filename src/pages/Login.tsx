import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Mail, Lock, User as UserIcon, GraduationCap, Building2, Landmark, Briefcase, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../context/AppContext';

const ROLE_OPTIONS: { value: Role; label: string; desc: string; icon: typeof GraduationCap }[] = [
  { value: 'student', label: 'Student', desc: 'Skills, gigs & placements', icon: GraduationCap },
  { value: 'company', label: 'Company', desc: 'Post tasks & hire', icon: Building2 },
  { value: 'college', label: 'College', desc: 'Demand & outcomes', icon: Briefcase },
  { value: 'ministry', label: 'Ministry', desc: 'National overview', icon: Landmark },
];

const ROLE_HOME: Record<Role, string> = {
  student: '/profile',
  company: '/company',
  college: '/college',
  ministry: '/ministry',
};

export default function Login() {
  const { signIn, signUp, role: currentRole } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) { setErr(error); return; }
        navigate(ROLE_HOME[currentRole] ?? '/profile');
      } else {
        const { error, needsConfirm } = await signUp(email, password, role, name);
        if (error) { setErr(error); return; }
        if (needsConfirm) {
          setInfo('Account created! Check your email to confirm, then sign in.');
          setMode('signin');
        } else {
          navigate(ROLE_HOME[role]);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:px-6">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[#0d7a5f] text-white shadow-md">
          <Leaf size={26} />
        </span>
        <h1 className="font-display text-3xl font-bold text-[#07382c]">
          {mode === 'signin' ? 'Welcome back' : 'Join SkillSetu'}
        </h1>
        <p className="mt-1 text-sm text-[#5a6a62]">
          {mode === 'signin'
            ? 'Sign in with your email & password. Your role decides what you can see and do.'
            : 'One account, one role — students, companies, colleges and ministry stay separate.'}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-[#e5dcc3] bg-white p-1.5 card-shadow">
        {(['signin', 'signup'] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setErr(''); setInfo(''); }}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition ${mode === m ? 'bg-[#07382c] text-white' : 'text-[#5a6a62] hover:bg-[#faf7ef]'}`}
          >
            {m === 'signin' ? <LogIn size={15} /> : <UserPlus size={15} />}
            {m === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-[#e5dcc3] bg-white p-5 card-shadow">
        {mode === 'signup' && (
          <>
            <label className="mb-3 block">
              <span className="mb-1 flex items-center gap-1 text-xs font-bold text-[#07382c]"><UserIcon size={13} /> Full name</span>
              <input
                value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
                placeholder="e.g. Aarav Sharma" autoComplete="name"
                className="w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2.5 text-sm outline-none focus:border-[#0d7a5f]"
              />
            </label>
            <span className="mb-1 block text-xs font-bold text-[#07382c]">I am joining as</span>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((r) => (
                <button
                  type="button" key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`rounded-xl border-2 p-2.5 text-left transition ${role === r.value ? 'border-[#0d7a5f] bg-[#effaf4]' : 'border-[#e5dcc3] bg-white hover:border-[#0d7a5f]'}`}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#07382c]"><r.icon size={14} /> {r.label}</span>
                  <span className="block text-[11px] text-[#5a6a62]">{r.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <label className="mb-3 block">
          <span className="mb-1 flex items-center gap-1 text-xs font-bold text-[#07382c]"><Mail size={13} /> Email</span>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160}
            placeholder="you@example.com" autoComplete="email"
            className="w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2.5 text-sm outline-none focus:border-[#0d7a5f]"
          />
        </label>
        <label className="mb-1 block">
          <span className="mb-1 flex items-center gap-1 text-xs font-bold text-[#07382c]"><Lock size={13} /> Password</span>
          <span className="relative block">
            <input
              type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2.5 pr-10 text-sm outline-none focus:border-[#0d7a5f]"
            />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#8a978f] hover:text-[#07382c]" aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
        {err && <p className="mt-2 rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] font-bold text-[#dc2626]">{err}</p>}
        {info && <p className="mt-2 rounded-lg bg-[#effaf4] px-3 py-2 text-[13px] font-bold text-[#0d7a5f]">{info}</p>}
        <button
          type="submit" disabled={busy}
          className="mt-4 w-full rounded-xl bg-[#0d7a5f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0b6a52] disabled:opacity-50"
        >
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : `Create ${ROLE_OPTIONS.find((r) => r.value === role)?.label} account`}
        </button>
        <p className="mt-3 text-center text-xs text-[#8a978f]">
          {mode === 'signin' ? (
            <>New here? <button type="button" onClick={() => setMode('signup')} className="font-bold text-[#0d7a5f] hover:underline">Create an account</button></>
          ) : (
            <>Already registered? <button type="button" onClick={() => setMode('signin')} className="font-bold text-[#0d7a5f] hover:underline">Sign in</button></>
          )}
        </p>
      </form>

      <div className="mt-4 rounded-2xl bg-[#07382c] p-4 text-[13px] leading-relaxed text-[#cfe6da]">
        <b className="text-white">Why roles matter:</b> students apply & build verified profiles, companies post & evaluate,
        colleges track outcomes, ministry sees the national picture. Signing up locks your role so data stays separated.
      </div>
      <p className="mt-3 text-center text-xs text-[#8a978f]">
        <Link to="/" className="font-bold text-[#0d7a5f] hover:underline">← Back to home</Link>
      </p>
    </div>
  );
}
