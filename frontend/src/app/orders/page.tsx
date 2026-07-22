'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { orderAPI, getStoredUser } from '@/lib/api'
import type { Order, User, OrderStatus } from '@/types'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'
import {
  Package, Plus, Search, Eye, Trash2,
  MapPin, Calendar, ChevronDown
} from 'lucide-react'

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'Semua', value: '' },
  { label: 'Menunggu', value: 'pending' },
  { label: 'Diproses', value: 'processing' },
  { label: 'Dikirim', value: 'shipped' },
  { label: 'Perjalanan', value: 'in_transit' },
  { label: 'Terkirim', value: 'delivered' },
  { label: 'Dibatalkan', value: 'cancelled' },
]

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    const storedUser = getStoredUser()
    setUser(storedUser)
    fetchOrders()
  }, [])

  useEffect(() => {
    let result = orders
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(o =>
        o.tracking_number.toLowerCase().includes(q) ||
        o.sender_name.toLowerCase().includes(q) ||
        o.receiver_name.toLowerCase().includes(q) ||
        o.sender_city.toLowerCase().includes(q) ||
        o.receiver_city.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter(o => o.status === statusFilter)
    }
    setFilteredOrders(result)
  }, [orders, search, statusFilter])

  const fetchOrders = async () => {
    try {
      const res = await orderAPI.getAll()
      setOrders(res.data.orders || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus pesanan ini?')) return
    setDeletingId(id)
    try {
      await orderAPI.delete(id)
      setOrders(prev => prev.filter(o => o.id !== id))
    } catch (err) {
      alert('Gagal menghapus pesanan')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daftar Pesanan</h1>
          <p className="text-gray-500 text-sm mt-0.5">{orders.length} total pesanan</p>
        </div>
        <Link
          href="/orders/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Buat Pesanan
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nomor resi, pengirim, penerima..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white cursor-pointer"
            >
              {STATUS_FILTERS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48">
            <Package className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">Tidak ada pesanan</p>
            <p className="text-gray-400 text-sm mt-1">
              {search || statusFilter ? 'Coba ubah filter pencarian' : 'Buat pesanan pertama Anda'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">No. Resi</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pengirim</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Penerima</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rute</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Harga</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-mono font-semibold text-gray-800">{order.tracking_number}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-400">
                            {new Date(order.created_at).toLocaleDateString('id-ID', {
                              day: '2-digit', month: 'short', year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-800">{order.sender_name}</p>
                      <p className="text-xs text-gray-400">{order.sender_phone || '-'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-800">{order.receiver_name}</p>
                      <p className="text-xs text-gray-400">{order.receiver_phone || '-'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-blue-400" />
                          <span className="text-xs text-gray-600">{order.sender_city}</span>
                        </div>
                        <span className="text-gray-300">→</span>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-gray-600">{order.receiver_city}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{order.weight}g • {order.service_type}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-semibold text-gray-800">
                        Rp {order.price.toLocaleString('id-ID')}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/orders/${order.id}`}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Lihat detail"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {(order.status === 'pending' || user?.role === 'admin') && (
                          <button
                            onClick={() => handleDelete(order.id)}
                            disabled={deletingId === order.id}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
