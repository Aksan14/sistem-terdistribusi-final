'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredToken } from '@/lib/api'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const token = getStoredToken()
    if (token) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white text-lg font-medium">LogistikPro</p>
        <p className="text-blue-200 text-sm">Memuat sistem...</p>
      </div>
    </div>
  )
}
