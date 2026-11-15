import { createClient } from '@supabase/supabase-js';

// Public anon key only. Privileged service-role credentials must remain server-side.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://ztiiyulusburxjkpcfxu.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0aWl5dWx1c2J1cnhqa3BjZnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyMjM5NTksImV4cCI6MjEwOTc5OTk1OX0.qd5nBiDFu2Kuw6KNrZskiCN_fYM1sIg8WQ6rrPe2azQ',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
