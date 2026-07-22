'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { orderAPI, notificationAPI, getStoredUser } from '@/lib/api'
import type { Order, Notification, User, OrderStats } from '@/types'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'
import {
  Package, TrendingUp, Bell, Plus, ArrowRight,
  CheckCircle, Clock, Truck, XCircle
} from 'lucide-react'

interface StatCard {
  title: string
  value: number
  icon: React.ReactNode
  color: string
  bgColor: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = getStoredUser()
    if (!storedUser) {
      router.replace('/login')
      return
    }
    setUser(storedUser)
    fetchData()
  }, [router])

  const fetchData = async () => {
    try {
      const [ordersRes, notifRes, statsRes] = await Promise.all([
        orderAPI.getAll(),
        notificationAPI.getAll(),
        orderAPI.getStats(),
      ])
      setOrders(ordersRes.data.orders || [])
      setNotifications(notifRes.data.notifications || [])
      setStats(statsRes.data)
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const unreadNotifs = notifications.filter(n => !n.read).length
  const recentOrders = orders.slice(0, 5)

  const statCards: StatCard[] = [
    {
      title: 'Total Pesanan',
      value: orders.length,
      icon: <Package className="w-6 h-6" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Dalam Perjalanan',
      value: (stats?.shipped || 0) + (stats?.in_transit || 0),
      icon: <Truck className="w-6 h-6" />,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Terkirim',
      value: stats?.delivered || 0,
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Notifikasi Baru',
      value: unreadNotifs,
      icon: <Bell className="w-6 h-6" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ]

  return (
    <div className="space-y-6 fade-in">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              Selamat Datang, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-blue-100">
              Kelola pengiriman Anda dengan mudah dan efisien
            </p>
          </div>
          <Link
            href="/orders/new"
            className="hidden md:flex items-center gap-2 bg-white text-blue-600 px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Buat Pesanan
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-11 h-11 ${card.bgColor} rounded-xl flex items-center justify-center mb-3`}>
              <span className={card.color}>{card.icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{card.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{card.title}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders + Order Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              Pesanan Terbaru
            </h2>
            <Link
              href="/orders"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Lihat semua <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Belum ada pesanan</p>
              <Link
                href="/orders/new"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat pesanan pertama Anda
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentOrders.map(order => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{order.tracking_number}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {order.sender_city} → {order.receiver_city}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    <p className="text-xs text-gray-400">
                      Rp {order.price.toLocaleString('id-ID')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Order Status Summary */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Statistik Status
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: 'Menunggu', key: 'pending' as const, color: 'bg-yellow-400', icon: <Clock className="w-3 h-3" /> },
              { label: 'Diproses', key: 'processing' as const, color: 'bg-blue-400', icon: <Package className="w-3 h-3" /> },
              { label: 'Dikirim', key: 'shipped' as const, color: 'bg-purple-400', icon: <Truck className="w-3 h-3" /> },
              { label: 'Perjalanan', key: 'in_transit' as const, color: 'bg-indigo-400', icon: <Truck className="w-3 h-3" /> },
              { label: 'Terkirim', key: 'delivered' as const, color: 'bg-green-400', icon: <CheckCircle className="w-3 h-3" /> },
              { label: 'Dibatalkan', key: 'cancelled' as const, color: 'bg-red-400', icon: <XCircle className="w-3 h-3" /> },
            ].map(item => {
              const count = stats?.[item.key] || 0
              const total = orders.length || 1
              const pct = Math.round((count / total) * 100)
              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 text-xs">{item.label}</span>
                    <span className="font-semibold text-gray-800">{count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/orders/new" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 flex flex-col items-center gap-2 text-center transition-colors">
          <Plus className="w-6 h-6" />
          <span className="text-sm font-medium">Buat Pesanan</span>
        </Link>
        <Link href="/orders" className="bg-white hover:bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 text-center transition-colors">
          <Package className="w-6 h-6 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Semua Pesanan</span>
        </Link>
        <Link href="/notifications" className="relative bg-white hover:bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 text-center transition-colors">
          {unreadNotifs > 0 && (
            <span className="absolute top-3 right-3 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadNotifs}
            </span>
          )}
          <Bell className="w-6 h-6 text-orange-500" />
          <span className="text-sm font-medium text-gray-700">Notifikasi</span>
        </Link>
        <Link href="/track" className="bg-white hover:bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 text-center transition-colors">
          <Truck className="w-6 h-6 text-indigo-600" />
          <span className="text-sm font-medium text-gray-700">Lacak Paket</span>
        </Link>
      </div>
    </div>
  )
}
