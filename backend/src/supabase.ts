import { createClient } from '@supabase/supabase-js'
require('dotenv').config()

console.log(
  '✅ Supabase client initialized with service-role key:',
  process.env.SERVICE_ROLE?.slice(0, 16) + '...'
)

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SERVICE_ROLE! // Ensure this is the service role key
)
