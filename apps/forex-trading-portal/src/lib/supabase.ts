import { createClient } from '@supabase/supabase-js';

// Public Supabase publishable key only. Never put service-role credentials in the APK.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://ztiiyulusburxjkpcfxu.supabase.co',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5hDwqvbcUHeSJdXFHf9ugw_VPYGN4J_',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
