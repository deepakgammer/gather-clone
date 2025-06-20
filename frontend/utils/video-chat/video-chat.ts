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
  ILocalTrack,
} from 'agora-rtc-sdk-ng'

export class VoiceChat {
  private client!: IAgoraRTCClient
  private micTrack: IMicrophoneAudioTrack | null = null
  private cameraTrack: ICameraVideoTrack | null = null

  private currentChannel = ''
  private remoteUsers: Record<string, IAgoraRTCRemoteUser> = {}
  private channelTimeout: NodeJS.Timeout | null = null
  private AgoraRTC: any

  constructor() {
    if (typeof window === 'undefined') return

    this.AgoraRTC = require('agora-rtc-sdk-ng')
    this.client = this.AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
    this.AgoraRTC.setLogLevel(4)

    this.setupEventListeners()
  }

  private setupEventListeners() {
    this.client.on('user-published', this.onUserPublished)
    this.client.on('user-unpublished', this.onUserUnpublished)
    this.client.on('user-left', this.onUserLeft)
    this.client.on('user-info-updated', this.onUserInfoUpdated)
    this.client.on('user-joined', this.onUserJoined)
    this.client.on('token-privilege-will-expire', this.onTokenWillExpire)
    this.client.on('token-privilege-did-expire', this.onTokenExpired)
  }

  private onUserInfoUpdated = (uid: string) => {
    if (this.remoteUsers[uid]) {
      signal.emit('user-info-updated', this.remoteUsers[uid])
    }
  }

  private onUserJoined = (user: IAgoraRTCRemoteUser) => {
    console.log('✅ User joined:', user.uid)
    this.remoteUsers[user.uid] = user
    signal.emit('user-info-updated', user)
  }

  private onUserPublished = async (
    user: IAgoraRTCRemoteUser,
    mediaType: 'audio' | 'video' | 'datachannel',
  ) => {
    console.log('📡 User published:', user.uid, mediaType)
    
    try {
      await this.client.subscribe(user, mediaType)
      
      if (mediaType === 'audio' && user.audioTrack) {
        this.remoteUsers[user.uid] = user
        user.audioTrack.play()
        console.log('🔊 Playing remote audio track for user:', user.uid)
      }
      
      signal.emit('user-info-updated', user)
    } catch (error) {
      console.error('❌ Error subscribing to user:', error)
    }
  }

  private onUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video' | 'datachannel') => {
    console.log('📡 User unpublished:', user.uid, mediaType)
    if (mediaType === 'audio' && user.audioTrack) {
      user.audioTrack.stop()
    }
  }

  private onUserLeft = (user: IAgoraRTCRemoteUser) => {
    console.log('👋 User left:', user.uid)
    delete this.remoteUsers[user.uid]
    signal.emit('user-left', user)
  }

  private onTokenWillExpire = async () => {
    console.log('🔄 Token will expire soon')
    if (!this.currentChannel) return
    
    try {
      const token = await generateToken(this.currentChannel)
      if (token) {
        await this.client.renewToken(token)
        console.log('✅ Token renewed successfully')
      }
    } catch (error) {
      console.error('❌ Failed to renew token:', error)
    }
  }

  private onTokenExpired = async () => {
    console.log('⚠️ Token expired')
    if (this.currentChannel) {
      await this.leaveChannel()
    }
  }

  public async toggleMicrophone(): Promise<boolean> {
    if (!this.AgoraRTC) return true

    try {
      if (!this.micTrack) {
        this.micTrack = await this.AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
        })
        console.log('✅ Mic track created')

        if (this.client.connectionState === 'CONNECTED') {
          await this.client.publish(this.micTrack)
          console.log('📢 Mic published to channel')
        }
        return false
      }

      const newMuteState = !this.micTrack.muted
      await this.micTrack.setMuted(newMuteState)
      console.log('🎙️ Mic state:', newMuteState ? 'muted' : 'unmuted')
      return newMuteState
    } catch (error) {
      console.error('❌ Error toggling microphone:', error)
      return true
    }
  }

  public async toggleCamera(): Promise<boolean> {
    return true
  }

  public async joinChannel(channel: string, uid: string, realmId: string): Promise<void> {
    if (typeof window === 'undefined') return
    
    if (this.channelTimeout) {
      clearTimeout(this.channelTimeout)
      this.channelTimeout = null
    }

    if (channel === this.currentChannel) return

    try {
      const uniqueChannelId = this.hash(`${realmId}-${channel}`)
      const token = await generateToken(uniqueChannelId)
      
      if (!token) {
        throw new Error('Failed to generate token')
      }

      if (this.client.connectionState === 'CONNECTED') {
        await this.client.leave()
        this.resetRemoteUsers()
      }

      await this.client.join(
        process.env.NEXT_PUBLIC_AGORA_APP_ID!,
        uniqueChannelId,
        token,
        uid
      )
      
      this.currentChannel = channel
      console.log('✅ Successfully joined channel:', channel)

      if (!this.micTrack) {
        await this.toggleMicrophone()
      } else if (!this.micTrack.muted && !this.micTrack.isPlaying) {
        await this.client.publish(this.micTrack)
        console.log('📢 Mic republished after channel join')
      }
    } catch (error) {
      console.error('❌ Failed to join channel:', error)
      throw error
    }
  }

  public async leaveChannel(): Promise<void> {
    if (typeof window === 'undefined') return
    
    if (this.channelTimeout) {
      clearTimeout(this.channelTimeout)
      this.channelTimeout = null
    }

    try {
      if (this.client.connectionState === 'CONNECTED') {
        if (this.micTrack) {
          await this.client.unpublish(this.micTrack)
        }
        await this.client.leave()
      }
      
      this.currentChannel = ''
      this.resetRemoteUsers()
      console.log('👋 Successfully left channel')
    } catch (error) {
      console.error('❌ Error leaving channel:', error)
      throw error
    }
  }

  public async destroy(): Promise<void> {
    try {
      await this.leaveChannel()
      
      if (this.micTrack) {
        this.micTrack.stop()
        this.micTrack.close()
        this.micTrack = null
      }
      
      if (this.cameraTrack) {
        this.cameraTrack.stop()
        this.cameraTrack.close()
        this.cameraTrack = null
      }
      
      console.log('🧹 Voice chat destroyed')
    } catch (error) {
      console.error('❌ Error during cleanup:', error)
    }
  }

  private resetRemoteUsers(): void {
    this.remoteUsers = {}
    signal.emit('reset-users')
  }

  private hash(src: string): string {
    return createHash('md5').update(src).digest('hex').substring(0, 16)
  }

  public getCurrentChannel(): string {
    return this.currentChannel
  }

  public getRemoteUsers(): IAgoraRTCRemoteUser[] {
    return Object.values(this.remoteUsers)
  }

  public getMicrophoneState(): boolean {
    return this.micTrack?.muted ?? true
  }
}

// Export as default to avoid naming inconsistencies
export default typeof window !== 'undefined' ? new VoiceChat() : ({} as VoiceChat)