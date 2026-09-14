import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import supabase from '../lib/supabase';
import type { Role } from './AppContext';
import { smartFetch } from '../lib/engine';

interface Profile {
  id: string;
  email: string;
  role: Role;
  student_id: number | null;
  display_name: string;
}

const VALID_ROLES: Role[] = ['student', 'company', 'college', 'ministry'];

function createDemoUser(email: string, role: Role, displayName: string): User {
  return {
    id: 'demo-user',
    email,
    user_metadata: { role, display_name: displayName },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as unknown as User;
}

function roleFromMeta(user: User | null): Role {
  const r = (user?.user_metadata as Record<string, unknown> | undefined)?.role;
  return VALID_ROLES.includes(r as Role) ? (r as Role) : 'student';
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  role: Role;
  authEmail: string;
  setAuthEmail: (e: string) => void;
  signUp: (email: string, password: string, role: Role, displayName: string) => Promise<{ error: string | null; needsConfirm?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  authToken: () => Promise<string | null>;
  isAuthed: boolean;
}

const AuthCtx = createContext<AuthState | null>(null);

async function fetchProfile(userId: string, email: string, fallbackRole: Role): Promise<Profile> {
  try {
    const res = await smartFetch(`/api/profiles?user_id=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const p = rows[0];
        return {
          id: userId,
          email: p.email ?? email,
          role: VALID_ROLES.includes(p.role) ? p.role : fallbackRole,
          student_id: p.student_id ?? null,
          display_name: p.display_name ?? email.split('@')[0],
        };
      }
    }
  } catch {
    // fall through to metadata-based profile
  }
  return { id: userId, email, role: fallbackRole, student_id: null, display_name: email.split('@')[0] };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authEmail, setAuthEmail] = useState('');

  const enableDemoAuth = !supabase;

  useEffect(() => {
    if (enableDemoAuth) {
      const demoUser = createDemoUser('demo@student.skillsetu.in', 'student', 'Demo Student');
      setSession(null);
      setUser(demoUser);
      setProfile({
        id: demoUser.id,
        email: demoUser.email ?? 'demo@student.skillsetu.in',
        role: 'student',
        student_id: 1,
        display_name: 'Demo Student',
      });
      setLoading(false);
      return;
    }

    const client = supabase;
    if (!client) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const { data } = await client.auth.getSession();
        if (!alive) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          const role = roleFromMeta(data.session.user);
          setProfile(await fetchProfile(data.session.user.id, data.session.user.email ?? '', role));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    const { data: { subscription } } = client.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        const role = roleFromMeta(sess.user);
        setProfile(await fetchProfile(sess.user.id, sess.user.email ?? '', role));
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  const signUp: AuthState['signUp'] = async (email, password, role, displayName) => {
    if (enableDemoAuth) {
      const cleanEmail = email.trim().toLowerCase();
      const nextName = displayName.trim() || 'Demo Student';
      const nextRole: Role = VALID_ROLES.includes(role) ? role : 'student';
      setUser(createDemoUser(cleanEmail || 'demo@student.skillsetu.in', nextRole, nextName));
      setProfile({ id: 'demo-user', email: cleanEmail || 'demo@student.skillsetu.in', role: nextRole, student_id: 1, display_name: nextName });
      return { error: null, needsConfirm: false };
    }

    const client = supabase;
    if (!client) return { error: 'Authentication is not configured in this environment.' };

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return { error: 'Enter a valid email address.' };
    if (password.length < 6) return { error: 'Password must be at least 6 characters.' };
    if (!displayName.trim()) return { error: 'Please enter your name.' };
    const { data, error } = await client.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { role, display_name: displayName.trim() } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      try {
        await smartFetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: data.user.id,
            email: cleanEmail,
            role,
            display_name: displayName.trim(),
          }),
        });
      } catch {
        // profile creation is retried lazily on next login
      }
      setProfile({ id: data.user.id, email: cleanEmail, role, student_id: null, display_name: displayName.trim() });
    }
    return { error: null, needsConfirm: !data.session };
  };

  const signIn: AuthState['signIn'] = async (email, password) => {
    if (enableDemoAuth) {
      const cleanEmail = email.trim().toLowerCase() || 'demo@student.skillsetu.in';
      setUser(createDemoUser(cleanEmail, 'student', 'Demo Student'));
      setProfile({ id: 'demo-user', email: cleanEmail, role: 'student', student_id: 1, display_name: 'Demo Student' });
      return { error: null };
    }

    const client = supabase;
    if (!client) return { error: 'Authentication is not configured in this environment.' };

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return { error: 'Enter your email and password.' };
    const { error } = await client.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) {
      if (/confirm/i.test(error.message)) return { error: 'Please confirm your email first (check your inbox), then sign in.' };
      return { error: 'Invalid email or password.' };
    }
    return { error: null };
  };

  const signOut = async () => {
    if (enableDemoAuth) {
      setUser(null);
      setSession(null);
      setProfile(null);
      return;
    }

    const client = supabase;
    if (!client) {
      setUser(null);
      setSession(null);
      setProfile(null);
      return;
    }

    await client.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const authToken = async () => {
    const client = supabase;
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  };

  return (
    <AuthCtx.Provider value={{
      user, session, loading, profile,
      role: profile?.role ?? roleFromMeta(user),
      authEmail, setAuthEmail,
      signUp, signIn, signOut, authToken,
      isAuthed: !!user || enableDemoAuth,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
