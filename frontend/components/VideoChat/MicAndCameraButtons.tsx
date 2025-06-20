'use client'

import React, { useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { videoChat } from '@/utils/video-chat/video-chat'

/**
 * MicAndCameraButtons  (audio‑only version)
 * -----------------------------------------
 * • Shows a single mic toggle button.
 * • No camera toggle, no video track created.
 */
const MicAndCameraButtons: React.FC = () => {
  const [micMuted, setMicMuted] = useState(false)

  /* ─── Toggle microphone ─── */
  const toggleMic = async () => {
    const muted = await videoChat.toggleMicrophone()
    setMicMuted(muted)
  }

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mic button */}
      <button
        onClick={toggleMic}
        className={`rounded-full p-3 transition-colors ${
          micMuted ? 'bg-red-600' : 'bg-emerald-600'
        } hover:opacity-80`}
        title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </button>
    </div>
  )
}

export default MicAndCameraButtons
