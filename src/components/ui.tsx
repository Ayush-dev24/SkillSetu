import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Leaf, ShieldCheck, Zap, GraduationCap } from 'lucide-react';

export function SectionTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#0d7a5f]">{kicker}</p>
      <h2 className="font-display text-2xl font-bold text-[#07382c] sm:text-3xl">{title}</h2>
      {sub && <p className="mt-1.5 max-w-2xl text-sm text-[#5a6a62]">{sub}</p>}
    </div>
  );
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[#e5dcc3] bg-white p-4 card-shadow">
      <p className="font-display text-2xl font-black" style={{ color: accent ?? '#07382c' }}>{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-[#5a6a62]">{label}</p>
    </div>
  );
}

export function Chip({ children, color = '#0d7a5f', bg }: { children: ReactNode; color?: string; bg?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color, background: bg ?? `${color}14`, border: `1px solid ${color}33` }}>
      {children}
    </span>
  );
}

export function MatchRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const col = score >= 80 ? '#0d7a5f' : score >= 60 ? '#2563eb' : score >= 40 ? '#e8930c' : '#dc2626';
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eee5cf" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, score)) / 100} className="ring-anim" />
      </svg>
      <div className="absolute text-center">
        <p className="text-[15px] font-black leading-none" style={{ color: col }}>{score}</p>
        <p className="text-[8px] font-bold uppercase tracking-wide text-[#8a978f]">match</p>
      </div>
    </div>
  );
}

export function ReadinessRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff2e" strokeWidth={10} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f5a623" strokeWidth={10} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, score)) / 100} className="ring-anim" />
      </svg>
      <div className="absolute text-center text-white">
        <p className="font-display text-3xl font-black leading-none">{score}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">ready</p>
      </div>
    </div>
  );
}

export function SkillBar({ name, pct, verified, small }: { name: string; pct: number; verified?: boolean; small?: boolean }) {
  const col = pct >= 75 ? '#0d7a5f' : pct >= 55 ? '#2563eb' : pct >= 35 ? '#e8930c' : '#dc2626';
  return (
    <div className={small ? '' : 'rounded-xl border border-[#ece2c8] bg-[#fffdf6] p-3'}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`font-bold text-[#07382c] ${small ? 'text-xs' : 'text-[13px]'}`}>
          {name} {verified && <ShieldCheck size={13} className="ml-1 inline text-[#0d7a5f]" />}
        </span>
        <span className="text-xs font-black" style={{ color: col }}>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#eee5cf]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%`, background: col }} />
      </div>
    </div>
  );
}

export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#c9bd9c] bg-[#fffdf6] p-8 text-center">
      <GraduationCap className="mx-auto mb-2 text-[#b3a87f]" size={28} />
      <p className="font-bold text-[#07382c]">{title}</p>
      {sub && <p className="mt-1 text-sm text-[#5a6a62]">{sub}</p>}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[#0b6a52] bg-[#07382c] text-[#cfe6da]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f5a623] text-[#07382c]"><Leaf size={18} /></span>
            <span className="font-display text-lg font-bold text-white">SkillSetu</span>
          </div>
          <p className="text-[13px] leading-relaxed">AI-powered Academia–Industry Career Bridge for the Ministry of Ayush · All India Institute of Ayurveda. Converting academic skills into verified real-world experience.</p>
        </div>
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#f5a623]">Platform</p>
          <div className="grid gap-1.5 text-[13px]">
            <NavLink to="/opportunities" className="hover:text-white">Find opportunities</NavLink>
            <NavLink to="/map" className="hover:text-white">Live job map</NavLink>
            <NavLink to="/login" className="hover:text-white">Sign in / Sign up</NavLink>
            <NavLink to="/profile" className="hover:text-white">Skill profile (students)</NavLink>
            <NavLink to="/company" className="hover:text-white">For companies</NavLink>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#f5a623]">Institutions</p>
          <div className="grid gap-1.5 text-[13px]">
            <NavLink to="/college" className="hover:text-white">College dashboard</NavLink>
            <NavLink to="/ministry" className="hover:text-white">Ministry overview</NavLink>
            <span className="flex items-center gap-1"><ShieldCheck size={13} /> Verified skill credentials</span>
            <span className="flex items-center gap-1"><Zap size={13} /> Instant opportunity rails</span>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#f5a623]">Trust & Safety</p>
          <p className="text-[13px] leading-relaxed">Role-based access · validated inputs · moderated postings · secure uploads. Demo build for hackathon evaluation — all data is illustrative.</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-[#9fc3b2]">SkillSetu · Ministry of Ayush · AIIA New Delhi · 2026</div>
    </footer>
  );
}
