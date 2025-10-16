/**
 * Safe localStorage wrapper with quota error handling and automatic cleanup
 */

import toast from 'react-hot-toast'
import { storageLogger } from '@/utils/logger'

export enum StorageErrorType {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  UNKNOWN = 'UNKNOWN',
}

export interface StorageError {
  type: StorageErrorType
  message: string
  originalError?: Error
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const testKey = '__storage_test__'
    localStorage.setItem(testKey, 'test')
    localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/**
 * Get estimated storage quota usage (in bytes)
 * Returns approximate size of all localStorage data
 */
export function getStorageSize(): number {
  if (!isStorageAvailable()) return 0

  try {
    let totalSize = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        // Estimate: each character is ~2 bytes in UTF-16
        totalSize += (key.length + (value?.length || 0)) * 2
      }
    }
    return totalSize
  } catch {
    return 0
  }
}

/**
 * Get storage quota usage as human-readable string
 */
export function getStorageSizeFormatted(): string {
  const bytes = getStorageSize()
  const mb = bytes / (1024 * 1024)

  if (mb < 1) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }
  return `${mb.toFixed(2)} MB`
}

/**
 * Clean up old space-specific data to free up storage
 * Removes the oldest space data based on key timestamps
 */
export function cleanupOldSpaceData(): number {
  if (!isStorageAvailable()) return 0

  try {
    const spaceKeys: Array<{ key: string; timestamp: number; size: number }> = []
    const prefix = 'space:'

    // Find all space-related keys and estimate their sizes
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const value = localStorage.getItem(key)
        const size = (key.length + (value?.length || 0)) * 2

        // Try to extract timestamp from stored data
        let timestamp = 0
        try {
          if (value) {
            const parsed = JSON.parse(value)
            timestamp = parsed.timestamp || 0
          }
        } catch {
          // If parsing fails, use 0 (will be removed first)
        }

        spaceKeys.push({ key, timestamp, size })
      }
    }

    // Sort by timestamp (oldest first)
    spaceKeys.sort((a, b) => a.timestamp - b.timestamp)

    // Remove oldest 25% of space data
    const removeCount = Math.max(1, Math.floor(spaceKeys.length * 0.25))
    let freedBytes = 0

    for (let i = 0; i < removeCount && i < spaceKeys.length; i++) {
      try {
        localStorage.removeItem(spaceKeys[i].key)
        freedBytes += spaceKeys[i].size
      } catch {
        // Continue trying to remove other items
      }
    }

    return freedBytes
  } catch {
    return 0
  }
}

/**
 * Detect the type of storage error
 */
function detectStorageError(error: unknown): StorageError {
  if (!error) {
    return {
      type: StorageErrorType.UNKNOWN,
      message: 'Unknown storage error',
    }
  }

  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorName = error instanceof Error ? error.name : ''

  // Check for quota exceeded errors (various browser implementations)
  const quotaPatterns = [
    /quota.*exceed/i,
    /storage.*full/i,
    /not enough.*space/i,
    /QuotaExceededError/i,
    /NS_ERROR_DOM_QUOTA_REACHED/i,
  ]

  if (quotaPatterns.some((pattern) => pattern.test(errorMessage) || pattern.test(errorName))) {
    return {
      type: StorageErrorType.QUOTA_EXCEEDED,
      message: 'Storage quota exceeded',
      originalError: error instanceof Error ? error : undefined,
    }
  }

  // Check for localStorage not available
  if (errorMessage.includes('not available') || errorMessage.includes('not supported')) {
    return {
      type: StorageErrorType.NOT_AVAILABLE,
      message: 'localStorage is not available',
      originalError: error instanceof Error ? error : undefined,
    }
  }

  return {
    type: StorageErrorType.UNKNOWN,
    message: errorMessage,
    originalError: error instanceof Error ? error : undefined,
  }
}

/**
 * Safely set an item in localStorage with quota error handling
 * @param key - The storage key
 * @param value - The value to store (will be JSON stringified)
 * @param options - Configuration options
 * @returns True if successful, false otherwise
 */
