'use client'

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { User, AuthTokenResponse } from '@/types'
import { STORAGE_KEYS, ROUTES } from '@/constants'
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/utils/safe-storage'

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
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = safeGetItem<string>(STORAGE_KEYS.ACCESS_TOKEN, null)
      const user = safeGetItem<User>(STORAGE_KEYS.USER, null)

      dispatch({ type: 'HYDRATE', payload: { user, token } })
    }
  }, [])

  const login = (authResponse: AuthTokenResponse) => {
    if (typeof window !== 'undefined') {
      const tokenSaved = safeSetItem(STORAGE_KEYS.ACCESS_TOKEN, authResponse.access_token, {
        showToast: false, // Don't show toast on successful login
        retryWithCleanup: true,
      })
      const userSaved = safeSetItem(STORAGE_KEYS.USER, authResponse.user, {
        showToast: false,
        retryWithCleanup: true,
      })

      if (!tokenSaved || !userSaved) {
        console.error('Failed to save authentication data to storage')
        toast.error('Warning: Your session may not persist after closing the browser')
      }
    }
    dispatch({ type: 'LOGIN_SUCCESS', payload: authResponse })
  }

  const logout = () => {
    if (typeof window !== 'undefined') {
      safeRemoveItem(STORAGE_KEYS.ACCESS_TOKEN)
      safeRemoveItem(STORAGE_KEYS.USER)

      // Use sessionStorage for logout toast flag (doesn't use quota as much)
      try {
        sessionStorage.setItem('show_logout_toast', 'true')
      } catch {
        // Silently fail if sessionStorage is not available
      }
    }

    dispatch({ type: 'LOGOUT' })

    router.push(ROUTES.LANDING)
  }

  const setUser = (user: User) => {
    if (typeof window !== 'undefined') {
      safeSetItem(STORAGE_KEYS.USER, user, {
        showToast: false,
        retryWithCleanup: true,
      })
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