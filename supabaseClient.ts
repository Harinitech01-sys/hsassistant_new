import { createClient } from "@supabase/supabase-js";

// 1. Map properties directly to the environment handles expected by your application framework
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tnqmjlculjjhvnwytvvw.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "sb_publishable_mRfGN1Hq3Z3Cm5DZj0p1fA_4mt0lHwV";

// 2. Defensive check to ensure Netlify doesn't throw errors during build execution passes
export const supabase = 
  typeof window === "undefined" && (!SUPABASE_URL || !SUPABASE_KEY)
    ? (null as any)
    : createClient(SUPABASE_URL, SUPABASE_KEY);