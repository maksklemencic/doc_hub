'use client'

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { User, AuthTokenResponse } from '@/types'
import { STORAGE_KEYS } from '@/constants'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

type AuthAction =
  | { type: 'LOADING' }
  | { type: 'LOGIN_SUCCESS'; payload: AuthTokenResponse }
  | { type: 'LOGOUT' }
  | { type: 'SET_USER'; payload: User }
  | { type: 'HYDRATE'; payload: { user: User | null; token: string | null } }

interface AuthContextType extends AuthState {
  login: (authResponse: AuthTokenResponse) => void
  logout: () => void
  setUser: (user: User) => void
}

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, isLoading: true }
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.access_token,
        isLoading: false,
        isAuthenticated: true,
      }
    
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isLoading: false,
      }
    
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      }
    
    case 'HYDRATE':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
        isAuthenticated: !!action.payload.token,
      }
    
    default:
      return state
  }
}

const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Hydrate auth state from localStorage on client-side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if we're in development mode with auth bypass
      const devModeBypass = process.env.NEXT_PUBLIC_DEV_MODE_BYPASS_AUTH === 'true'
      
      if (devModeBypass) {
        // Auto-login with mock user in development mode
        const mockUser: User = {
          id: 'dev-user-123',
          email: 'dev@example.com',
          name: 'Dev User',
          picture: undefined,
          created_at: '2024-01-01T00:00:00.000Z' // Fixed date to avoid hydration mismatch
        }
        
        const mockAuthResponse: AuthTokenResponse = {
          access_token: 'dev-mock-token',
          token_type: 'Bearer',
          expires_in: 86400, // 24 hours
          user: mockUser
        }
        
        // Set mock data in localStorage
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, mockAuthResponse.access_token)
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(mockAuthResponse.user))
        
        // Set mock cookie
        document.cookie = `access_token=${mockAuthResponse.access_token}; path=/; max-age=${mockAuthResponse.expires_in}; SameSite=Lax`
        
        dispatch({ type: 'LOGIN_SUCCESS', payload: mockAuthResponse })
        return
      }
      
      // Normal flow - check localStorage
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
      const userData = localStorage.getItem(STORAGE_KEYS.USER)
      const user = userData ? JSON.parse(userData) : null

      dispatch({ type: 'HYDRATE', payload: { user, token } })
    }
  }, [])

  const login = (authResponse: AuthTokenResponse) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, authResponse.access_token)
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(authResponse.user))
      
      // Also set cookie for middleware
      document.cookie = `access_token=${authResponse.access_token}; path=/; max-age=${authResponse.expires_in}; SameSite=Lax`
    }
    dispatch({ type: 'LOGIN_SUCCESS', payload: authResponse })
  }

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
      localStorage.removeItem(STORAGE_KEYS.USER)
      
      // Remove cookie
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
    dispatch({ type: 'LOGOUT' })
  }

  const setUser = (user: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
    }
    dispatch({ type: 'SET_USER', payload: user })
  }

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    setUser,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}