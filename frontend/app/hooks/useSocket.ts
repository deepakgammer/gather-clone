// frontend/app/hooks/useSocket.ts
'use client'
import { io, Socket } from 'socket.io-client'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useRef } from 'react'

export function useSocket(): Socket | null {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    async function connect() {
      if (socketRef.current) return          // already connected

      const supabase = createClient()

      /* Always fetch a *fresh* session to avoid expired token */
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error || !session) {
        console.error('No Supabase session:', error)
        return
      }

      /* Build socket with token + uid in auth */
      socketRef.current = io(process.env.NEXT_PUBLIC_BACKEND_URL!, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        autoConnect: true,
        auth: {
          token: session.access_token,   // JWT
          uid:   session.user.id,        // must match Supabase user.id
        },
      })
    }

    connect()

    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  return socketRef.current
}
