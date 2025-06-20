'use client'
import React from 'react'
import BasicButton from '@/components/BasicButton'
import AnimatedCharacter from './SkinMenu/AnimatedCharacter'
import { useVideoChat } from '../hooks/useVideoChat'
import MicAndCameraButtons from '@/components/VideoChat/MicAndCameraButtons'

type IntroScreenProps = {
  realmName: string
  skin: string
  username: string
  setShowIntroScreen: (show: boolean) => void
}

const IntroScreen: React.FC<IntroScreenProps> = ({ realmName, skin, username, setShowIntroScreen }) => {
  const src = '/sprites/characters/Character_' + skin + '.png'

  return (
    <main className="dark-gradient w-full h-screen flex flex-col items-center pt-28">
      <h1 className="text-4xl font-semibold">
        Welcome to <span className="text-[#CAD8FF]">{realmName}</span>
      </h1>

      <section className="flex flex-row mt-32 items-center gap-24">
        {/* Left side: only mic button now */}
        <div className="flex flex-col items-center gap-4">
          <MicAndCameraButtons />
        </div>

        {/* Right side: animated character and join */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-row items-center">
            <AnimatedCharacter src={src} noAnimation />
            <p className="relative top-4">{username}</p>
          </div>
          <BasicButton className="py-0 px-32 w-[250px]" onClick={() => setShowIntroScreen(false)}>
            Join
          </BasicButton>
        </div>
      </section>
    </main>
  )
}

export default IntroScreen
