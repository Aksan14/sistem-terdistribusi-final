'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { orderAPI, trackingAPI, getStoredUser } from '@/lib/api'
import type { Order, TrackingEvent, User } from '@/types'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'
import {
  ArrowLeft, Package, MapPin, Calendar, Weight,
  CheckCircle, Clock, Truck, XCircle, RefreshCw,
  ChevronDown
} from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'processing', label: 'Diproses' },
  { value: 'shipped', label: 'Dikirim' },
  { value: 'in_transit', label: 'Dalam Perjalanan' },
  { value: 'delivered', label: 'Terkirim' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4 text-yellow-500" />,
  processing: <Package className="w-4 h-4 text-blue-500" />,
  shipped: <Package className="w-4 h-4 text-purple-500" />,
  in_transit: <Truck className="w-4 h-4 text-indigo-500" />,
  delivered: <CheckCircle className="w-4 h-4 text-green-500" />,
  cancelled: <XCircle className="w-4 h-4 text-red-500" />,
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [tracking, setTracking] = useState<TrackingEvent[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [newStatus, setNewStatus] = useState('')

  useEffect(() => {
    const storedUser = getStoredUser()
    setUser(storedUser)
    fetchData()
  }, [params.id])

  const fetchData = async () => {
    try {
      const [orderRes, trackingRes] = await Promise.all([
        orderAPI.getById(Number(params.id)),
        trackingAPI.getByOrderId(Number(params.id)),
      ])
      setOrder(orderRes.data)
      setTracking(trackingRes.data.events || [])
      setNewStatus(orderRes.data.status)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async () => {
    if (!newStatus || newStatus === order?.status) return
    setUpdatingStatus(true)
    try {
      await orderAPI.updateStatus(Number(params.id), newStatus)
      await fetchData()
    } catch (err) {
      alert('Gagal mengubah status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Package className="w-12 h-12 text-gray-200 mb-3" />
        <p className="text-gray-500">Pesanan tidak ditemukan</p>
        <Link href="/orders" className="mt-3 text-blue-600 hover:text-blue-700 text-sm">
          Kembali ke daftar pesanan
        </Link>
      </div>
    )
  }

  const canUpdateStatus = user?.role === 'admin' || user?.role === 'courier'

  return (
    <div className="max-w-4xl mx-auto space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/orders" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-800 font-mono">{order.tracking_number}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Dibuat {new Date(order.created_at).toLocaleDateString('id-ID', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Route */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Informasi Pengiriman</h2>
            <div className="flex gap-4">
              {/* Sender */}
              <div className="flex-1 bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">A</span>
                  </div>
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Pengirim</p>
                </div>
                <p className="font-semibold text-gray-800">{order.sender_name}</p>
                {order.sender_phone && <p className="text-sm text-gray-600 mt-0.5">{order.sender_phone}</p>}
                <div className="flex items-start gap-1.5 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-700">{order.sender_city}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{order.sender_address}</p>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0">
                <Truck className="w-5 h-5 text-gray-400" />
                <div className="w-px h-8 bg-gray-200" />
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
              </div>

              {/* Receiver */}
              <div className="flex-1 bg-green-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">B</span>
                  </div>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Penerima</p>
                </div>
                <p className="font-semibold text-gray-800">{order.receiver_name}</p>
                {order.receiver_phone && <p className="text-sm text-gray-600 mt-0.5">{order.receiver_phone}</p>}
                <div className="flex items-start gap-1.5 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-700">{order.receiver_city}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{order.receiver_address}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tracking Timeline */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              Riwayat Pelacakan
            </h2>
            {tracking.length === 0 ? (
              <div className="text-center py-6">
                <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Belum ada data pelacakan</p>
              </div>
            ) : (
              <div className="space-y-0">
                {tracking.map((event, index) => (
                  <div key={event.id} className="flex gap-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        index === 0 ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        {STATUS_ICONS[event.status] || <Package className="w-4 h-4 text-gray-400" />}
                      </div>
                      {index < tracking.length - 1 && (
                        <div className="w-0.5 h-6 bg-gray-200 mt-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`pb-4 flex-1 ${index === tracking.length - 1 ? '' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className={`font-semibold text-sm ${index === 0 ? 'text-blue-700' : 'text-gray-700'}`}>
                            {event.description || STATUS_LABELS[event.status as keyof typeof STATUS_LABELS] || event.status}
                          </p>
                          {event.location && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <p className="text-xs text-gray-500">{event.location}</p>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {new Date(event.created_at).toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Package info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Detail Paket</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <Weight className="w-3.5 h-3.5" /> Berat
                </span>
                <span className="text-sm font-medium text-gray-800">{order.weight} gram</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Layanan
                </span>
                <span className="text-sm font-medium text-gray-800 capitalize">{order.service_type}</span>
              </div>
              {order.description && (
                <div className="flex items-start justify-between">
                  <span className="text-sm text-gray-500">Isi Paket</span>
                  <span className="text-sm font-medium text-gray-800 text-right ml-4">{order.description}</span>
                </div>
              )}
              {order.notes && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 mb-1">Catatan</p>
                  <p className="text-sm text-gray-700">{order.notes}</p>
                </div>
              )}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Total Biaya</span>
                  <span className="text-lg font-bold text-blue-600">
                    Rp {order.price.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Update Status (Admin/Courier) */}
          {canUpdateStatus && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Perbarui Status</h2>
              <div className="space-y-3">
                <div className="relative">
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    className="w-full appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white cursor-pointer"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <button
                  onClick={handleStatusUpdate}
                  disabled={updatingStatus || newStatus === order.status}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {updatingStatus ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Memperbarui...
                    </>
                  ) : 'Perbarui Status'}
                </button>
              </div>
            </div>
          )}

          {/* Timeline info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Waktu</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Dibuat</span>
                <span className="text-xs font-medium text-gray-700">
                  {new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Diperbarui</span>
                <span className="text-xs font-medium text-gray-700">
                  {new Date(order.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
