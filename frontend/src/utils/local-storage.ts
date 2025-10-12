/**
 * Utility functions for persisting space-specific data in localStorage
 */

import { safeGetItem, safeSetItem, safeRemoveItem } from './safe-storage'

export class SpaceStorage {
  private static PREFIX = 'space:'

  /**
   * Get a value from localStorage for a specific space
   * @param spaceId - The space identifier
   * @param key - The storage key within the space
   * @returns The stored value or null if not found
   */
  static get<T>(spaceId: string, key: string): T | null {
    try {
      const fullKey = `${this.PREFIX}${spaceId}:${key}`
      const item = safeGetItem<any>(fullKey, null)

      if (item === null) {
        return null
      }

      // Handle both new format (with timestamp) and old format (direct value)
      if (item && typeof item === 'object' && 'data' in item && 'timestamp' in item) {
        return item.data as T
      }

      // Legacy format - return as is
      return item as T
    } catch (error) {
      console.warn(`Failed to parse localStorage for ${spaceId}:${key}`, error)

      // Clean up corrupted data
      const fullKey = `${this.PREFIX}${spaceId}:${key}`
      safeRemoveItem(fullKey)

      return null
    }
  }

  /**
   * Set a value in localStorage for a specific space
   * @param spaceId - The space identifier
   * @param key - The storage key within the space
   * @param value - The value to store
   * @returns True if successful, false otherwise
   */
  static set<T>(spaceId: string, key: string, value: T): boolean {
    const fullKey = `${this.PREFIX}${spaceId}:${key}`

    // Add timestamp for cleanup purposes
    const dataWithTimestamp = {
      data: value,
      timestamp: Date.now(),
    }

    const success = safeSetItem(fullKey, dataWithTimestamp, {
      showToast: true,
      retryWithCleanup: true,
    })

    if (!success) {
      console.error(`Failed to save to localStorage for ${spaceId}:${key}`)
    }

    return success
  }

  /**
   * Remove a value from localStorage for a specific space
   * @param spaceId - The space identifier
   * @param key - The storage key within the space
   * @returns True if successful, false otherwise
   */
  static remove(spaceId: string, key: string): boolean {
    const fullKey = `${this.PREFIX}${spaceId}:${key}`
    const success = safeRemoveItem(fullKey)

    if (!success) {
      console.error(`Failed to remove from localStorage for ${spaceId}:${key}`)
    }

    return success
  }

  /**
   * Check if a key exists in localStorage for a specific space
   * @param spaceId - The space identifier
   * @param key - The storage key within the space
   * @returns True if the key exists
   */
  static exists(spaceId: string, key: string): boolean {
    try {
      const fullKey = `${this.PREFIX}${spaceId}:${key}`
      return localStorage.getItem(fullKey) !== null
    } catch (error) {
      return false
    }
  }

  /**
   * Get all stored keys for a specific space (for debugging/cleanup)
   * @param spaceId - The space identifier
   * @returns Array of keys
   */
  static getAllKeys(spaceId: string): string[] {
    try {
      const keys: string[] = []
      const prefix = `${this.PREFIX}${spaceId}:`

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(prefix)) {
          keys.push(key.substring(prefix.length))
        }
      }

      return keys
    } catch (error) {
      console.error('Failed to enumerate localStorage keys', error)
      return []
    }
  }
}
