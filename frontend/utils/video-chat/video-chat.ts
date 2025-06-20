/* utils/video-chat/video-chat.ts
   ────────────────────────────────────────────────────────────────
   Voice‑only Agora helper, safe for Next.js SSR (no window access
   during server render) and with a stubbed video preview method so
   existing components don’t break.
*/
'use client'

import signal from '../signal'
import { createHash } from 'crypto'
import { generateToken } from './generateToken'

import type {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  IAgoraRTCRemoteUser,
  IDataChannelConfig,
} from 'agora-rtc-sdk-ng'

export class VoiceChat {
  /* Agora client & tracks */
  private client!: IAgoraRTCClient
  private micTrack: IMicrophoneAudioTrack | null = null
  private cameraTrack: ICameraVideoTrack | null = null // kept only for API compatibility

  /* State */
  private currentChannel = ''
  private remoteUsers: Record<string, IAgoraRTCRemoteUser> = {}
  private channelTimeout: NodeJS.Timeout | null = null

  constructor() {
    /* Skip entire setup when we’re on the server */
    if (typeof window === 'undefined') return

    const AgoraRTC = require('agora-rtc-sdk-ng')
    this.client = AgoraRTC.createClient({ codec: 'vp8', mode: 'rtc' })
    AgoraRTC.setLogLevel(4)

    this.client.on('user-published', this.onUserPublished)
    this.client.on('user-unpublished', this.onUserUnpublished)
    this.client.on('user-left', this.onUserLeft)
    this.client.on('user-info-updated', this.onUserInfoUpdated)
    this.client.on('user-joined', this.onUserJoined)
  }

  /* ─────────── Event handlers ─────────── */

  private onUserInfoUpdated = (uid: string) => {
    if (this.remoteUsers[uid]) signal.emit('user-info-updated', this.remoteUsers[uid])
  }

  private onUserJoined = (user: IAgoraRTCRemoteUser) => {
    this.remoteUsers[user.uid] = user
    signal.emit('user-info-updated', user)
  }

  private onUserPublished = async (
    user: IAgoraRTCRemoteUser,
    mediaType: 'audio' | 'video' | 'datachannel',
    _cfg?: IDataChannelConfig,
  ) => {
    /* Ignore video/datachannel – audio only */
    if (mediaType !== 'audio') return

    this.remoteUsers[user.uid] = user
    await this.client.subscribe(user, mediaType)
    user.audioTrack?.play()
    signal.emit('user-info-updated', user)
  }

  private onUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video' | 'datachannel') => {
    if (mediaType === 'audio') user.audioTrack?.stop()
  }

  private onUserLeft = (user: IAgoraRTCRemoteUser) => {
    delete this.remoteUsers[user.uid]
    signal.emit('user-left', user)
  }

  /* ─────────── Public API ─────────── */

  /** Toggle mic mute/unmute */
  public async toggleMicrophone() {
    const AgoraRTC = typeof window !== 'undefined' ? require('agora-rtc-sdk-ng') : null
    if (!AgoraRTC) return true

    if (!this.micTrack) {
      this.micTrack = await AgoraRTC.createMicrophoneAudioTrack()
      if (this.client.connectionState === 'CONNECTED') await this.client.publish([this.micTrack])
      return false // now un‑muted
    }
    await this.micTrack.setMuted(!this.micTrack.muted)
    return this.micTrack.muted // true = muted
  }

  /** Stub kept so existing UI calls don’t crash. Always returns true (camera off). */
  public async toggleCamera() {
    return true
  }

  /** No‑op preview stub – avoids “playVideoTrackAtElementId is not a function” */
  public playVideoTrackAtElementId(_elementId: string) {
    /* Intentionally empty – video disabled */
  }

  /** Join a proximity sub‑channel */
  public async joinChannel(channel: string, uid: string, realmId: string) {
    if (typeof window === 'undefined') return
    if (this.channelTimeout) clearTimeout(this.channelTimeout)

    this.channelTimeout = setTimeout(async () => {
      if (channel === this.currentChannel) return

      const unique = this.hash(`${realmId}-${channel}`)
      const token = await generateToken(unique)
      if (!token) return

      if (this.client.connectionState === 'CONNECTED') await this.client.leave()
      this.resetRemoteUsers()

      await this.client.join(process.env.NEXT_PUBLIC_AGORA_APP_ID!, unique, token, uid)
      this.currentChannel = channel

      if (this.micTrack && !this.micTrack.muted) await this.client.publish([this.micTrack])
    }, 1000)
  }

  /** Leave current sub‑channel */
  public async leaveChannel() {
    if (typeof window === 'undefined') return
    if (this.channelTimeout) clearTimeout(this.channelTimeout)

    this.channelTimeout = setTimeout(async () => {
      if (this.currentChannel === '') return
      if (this.client.connectionState === 'CONNECTED') await this.client.leave()
      this.currentChannel = ''
      this.resetRemoteUsers()
    }, 1000)
  }

  /** Clean up tracks when user exits the page */
  public destroy() {
    if (this.micTrack) {
      this.micTrack.stop()
      this.micTrack.close()
    }
    this.micTrack = null
    /* cameraTrack stays null – no video */
  }

  /* ─────────── Helpers ─────────── */

  private resetRemoteUsers() {
    this.remoteUsers = {}
    signal.emit('reset-users')
  }

  private hash(src: string) {
    return createHash('md5').update(src).digest('hex').substring(0, 16)
  }
}

/* Export singleton – empty object on server, full instance in browser */
export const videoChat = typeof window !== 'undefined' ? new VoiceChat() : ({} as VoiceChat)
