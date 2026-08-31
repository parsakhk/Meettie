import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY // Using the key provided by the user

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
