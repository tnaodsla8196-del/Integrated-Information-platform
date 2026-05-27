import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Automatically sanitize URL to prevent PostgREST invalid path routing errors (e.g. trailing slashes, /rest/v1)
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

