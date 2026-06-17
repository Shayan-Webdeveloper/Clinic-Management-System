// Supabase client initialization
let supabaseClient = null;

function initSupabase() {
  if (typeof supabase === 'undefined') {
    console.error('Supabase JS library not loaded');
    return null;
  }
  if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.warn('Configure SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js');
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

function getSupabase() {
  if (!supabaseClient) initSupabase();
  return supabaseClient;
}
