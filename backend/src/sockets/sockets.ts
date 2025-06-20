/* ✅ UPDATED sockets.ts — allows all users to join the fixed realm */

import { Server } from 'socket.io'
import {
  JoinRealm,
  Disconnect,
  OnEventCallback,
  MovePlayer,
  Teleport,
  ChangedSkin,
  NewMessage,
} from './socket-types'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { supabase } from '../supabase'
import { users } from '../Users'
import { sessionManager } from '../session'
import { removeExtraSpaces, formatEmailToName } from '../utils'
import { kickPlayer } from './helpers'

type JWTPayload = {
  sub: string
  email?: string
  iat?: number
  exp?: number
}

const joiningInProgress = new Set<string>()

function protectConnection(io: Server) {
  io.use((socket, next) => {
    const { token, uid } = socket.handshake.auth as {
      token?: string
      uid?: string
    }

    if (!token || !uid) return next(new Error('Missing auth token or uid'))

    try {
      const payload = jwt.decode(token) as JWTPayload | null
      if (!payload) throw new Error('Unable to decode JWT')

      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) throw new Error('JWT expired')
      if (payload.sub !== uid) throw new Error('UID mismatch in JWT')

      users.addUser(uid, {
        id: uid,
        user_metadata: { email: payload.email ?? '' },
      } as any)

      next()
    } catch (err: any) {
      console.error('JWT validation failed:', err.message)
      next(new Error('Invalid token or uid'))
    }
  })
}

export function sockets(io: Server) {
  protectConnection(io)

  io.on('connection', (socket) => {
    const uid = socket.handshake.auth.uid as string

    function on(eventName: string, schema: z.ZodTypeAny, callback: OnEventCallback) {
      socket.on(eventName, (data: any) => {
        if (!schema.safeParse(data).success) return
        const session = sessionManager.getPlayerSession(uid)
        if (!session) return
        callback({ session, data })
      })
    }

    function emit(eventName: string, data: any) {
      const session = sessionManager.getPlayerSession(uid)
      if (!session) return
      const room = session.getPlayerRoom(uid)
      session.getPlayersInRoom(room).forEach((p) => {
        if (p.socketId !== socket.id) io.to(p.socketId).emit(eventName, data)
      })
    }

    function emitToSocketIds(socketIds: string[], eventName: string, data: any) {
      socketIds.forEach((sid) => io.to(sid).emit(eventName, data))
    }

    socket.on('joinRealm', async (realmData: z.infer<typeof JoinRealm>) => {
      const rejectJoin = (reason: string) => {
        socket.emit('failedToJoinRoom', reason)
        joiningInProgress.delete(uid)
      }

      if (!JoinRealm.safeParse(realmData).success) return rejectJoin('Invalid request data.')
      if (joiningInProgress.has(uid)) return rejectJoin('Already joining a space.')
      joiningInProgress.add(uid)

      const { data: realm, error } = await supabase
        .from('realms')
        .select('owner_id, map_data')
        .eq('id', realmData.realmId)
        .single()

      if (error || !realm) {
        console.warn('⚠️ Realm not found or error:', error?.message)
        return rejectJoin('Space not found.')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('skin')
        .eq('id', uid)
        .single()

      if (profileError) return rejectJoin('Failed to get profile.')

      const join = () => {
        if (!sessionManager.getSession(realmData.realmId)) {
          sessionManager.createSession(realmData.realmId, realm.map_data)
        }

        const existing = sessionManager.getPlayerSession(uid)
        if (existing) kickPlayer(uid, 'You have logged in from another location.')

        const user = users.getUser(uid)!
        const username = formatEmailToName(user.user_metadata.email)

        sessionManager.addPlayerToSession(
          socket.id,
          realmData.realmId,
          uid,
          username,
          profile.skin
        )

        const player = sessionManager.getPlayerSession(uid).getPlayer(uid)
        socket.join(realmData.realmId)
        socket.emit('joinedRealm')
        emit('playerJoinedRoom', player)
        joiningInProgress.delete(uid)
      }

      join()
    })

    on('disconnect', Disconnect, ({ session }) => {
      const ids = sessionManager.getSocketIdsInRoom(session.id, session.getPlayerRoom(uid))
      if (sessionManager.logOutBySocketId(socket.id)) {
        emitToSocketIds(ids, 'playerLeftRoom', uid)
        users.removeUser(uid)
      }
    })

    on('movePlayer', MovePlayer, ({ session, data }) => {
      const changed = session.movePlayer(uid, data.x, data.y)
      const player = session.getPlayer(uid)

      emit('playerMoved', { uid, x: player.x, y: player.y })

      changed.forEach((cid) => {
        const cp = session.getPlayer(cid)
        emitToSocketIds([cp.socketId], 'proximityUpdate', { proximityId: cp.proximityId })
      })
    })

    on('teleport', Teleport, ({ session, data }) => {
      const player = session.getPlayer(uid)

      if (player.room !== data.roomIndex) {
        emit('playerLeftRoom', uid)
        const changed = session.changeRoom(uid, data.roomIndex, data.x, data.y)
        emit('playerJoinedRoom', player)

        changed.forEach((cid) => {
          const cp = session.getPlayer(cid)
          emitToSocketIds([cp.socketId], 'proximityUpdate', { proximityId: cp.proximityId })
        })
      } else {
        const changed = session.movePlayer(uid, data.x, data.y)
        emit('playerTeleported', { uid, x: player.x, y: player.y })

        changed.forEach((cid) => {
          const cp = session.getPlayer(cid)
          emitToSocketIds([cp.socketId], 'proximityUpdate', { proximityId: cp.proximityId })
        })
      }
    })

    on('changedSkin', ChangedSkin, ({ session, data }) => {
      session.getPlayer(uid).skin = data
      emit('playerChangedSkin', { uid, skin: data })
    })

    on('sendMessage', NewMessage, ({ session, data }) => {
      if (data.length > 300 || data.trim() === '') return
      emit('receiveMessage', { uid, message: removeExtraSpaces(data) })
    })
  })
}
