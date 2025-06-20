import { io, Socket } from 'socket.io-client'         // ✔ correct import form
import { createClient } from '../supabase/client'
import { request } from './requests'

type ConnectionResponse = {
  success: boolean
  errorMessage: string
}

const backend_url = process.env.NEXT_PUBLIC_BACKEND_URL as string

class Server {
  public socket: Socket = {} as Socket
  private connected = false

  /* ─────────── Connect ─────────── */
  public async connect(
    realmId: string,
    uid: string,
    shareId: string,
    access_token: string
  ) {
    /* create the socket with built‑in auth */
    this.socket = io(backend_url, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      auth: {
        token: access_token,  // 👈 sent via socket.handshake.auth.token
        uid,                  // 👈 sent via socket.handshake.auth.uid
      },
    })

    /* wrap in Promise so PixiApp knows when join succeeds */
    return new Promise<ConnectionResponse>((resolve) => {
      this.socket.connect()

      this.socket.on('connect', () => {
        this.connected = true
        this.socket.emit('joinRealm', { realmId, shareId })
      })

      this.socket.on('joinedRealm', () => {
        resolve({ success: true, errorMessage: '' })
      })

      this.socket.on('failedToJoinRoom', (reason: string) => {
        resolve({ success: false, errorMessage: reason })
      })

      this.socket.on('connect_error', (err: any) => {
        console.error('Connection error:', err)
        resolve({ success: false, errorMessage: err.message })
      })
    })
  }

  /* ─────────── Disconnect ─────────── */
  public disconnect() {
    if (this.connected) {
      this.connected = false
      this.socket.disconnect()
    }
  }

  /* ─────────── Helper for /getPlayersInRoom ─────────── */
  public async getPlayersInRoom(roomIndex: number) {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session)
      return { data: null, error: { message: 'No session provided' } }

    return request(
      '/getPlayersInRoom',
      { roomIndex },
      session.access_token
    )
  }
}

export const server = new Server()
