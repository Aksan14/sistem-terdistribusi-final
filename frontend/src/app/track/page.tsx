'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { orderAPI } from '@/lib/api'
import { Search, Package, MapPin, Truck } from 'lucide-react'
import type { Order } from '@/types'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'

export default function TrackPage() {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trackingNumber.trim()) return

    setLoading(true)
    setError('')
    setOrder(null)

    try {
      const res = await orderAPI.getByTracking(trackingNumber.trim())
      setOrder(res.data)
    } catch {
      setError('Nomor resi tidak ditemukan. Pastikan nomor resi yang dimasukkan benar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Truck className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">Lacak Paket</h1>
          <p className="text-blue-200 mt-1">Masukkan nomor resi untuk melacak paket Anda</p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-4">
          <form onSubmit={handleTrack} className="flex gap-3">
            <div className="relative flex-1">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={trackingNumber}
                onChange={e => setTrackingNumber(e.target.value.toUpperCase())}
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 font-mono text-lg"
                placeholder="EXP1234567890"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !trackingNumber.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors"
            >
              <Search className="w-5 h-5" />
              {loading ? 'Mencari...' : 'Lacak'}
            </button>
          </form>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {order && (
            <div className="mt-6 border border-gray-100 rounded-xl p-6 fade-in">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">Nomor Resi</p>
                  <p className="text-lg font-mono font-bold text-gray-800">{order.tracking_number}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Pengirim</p>
                  <p className="font-semibold text-gray-800">{order.sender_name}</p>
                  <div className="flex items-start gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-600">{order.sender_city}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Penerima</p>
                  <p className="font-semibold text-gray-800">{order.receiver_name}</p>
                  <div className="flex items-start gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-600">{order.receiver_city}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600 border-t border-gray-100 pt-3">
                <span>Berat: <strong>{order.weight}g</strong></span>
                <span>Layanan: <strong className="capitalize">{order.service_type}</strong></span>
                <span>Harga: <strong>Rp {order.price.toLocaleString('id-ID')}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Back to login */}
        <div className="text-center">
          <button
            onClick={() => router.push('/login')}
            className="text-blue-200 hover:text-white text-sm underline"
          >
            ← Kembali ke halaman login
          </button>
        </div>
      </div>
    </div>
  )
}
