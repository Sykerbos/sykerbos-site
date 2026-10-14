import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const supabase = createClient(
  'https://nyivtwiliacawkfcyget.supabase.co',
  'sb_publishable_9aNvqxT3JXKqFLCyj-Ckeg_85lOHX2B',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
