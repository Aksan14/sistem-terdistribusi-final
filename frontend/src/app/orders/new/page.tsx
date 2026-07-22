'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { orderAPI } from '@/lib/api'
import { ArrowLeft, Package, MapPin, Weight, FileText, Truck, Info } from 'lucide-react'

const SERVICE_OPTIONS = [
  { value: 'economy', label: 'Ekonomi', desc: 'Estimasi 5-7 hari kerja', multiplier: 0.8 },
  { value: 'regular', label: 'Reguler', desc: 'Estimasi 3-5 hari kerja', multiplier: 1.0 },
  { value: 'express', label: 'Express', desc: 'Estimasi 1-2 hari kerja', multiplier: 2.5 },
  { value: 'same_day', label: 'Same Day', desc: 'Pengiriman di hari yang sama', multiplier: 4.0 },
]

function calculateEstimatedPrice(weight: number, serviceType: string): number {
  const option = SERVICE_OPTIONS.find(s => s.value === serviceType)
  const multiplier = option?.multiplier || 1.0
  const base = Math.max(10000, (weight / 100) * 5000)
  return base * multiplier
}

export default function NewOrderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    sender_name: '',
    sender_phone: '',
    sender_address: '',
    sender_city: '',
    receiver_name: '',
    receiver_phone: '',
    receiver_address: '',
    receiver_city: '',
    weight: '',
    description: '',
    service_type: 'regular',
    notes: '',
  })

  const estimatedPrice = form.weight
    ? calculateEstimatedPrice(Number(form.weight), form.service_type)
    : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        ...form,
        weight: Number(form.weight),
      }
      const res = await orderAPI.create(payload)
      const orderId = res.data.order?.id
      router.push(`/orders/${orderId}`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setError(error.response?.data?.error || 'Gagal membuat pesanan, coba lagi')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 text-sm"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5"

  return (
    <div className="max-w-4xl mx-auto space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/orders" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Buat Pesanan Baru</h1>
          <p className="text-sm text-gray-500 mt-0.5">Isi detail pengiriman dengan lengkap</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <Info className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Sender */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <MapPin className="w-3 h-3 text-blue-600" />
              </div>
              Informasi Pengirim
            </h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nama Pengirim *</label>
                <input
                  type="text"
                  value={form.sender_name}
                  onChange={e => setForm({ ...form, sender_name: e.target.value })}
                  className={inputClass}
                  placeholder="Nama lengkap pengirim"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>No. HP Pengirim</label>
                <input
                  type="tel"
                  value={form.sender_phone}
                  onChange={e => setForm({ ...form, sender_phone: e.target.value })}
                  className={inputClass}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div>
                <label className={labelClass}>Kota Asal *</label>
                <input
                  type="text"
                  value={form.sender_city}
                  onChange={e => setForm({ ...form, sender_city: e.target.value })}
                  className={inputClass}
                  placeholder="Jakarta, Bandung, Surabaya..."
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Alamat Pengirim *</label>
                <textarea
                  value={form.sender_address}
                  onChange={e => setForm({ ...form, sender_address: e.target.value })}
                  className={inputClass + ' resize-none'}
                  placeholder="Alamat lengkap pengirim"
                  rows={3}
                  required
                />
              </div>
            </div>
          </div>

          {/* Receiver */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <MapPin className="w-3 h-3 text-green-600" />
              </div>
              Informasi Penerima
            </h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nama Penerima *</label>
                <input
                  type="text"
                  value={form.receiver_name}
                  onChange={e => setForm({ ...form, receiver_name: e.target.value })}
                  className={inputClass}
                  placeholder="Nama lengkap penerima"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>No. HP Penerima</label>
                <input
                  type="tel"
                  value={form.receiver_phone}
                  onChange={e => setForm({ ...form, receiver_phone: e.target.value })}
                  className={inputClass}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div>
                <label className={labelClass}>Kota Tujuan *</label>
                <input
                  type="text"
                  value={form.receiver_city}
                  onChange={e => setForm({ ...form, receiver_city: e.target.value })}
                  className={inputClass}
                  placeholder="Jakarta, Bandung, Surabaya..."
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Alamat Penerima *</label>
                <textarea
                  value={form.receiver_address}
                  onChange={e => setForm({ ...form, receiver_address: e.target.value })}
                  className={inputClass + ' resize-none'}
                  placeholder="Alamat lengkap penerima"
                  rows={3}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Package Details */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
              <Package className="w-3 h-3 text-purple-600" />
            </div>
            Detail Paket
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Berat Paket (gram) *
              </label>
              <div className="relative">
                <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  value={form.weight}
                  onChange={e => setForm({ ...form, weight: e.target.value })}
                  className={inputClass + ' pl-10'}
                  placeholder="500"
                  min="1"
                  step="1"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Masukkan berat dalam gram</p>
            </div>
            <div>
              <label className={labelClass}>Deskripsi Paket</label>
              <div className="relative">
                <FileText className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className={inputClass + ' pl-10'}
                  placeholder="Elektronik, pakaian, makanan..."
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className={labelClass}>Catatan Tambahan</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className={inputClass + ' resize-none'}
              placeholder="Instruksi khusus untuk kurir..."
              rows={2}
            />
          </div>
        </div>

        {/* Service Type */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
              <Truck className="w-3 h-3 text-orange-600" />
            </div>
            Jenis Layanan
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SERVICE_OPTIONS.map(service => (
              <label
                key={service.value}
                className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all ${
                  form.service_type === service.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="service_type"
                  value={service.value}
                  checked={form.service_type === service.value}
                  onChange={e => setForm({ ...form, service_type: e.target.value })}
                  className="sr-only"
                />
                <p className="font-semibold text-gray-800 text-sm">{service.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{service.desc}</p>
                {form.weight && (
                  <p className="text-xs font-semibold text-blue-600 mt-1.5">
                    Rp {calculateEstimatedPrice(Number(form.weight), service.value).toLocaleString('id-ID')}
                  </p>
                )}
                {form.service_type === service.value && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M3.707 5.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L5 6.586 3.707 5.293z"/>
                    </svg>
                  </div>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Estimasi biaya pengiriman</p>
              <p className="text-2xl font-bold text-gray-800 mt-0.5">
                {estimatedPrice > 0
                  ? `Rp ${estimatedPrice.toLocaleString('id-ID')}`
                  : '-'}
              </p>
              {form.weight && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {form.weight}g × layanan {form.service_type}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Link
                href="/orders"
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium transition-colors"
              >
                Batal
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Membuat...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    Buat Pesanan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
