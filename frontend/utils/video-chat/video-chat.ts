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
  private client!: IAgoraRTCClient
  private micTrack: IMicrophoneAudioTrack | null = null
  private cameraTrack: ICameraVideoTrack | null = null

  private currentChannel = ''
  private remoteUsers: Record<string, IAgoraRTCRemoteUser> = {}
  private channelTimeout: NodeJS.Timeout | null = null

  constructor() {
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

  /** Toggle mic mute/unmute */
  public async toggleMicrophone() {
    const AgoraRTC = typeof window !== 'undefined' ? require('agora-rtc-sdk-ng') : null
    if (!AgoraRTC) return true

    if (!this.micTrack) {
      this.micTrack = await AgoraRTC.createMicrophoneAudioTrack()
      if (this.client.connectionState === 'CONNECTED' && this.micTrack) {
        await this.client.publish([this.micTrack])
      }
      return false
    }
    await this.micTrack.setMuted(!this.micTrack.muted)
    return this.micTrack.muted
  }

  public async toggleCamera() {
    return true
  }

  public playVideoTrackAtElementId(_elementId: string) {
    // No-op
  }

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

  public destroy() {
    if (this.micTrack) {
      this.micTrack.stop()
      this.micTrack.close()
    }
    this.micTrack = null
  }

  private resetRemoteUsers() {
    this.remoteUsers = {}
    signal.emit('reset-users')
  }

  private hash(src: string) {
    return createHash('md5').update(src).digest('hex').substring(0, 16)
  }
}

export const videoChat = typeof window !== 'undefined' ? new VoiceChat() : ({} as VoiceChat)
