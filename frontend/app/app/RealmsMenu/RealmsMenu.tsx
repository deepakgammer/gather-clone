'use client'

import React, { useEffect } from 'react'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import BasicButton from '@/components/BasicButton'

const RealmsMenu = ({ errorMessage }: { errorMessage?: string }) => {
  const router = useRouter()

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage)
  }, [errorMessage])

  const goToMetaverse = () => {
    const id = process.env.NEXT_PUBLIC_METAVERSE_ID || 'e7d032be-5780-46eb-a7df-8f31e190da16'
    router.push(`/play/${id}`)
  }

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-black via-[#0e1129] to-black text-white">
      {/* Title Animation */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-4xl font-extrabold mb-10 text-center"
      >
        🌌 Choose Your World
      </motion.h1>

      {/* Button Container */}
      <div className="flex flex-col gap-6 w-full max-w-md px-6">
        {/* Metaverse */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-green-600 hover:bg-green-700 transition-all p-6 rounded-2xl shadow-lg text-center"
        >
          <BasicButton className="text-xl w-full" onClick={goToMetaverse}>
            🌍 Enter Metaverse
          </BasicButton>
        </motion.div>

        {/* Casino (Coming Soon) */}
        <div className="bg-gray-700 p-6 rounded-2xl opacity-60 cursor-not-allowed text-center">
          <button className="text-xl w-full" disabled>
            🎰 Casino (Coming Soon)
          </button>
        </div>
      </div>
    </main>
  )
}

export default RealmsMenu
