'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar/Navbar'
import RealmsMenu from './RealmsMenu/RealmsMenu'

export default async function App() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!user || !session) {
    return redirect('/signin')
  }

  return (
    <div>
      <Navbar />
      {/* Removed the extra heading */}
      <RealmsMenu />
    </div>
  )
}