export function safeSetItem(
  key: string,
  value: any,
  options: {
    showToast?: boolean
    retryWithCleanup?: boolean
  } = {}
): boolean {
  const { showToast = true, retryWithCleanup = true } = options

  if (!isStorageAvailable()) {
    if (showToast) {
      toast.error('Storage is not available in this browser')
    }
    return false
  }

  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(key, stringValue)
    return true
  } catch (error) {
    const storageError = detectStorageError(error)

    storageLogger.warn(`Failed to save to localStorage (${key})`, storageError, { action: 'setItem', key })

    // Handle quota exceeded errors
    if (storageError.type === StorageErrorType.QUOTA_EXCEEDED && retryWithCleanup) {
      const freedBytes = cleanupOldSpaceData()

      if (freedBytes > 0) {
        storageLogger.info(`Freed ${(freedBytes / 1024).toFixed(2)} KB of storage. Retrying...`, null, { action: 'cleanup', freedBytes })

        // Retry once after cleanup
        try {
          const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
          localStorage.setItem(key, stringValue)

          if (showToast) {
            toast.success('Storage cleaned up automatically')
          }
          return true
        } catch (retryError) {
          storageLogger.error('Retry failed after cleanup:', retryError, { action: 'setItem', key, retry: true })
        }
      }

      // Show user-friendly error message
      if (showToast) {
        toast.error(
          `Storage is full (${getStorageSizeFormatted()}). Some settings may not be saved.`,
          { duration: 5000 }
        )
      }
    } else if (storageError.type === StorageErrorType.NOT_AVAILABLE && showToast) {
      toast.error('Storage is not available in this browser')
    } else if (showToast) {
      toast.error('Failed to save settings. Please try again.')
    }

    return false
  }
}

/**
 * Safely get an item from localStorage
 * @param key - The storage key
 * @param defaultValue - Default value if key doesn't exist or parsing fails
 * @returns The parsed value or default value
 */
export function safeGetItem<T = any>(key: string, defaultValue: T | null = null): T | null {
  if (!isStorageAvailable()) {
    return defaultValue
  }

  try {
    const item = localStorage.getItem(key)

    if (item === null) {
      return defaultValue
    }

    // Try to parse as JSON
    try {
      return JSON.parse(item)
    } catch {
      // If not JSON, return as string
      return item as unknown as T
    }
  } catch (error) {
    storageLogger.warn(`Failed to read from localStorage (${key})`, error, { action: 'getItem', key })
    return defaultValue
  }
}

/**
 * Safely remove an item from localStorage
 * @param key - The storage key
 * @returns True if successful, false otherwise
 */
export function safeRemoveItem(key: string): boolean {
  if (!isStorageAvailable()) {
    return false
  }

  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    storageLogger.warn(`Failed to remove from localStorage (${key})`, error, { action: 'removeItem', key })
    return false
  }
}

/**
 * Safely clear all localStorage data
 * @returns True if successful, false otherwise
 */
export function safeClear(): boolean {
  if (!isStorageAvailable()) {
    return false
  }

  try {
    localStorage.clear()
    return true
  } catch (error) {
    storageLogger.warn('Failed to clear localStorage:', error, { action: 'clear' })
    return false
  }
}

/**
 * Check if storage is approaching quota limit (>80% full)
 * Note: This is an estimate based on typical browser limits (5-10MB)
 */
export function isStorageNearQuota(): boolean {
  const currentSize = getStorageSize()
  const estimatedQuota = 5 * 1024 * 1024 // 5MB typical minimum
  return currentSize > estimatedQuota * 0.8
}

/**
 * Log storage usage for debugging
 */
export function logStorageUsage(): void {
  if (!isStorageAvailable()) {
    storageLogger.info('localStorage is not available', null, { action: 'logUsage' })
    return
  }

  const size = getStorageSize()
  const formatted = getStorageSizeFormatted()
  const itemCount = localStorage.length

  storageLogger.info('=== localStorage Usage ===', null, { action: 'logUsage' })
  storageLogger.info(`Total size: ${formatted} (${size} bytes)`, { size, formatted, itemCount }, { action: 'logUsage' })
  storageLogger.info(`Item count: ${itemCount}`, { itemCount }, { action: 'logUsage' })
  storageLogger.info(`Near quota: ${isStorageNearQuota() ? 'Yes' : 'No'}`, { nearQuota: isStorageNearQuota() }, { action: 'logUsage' })

  // Show top 10 largest items
  const items: Array<{ key: string; size: number }> = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      const value = localStorage.getItem(key)
      const size = (key.length + (value?.length || 0)) * 2
      items.push({ key, size })
    }
  }

  items.sort((a, b) => b.size - a.size)
  storageLogger.info('Top 10 largest items:', items.slice(0, 10), { action: 'logUsage' })
}
