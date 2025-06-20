// findRealmsByEmail.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uqwmoiwszaocbgiznaic.supabase.co' // <-- replace this
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxd21vaXdzemFvY2JnaXpuYWljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDA5MjI3MiwiZXhwIjoyMDY1NjY4MjcyfQ.WfHVJkgB1cxQ6PZ9z0shmhIjnXx4ALXwXe_AzIHY0Ck' // <-- replace this (keep this private!)

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const targetEmail = 'glitchgamingjd@gmail.com'

async function findRealmsByEmail() {
  try {
    // Step 1: Find user ID from email
    const { data: user, error: userError } = await supabase
      .from('profiles') // or 'users' if you're using a custom table
      .select('id')
      .eq('email', targetEmail)
      .single()

    if (userError || !user) {
      console.error('❌ User not found:', userError?.message || 'No match')
      return
    }

    const userId = user.id
    console.log(`✅ Found user ID: ${userId}`)

    // Step 2: Fetch realms owned by this user
    const { data: realms, error: realmsError } = await supabase
      .from('realms')
      .select('id, name, only_owner, share_id')
      .eq('owner_id', userId)

    if (realmsError) {
      console.error('❌ Error fetching realms:', realmsError.message)
      return
    }

    console.log(`\n🌐 Realms owned by ${targetEmail}:\n`)
    if (realms.length === 0) {
      console.log('⚠️ No realms found.')
    } else {
      realms.forEach((realm, i) => {
        console.log(`${i + 1}. ${realm.name || 'Untitled'} → ID: ${realm.id}`)
      })
    }
  } catch (err) {
    console.error('🔥 Unexpected error:', err.message)
  }
}

findRealmsByEmail()
