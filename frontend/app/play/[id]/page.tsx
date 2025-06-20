// frontend/app/play/[id]/page.tsx

import React from 'react'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'

import NotFound from '@/app/not-found'
import { createClient } from '@/utils/supabase/server'
import { updateVisitedRealms } from '@/utils/supabase/updateVisitedRealms'
import { formatEmailToName } from '@/utils/formatEmailToName'

/* 👉 PlayClient is imported dynamically, client-side only */
const PlayClient = dynamic(() => import('../PlayClient'), { ssr: false })

export default async function Play({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { shareId?: string }
}) {
  // ───── Supabase session & auth ─────
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!session || !user) {
    return redirect('/signin')
  }

  // ───── Fetch realm by ID (no shareId logic) ─────
  const { data: realm, error: realmError } = await supabase
    .from('realms')
    .select('map_data, owner_id, name')
    .eq('id', params.id)
    .single()

  // ───── Ensure profile exists ─────
  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('skin')
    .eq('id', user.id)
    .single()

  if (!profile) {
    const { data: created, error: createError } = await supabase
      .from('profiles')
      .insert({ id: user.id, skin: 'Character_default' })
      .select('skin')
      .single()

    profile = created
    if (createError) profileError = createError
  }

  // ───── Handle missing data ─────
  if (!realm || !profile) {
    const message = realmError?.message || profileError?.message || 'Unknown error'
    return <NotFound specialMessage={message} />
  }

  // ───── Optional: Update visited realms if using shareId ─────
  if (searchParams.shareId && realm.owner_id !== user.id) {
    updateVisitedRealms(session.access_token, searchParams.shareId)
  }

  // ───── Render the PlayClient ─────
  return (
    <PlayClient
      mapData={realm.map_data}
      username={formatEmailToName(user.user_metadata.email)}
      access_token={session.access_token}
      realmId={params.id}
      uid={user.id}
      shareId={searchParams.shareId || ''}
      initialSkin={profile.skin}
      name={realm.name}
    />
  )
}
