import axios, { AxiosResponse } from 'axios'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Create axios instance with interceptors
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for OCR operations
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_data')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Types
export interface MenuItem {
  id: string
  name: string
  description?: string
  price?: number
  category: string
  subcategory?: string
  available: boolean
  tags?: string[]
  image_url?: string
  allergens?: string[]
  nutritional_info?: any
  preparation_time?: number
  spice_level?: number
  alcohol_content?: number
  vintage?: number
  region?: string
  created_at: string
  updated_at: string
}

export interface MenuResponse {
  success: boolean
  data: MenuItem[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface User {
  id: string
  email: string
  name: string
  role: 'boss' | 'manager' | 'staff'
  active: boolean
  created_at: string
  last_login?: string
}

export interface AuthResponse {
  success: boolean
  data: {
    token: string
    user: User
  }
  message: string
}

export interface OCRResponse {
  success: boolean
  data?: {
    menuType: string
    itemsProcessed: number
    itemsSaved: number
    processingTimeMs: number
    items: MenuItem[]
  }
  message: string
  suggestions?: string[]
  extractedText?: string
}

// API Methods
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', { email, password })
    return response.data
  },

  logout: async (): Promise<void> => {
    const refreshToken = localStorage.getItem('refresh_token')
    await apiClient.post('/auth/logout', { refreshToken })
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_data')
  },

  getCurrentUser: async (): Promise<{ success: boolean; data: User }> => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },

  refreshToken: async (): Promise<AuthResponse> => {
    const refreshToken = localStorage.getItem('refresh_token')
    const response = await apiClient.post('/auth/refresh', { refreshToken })
    return response.data
  }
}

export const menuApi = {
  getMenuItems: async (
    category: string, 
    options: {
      limit?: number
      offset?: number
      search?: string
    } = {}
  ): Promise<MenuResponse> => {
    const params = new URLSearchParams()
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.offset) params.append('offset', options.offset.toString())
    if (options.search) params.append('search', options.search)

    const response = await apiClient.get(`/menu/${category}?${params.toString()}`)
    return response.data
  },

  getFeaturedItems: async (category: string): Promise<MenuResponse> => {
    const response = await apiClient.get(`/menu/${category}/featured`)
    return response.data
  },

  searchMenuItems: async (
    category: string, 
    query: string
  ): Promise<MenuResponse> => {
    const response = await apiClient.get(`/menu/${category}?search=${encodeURIComponent(query)}`)
    return response.data
  }
}

export const ocrApi = {
  processImage: async (file: File, menuType: string): Promise<OCRResponse> => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('menuType', menuType)

    const response = await apiClient.post('/ocr/process', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 2 minutes for OCR processing
    })
    return response.data
  },

  getStatus: async (): Promise<any> => {
    const response = await apiClient.get('/ocr/status')
    return response.data
  }
}

export const adminApi = {
  getAllMenuItems: async (
    category: string,
    options: {
      limit?: number
      offset?: number
    } = {}
  ): Promise<MenuResponse> => {
    const params = new URLSearchParams()
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.offset) params.append('offset', options.offset.toString())

    const response = await apiClient.get(`/admin/menu/${category}/all?${params.toString()}`)
    return response.data
  },

  updateMenuItem: async (id: string, updates: Partial<MenuItem>): Promise<{ success: boolean; data: MenuItem; message: string }> => {
    const response = await apiClient.put(`/admin/menu/item/${id}`, updates)
    return response.data
  },

  createMenuItem: async (item: Partial<MenuItem>): Promise<{ success: boolean; data: MenuItem; message: string }> => {
    const response = await apiClient.post('/admin/menu/item', item)
    return response.data
  },

  deleteMenuItem: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/admin/menu/item/${id}`)
    return response.data
  },

  getMenuHistory: async (options: {
    limit?: number
    offset?: number
    menu_type?: string
  } = {}): Promise<any> => {
    const params = new URLSearchParams()
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.offset) params.append('offset', options.offset.toString())
    if (options.menu_type) params.append('menu_type', options.menu_type)

    const response = await apiClient.get(`/admin/menu/history?${params.toString()}`)
    return response.data
  },

  getSystemStats: async (): Promise<any> => {
    const response = await apiClient.get('/admin/stats')
    return response.data
  }
}

// Health check
export const healthCheck = async (): Promise<any> => {
  const response = await apiClient.get('/health')
  return response.data
}

// Performance monitoring
let requestCount = 0
let totalResponseTime = 0

apiClient.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    const endTime = Date.now()
    const startTime = response.config.metadata?.startTime || endTime
    const responseTime = endTime - startTime
    
    requestCount++
    totalResponseTime += responseTime
    
    // Log slow requests in development
    if (import.meta.env.DEV && responseTime > 2000) {
      console.warn(`Slow API request: ${response.config.method?.toUpperCase()} ${response.config.url} took ${responseTime}ms`)
    }
    
    return response
  },
  (error) => {
    const endTime = Date.now()
    const startTime = error.config?.metadata?.startTime || endTime
    const responseTime = endTime - startTime
    
    console.error(`API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} failed after ${responseTime}ms`, error)
    
    return Promise.reject(error)
  }
)

// Export performance metrics
export const getAPIMetrics = () => ({
  requestCount,
  averageResponseTime: requestCount > 0 ? totalResponseTime / requestCount : 0,
  totalResponseTime
})

export default apiClient
