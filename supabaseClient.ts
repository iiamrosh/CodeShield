
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Replace with your actual Supabase Project URL and Anon Key
const supabaseUrl = 'https://ykoqzdempfwypbhovypt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrb3F6ZGVtcGZ3eXBiaG92eXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NTQxODQsImV4cCI6MjA3NzIzMDE4NH0.NLojAiSstJNjugSbrjJBeqUWoWhvM-RpXmJ2_ORwyZc';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL or Anon Key is not set. Please configure them.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);