// Types for the Logistics System

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'admin' | 'courier';
  phone?: string;
  address?: string;
}

export interface Order {
  id: number;
  user_id: number;
  tracking_number: string;
  sender_name: string;
  sender_phone?: string;
  sender_address: string;
  sender_city: string;
  receiver_name: string;
  receiver_phone?: string;
  receiver_address: string;
  receiver_city: string;
  weight: number;
  description?: string;
  status: OrderStatus;
  price: number;
  service_type: ServiceType;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type ServiceType = 'economy' | 'regular' | 'express' | 'same_day';

export interface TrackingEvent {
  id: number;
  order_id: number;
  status: string;
  location: string;
  description: string;
  created_by: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'order';
  order_id?: number;
  read: boolean;
  created_at: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface OrderStats {
  pending: number;
  processing: number;
  shipped: number;
  in_transit: number;
  delivered: number;
  cancelled: number;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Menunggu Konfirmasi',
  processing: 'Sedang Diproses',
  shipped: 'Telah Dikirim',
  in_transit: 'Dalam Perjalanan',
  delivered: 'Telah Sampai',
  cancelled: 'Dibatalkan',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  in_transit: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  economy: 'Ekonomi',
  regular: 'Reguler',
  express: 'Express',
  same_day: 'Same Day',
};
