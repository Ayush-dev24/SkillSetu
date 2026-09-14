import supabase from './_db-client.js';

// Roles shared by the whole platform. Keep in sync with the frontend
// ROLE_META + the auth user_metadata.role written at sign-up.
const VALID_ROLES = new Set(['student', 'company', 'college', 'ministry']);

export { VALID_ROLES };

export async function requireUser(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Sign in required.' });
    return null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return null;
  }
  return data.user;
}

export async function getProfile(userId) {
  const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export async function requireRole(req, res, roles) {
  const user = await requireUser(req, res);
  if (!user) return null;
  const want = Array.isArray(roles) ? roles : [roles];
  const metaRole = user.user_metadata?.role;
  const profile = await getProfile(user.id);
  const role = profile?.role || metaRole || 'student';
  if (!want.includes(role)) {
    res.status(403).json({ error: `This action needs a ${want.join(' or ')} account. You are signed in as ${role}.` });
    return null;
  }
  return { user, role, profile };
}
