import { createClient } from '@supabase/supabase-js';
import { triggerRestore } from './_lib/db-wake.js';

const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://soaffcprplcxcaarvokl.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Ek5cQf18uk9cizqthT09ow_WN3xWg3A';

const key = (serviceKey && serviceKey !== 'YOUR_SUPABASE_SERVICE_ROLE_KEY') ? serviceKey : anonKey;

const supabase = createClient(url, key, {
  global: {
    fetch: async (fetchUrl, options) => {
      const res = await fetch(fetchUrl, options);
      if (!res.ok && res.status >= 500) triggerRestore();
      return res;
    },
  },
});

export default supabase;

