const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : null;

async function getUserFromToken(token) {
  if (!supabase || !token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

async function createProjectRecord({ id, name, prompt, settings, user_id, created_at }) {
  if (!supabaseAdmin) {
    return { data: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabaseAdmin.from('projects').insert({ id, name, prompt, settings, user_id, created_at }).select();
  return { data, error };
}

async function listProjectsForUser(userId) {
  if (!supabaseAdmin) return [];
  let query = supabaseAdmin.from('projects').select('*').order('created_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

module.exports = {
  supabase,
  supabaseAdmin,
  getUserFromToken,
  createProjectRecord,
  listProjectsForUser
};
