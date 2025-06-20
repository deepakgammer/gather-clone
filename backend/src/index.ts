/* ─────────────────────────────────────────────
   1.  .env FIRST, before any other import that might need env vars
───────────────────────────────────────────────*/
require('dotenv').config()          // ✅ already correct

import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'

/* If routes or sockets files import { supabase } they must import it
   from  "../supabaseAdmin" (service‑role) not from anon client */
import routes from './routes/routes'
import { sockets } from './sockets/sockets'   // <- sockets.ts should now use supabaseAdmin

/* ─────────────────────────────────────────────
   Environment variables
───────────────────────────────────────────────*/
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000'
const PORT = Number(process.env.PORT) || 4000   // keep 4000 for local

/* ─────────────────────────────────────────────
   Express + CORS setup
───────────────────────────────────────────────*/
const app = express()

app.use(
  cors({
    origin: FRONTEND,
    credentials: true,
  })
)

/* ─────────────────────────────────────────────
   HTTP + Socket.IO server
───────────────────────────────────────────────*/
const server = http.createServer(app)

const io = new SocketIOServer(server, {
  cors: {
    origin: FRONTEND,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})

/* REST routes and socket wiring */
app.use(routes())
sockets(io)

/* ─────────────────────────────────────────────
   Launch
───────────────────────────────────────────────*/
server.listen(PORT, () => {
  console.log(`Socket‑server ⚡  running on http://localhost:${PORT}`)
  console.log(`CORS allowed origin → ${FRONTEND}`)
})

/* Export if helpers need a live io instance */
export { io }
