import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor - attach JWT token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ============================================================
// AUTH API
// ============================================================
export const authAPI = {
  register: (data: {
    name: string;
    email: string;
    password: string;
    role?: string;
    phone?: string;
    address?: string;
  }) => api.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  getProfile: () => api.get('/api/profile'),

  updateProfile: (data: { name?: string; phone?: string; address?: string }) =>
    api.put('/api/profile', data),
};

// ============================================================
// ORDER API
// ============================================================
export const orderAPI = {
  create: (data: {
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
    service_type?: string;
    notes?: string;
  }) => api.post('/api/orders', data),

  getAll: (status?: string) =>
    api.get('/api/orders', { params: status ? { status } : {} }),

  getById: (id: number) => api.get(`/api/orders/${id}`),

  getStats: () => api.get('/api/orders/stats'),

  updateStatus: (id: number, status: string) =>
    api.put(`/api/orders/${id}/status`, { status }),

  delete: (id: number) => api.delete(`/api/orders/${id}`),

  getByTracking: (tracking: string) =>
    api.get(`/orders/tracking/${tracking}`),
};

// ============================================================
// TRACKING API
// ============================================================
export const trackingAPI = {
  getByOrderId: (orderId: number) =>
    api.get(`/api/tracking/${orderId}`),

  getByOrderIdPublic: (orderId: number) =>
    api.get(`/tracking/${orderId}`),

  addEvent: (data: {
    order_id: number;
    status: string;
    location?: string;
    description?: string;
  }) => api.post('/api/tracking', data),
};

// ============================================================
// NOTIFICATION API
// ============================================================
export const notificationAPI = {
  getAll: () => api.get('/api/notifications'),

  markAsRead: (id: number) =>
    api.put(`/api/notifications/${id}/read`, {}),

  markAllAsRead: () =>
    api.put('/api/notifications/read-all', {}),

  delete: (id: number) =>
    api.delete(`/api/notifications/${id}`),
};

// ============================================================
// AUTH HELPERS
// ============================================================
export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

export const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const storeAuth = (token: string, user: object) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};
