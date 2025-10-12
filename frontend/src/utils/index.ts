import { STORAGE_KEYS } from '@/constants'
import { safeGetItem, safeSetItem, safeRemoveItem } from './safe-storage'

// Auth utilities
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return safeGetItem<string>(STORAGE_KEYS.ACCESS_TOKEN, null)
}

export const setAuthToken = (token: string): boolean => {
  if (typeof window === 'undefined') return false
  return safeSetItem(STORAGE_KEYS.ACCESS_TOKEN, token, {
    showToast: false, // Don't show toast for token operations
    retryWithCleanup: true,
  })
}

export const removeAuthToken = (): boolean => {
  if (typeof window === 'undefined') return false
  return safeRemoveItem(STORAGE_KEYS.ACCESS_TOKEN)
}

// File utilities
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2)
}

// Date utilities
export const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

export const formatRelativeTime = (date: string): string => {
  const now = new Date()
  const targetDate = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
  
  return formatDate(date)
}

// URL utilities
export const isValidUrl = (string: string): boolean => {
  try {
    new URL(string)
    return true
  } catch (_) {
    return false
  }
}

// Validation utilities
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}