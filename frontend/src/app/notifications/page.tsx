'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { notificationAPI } from '@/lib/api'
import type { Notification } from '@/types'
import { Bell, Check, CheckCheck, Trash2, Package, Info, AlertCircle, XCircle } from 'lucide-react'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  success: <Check className="w-4 h-4 text-green-500" />,
  error: <XCircle className="w-4 h-4 text-red-500" />,
  warning: <AlertCircle className="w-4 h-4 text-yellow-500" />,
  info: <Info className="w-4 h-4 text-blue-500" />,
  order: <Package className="w-4 h-4 text-blue-500" />,
}

const TYPE_BG: Record<string, string> = {
  success: 'bg-green-50',
  error: 'bg-red-50',
  warning: 'bg-yellow-50',
  info: 'bg-blue-50',
  order: 'bg-blue-50',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await notificationAPI.getAll()
      setNotifications(res.data.notifications || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationAPI.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true)
    try {
      await notificationAPI.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setMarkingAll(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await notificationAPI.delete(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="max-w-3xl mx-auto space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            Notifikasi
            {unreadCount > 0 && (
              <span className="w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {notifications.length} notifikasi • {unreadCount} belum dibaca
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markingAll}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            {markingAll ? 'Memproses...' : 'Tandai semua dibaca'}
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48">
            <Bell className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">Tidak ada notifikasi</p>
            <p className="text-gray-400 text-sm mt-1">Notifikasi akan muncul di sini</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`flex gap-4 p-5 transition-colors ${
                  !notif.read ? 'bg-blue-50/30' : 'hover:bg-gray-50'
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_BG[notif.type] || 'bg-gray-50'}`}>
                  {TYPE_ICONS[notif.type] || <Bell className="w-4 h-4 text-gray-400" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${!notif.read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notif.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{notif.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-xs text-gray-400">
                          {new Date(notif.created_at).toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                        {notif.order_id && (
                          <Link
                            href={`/orders/${notif.order_id}`}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Lihat pesanan →
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notif.read && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Tandai dibaca"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notif.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Unread indicator */}
                {!notif.read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
