import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, User } from '../services/api'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()()
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await authApi.login(email, password)
          
          if (response.success) {
            const { token, user } = response.data
            
            // Store in localStorage for API client
            localStorage.setItem('auth_token', token)
            localStorage.setItem('user_data', JSON.stringify(user))
            
            set({ 
              user, 
              token, 
              isLoading: false, 
              error: null 
            })
          } else {
            throw new Error('Login failed')
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || error.message || 'Login failed'
          set({ 
            error: errorMessage, 
            isLoading: false,
            user: null,
            token: null
          })
          throw error
        }
      },

      logout: async () => {
        try {
          await authApi.logout()
        } catch (error) {
          console.warn('Logout request failed:', error)
        }
        
        // Clear all auth data
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_data')
        localStorage.removeItem('refresh_token')
        
        set({ 
          user: null, 
          token: null, 
          error: null,
          isLoading: false
        })
      },

      checkAuth: async () => {
        const token = localStorage.getItem('auth_token')
        const userData = localStorage.getItem('user_data')
        
        if (!token || !userData) {
          set({ user: null, token: null })
          return
        }
        
        try {
          set({ isLoading: true })
          
          // Verify token with server
          const response = await authApi.getCurrentUser()
          
          if (response.success) {
            set({ 
              user: response.data, 
              token, 
              isLoading: false,
              error: null
            })
          } else {
            throw new Error('Token validation failed')
          }
        } catch (error: any) {
          console.warn('Auth check failed:', error)
          
          // Clear invalid auth data
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_data')
          localStorage.removeItem('refresh_token')
          
          set({ 
            user: null, 
            token: null, 
            isLoading: false,
            error: null
          })
        }
      },

      clearError: () => {
        set({ error: null })
      }
    }),
    {
      name: 'table1837-auth',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token 
      }),
      // Only persist non-sensitive data
      storage: {
        getItem: (name: string) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          
          try {
            const parsed = JSON.parse(str)
            // Validate stored data structure
            if (parsed.state && typeof parsed.state === 'object') {
              return parsed
            }
          } catch (e) {
            console.warn('Invalid stored auth data:', e)
          }
          
          return null
        },
        setItem: (name: string, value: string) => {
          localStorage.setItem(name, value)
        },
        removeItem: (name: string) => {
          localStorage.removeItem(name)
        }
      }
    }
  )
)

// Auto-check auth on store creation
if (typeof window !== 'undefined') {
  useAuthStore.getState().checkAuth()
}
