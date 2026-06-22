import { createClient } from '@supabase/supabase-js';

// Replace these strings with your actual credentials from Supabase Dashboard -> Settings -> API
const SUPABASE_URL = 'https://tnqmjlculjjhvnwytvvw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mRfGN1Hq3Z3Cm5DZj0p1fA_4mt0lHwV';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);