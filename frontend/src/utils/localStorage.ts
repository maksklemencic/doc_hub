/**
 * Utility functions for persisting space-specific data in localStorage
 */

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
      const item = localStorage.getItem(fullKey)

      if (item === null) {
        return null
      }

      return JSON.parse(item)
    } catch (error) {
      console.warn(`Failed to parse localStorage for ${spaceId}:${key}`, error)

      // Clean up corrupted data
      try {
        const fullKey = `${this.PREFIX}${spaceId}:${key}`
        localStorage.removeItem(fullKey)
      } catch (cleanupError) {
        console.warn('Failed to clean up corrupted localStorage data', cleanupError)
      }

      return null
    }
  }

  /**
   * Set a value in localStorage for a specific space
   * @param spaceId - The space identifier
   * @param key - The storage key within the space
   * @param value - The value to store
   */
  static set<T>(spaceId: string, key: string, value: T): void {
    try {
      const fullKey = `${this.PREFIX}${spaceId}:${key}`
      localStorage.setItem(fullKey, JSON.stringify(value))
    } catch (error) {
      console.error(`Failed to save to localStorage for ${spaceId}:${key}`, error)
      throw error
    }
  }

  /**
   * Remove a value from localStorage for a specific space
   * @param spaceId - The space identifier
   * @param key - The storage key within the space
   */
  static remove(spaceId: string, key: string): void {
    try {
      const fullKey = `${this.PREFIX}${spaceId}:${key}`
      localStorage.removeItem(fullKey)
    } catch (error) {
      console.error(`Failed to remove from localStorage for ${spaceId}:${key}`, error)
    }
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
