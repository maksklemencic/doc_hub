import { useState, useCallback } from 'react'
import { Tab } from '@/components/shared/tab-bar'

interface UseTabStateProps {
  initialTabs?: Tab[]
}

/**
 * Reusable hook for managing a single pane's tab state
 * Handles tab operations: click, close, reorder, add/remove
 */
export function useTabState({ initialTabs = [] }: UseTabStateProps = {}) {
  const [tabs, setTabs] = useState<Tab[]>(initialTabs)

  /**
   * Activate a specific tab by ID
   */
  const activateTab = useCallback((tabId: string) => {
    setTabs(currentTabs =>
      currentTabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId
      }))
    )
  }, [])

  /**
   * Close a tab by ID
   * If the closed tab was active, activate the last remaining tab
   */
  const closeTab = useCallback((tabId: string) => {
    setTabs(currentTabs => {
      const tab = currentTabs.find(t => t.id === tabId)

      // Don't close non-closable tabs
      if (tab?.closable === false) {
        return currentTabs
      }

      const newTabs = currentTabs.filter(tab => tab.id !== tabId)

      // If the closed tab was active and there are remaining tabs, activate the last one
      if (newTabs.length > 0 && currentTabs.find(t => t.id === tabId)?.isActive) {
        newTabs[newTabs.length - 1].isActive = true
      }

      return newTabs
    })
  }, [])

  /**
   * Reorder a tab to a new index position
   */
  const reorderTab = useCallback((tabId: string, newIndex: number) => {
    setTabs(currentTabs => {
      const currentIndex = currentTabs.findIndex(t => t.id === tabId)
      if (currentIndex === -1) return currentTabs

      const newTabs = [...currentTabs]
      const [removed] = newTabs.splice(currentIndex, 1)
      newTabs.splice(newIndex, 0, removed)

      return newTabs
    })
  }, [])

  /**
   * Add a new tab, deactivating all others
   */
  const addTab = useCallback((newTab: Tab) => {
    setTabs(currentTabs => [
      ...currentTabs.map(t => ({ ...t, isActive: false })),
      { ...newTab, isActive: true }
    ])
  }, [])

  /**
   * Remove a tab by ID (without activation logic, for cleanup purposes)
   */
  const removeTab = useCallback((tabId: string) => {
    setTabs(currentTabs => currentTabs.filter(t => t.id !== tabId))
  }, [])

  /**
   * Replace or activate an existing tab
   * If tab exists, activate it. Otherwise, add it as new.
   */
  const upsertTab = useCallback((tab: Tab) => {
    setTabs(currentTabs => {
      const existingIndex = currentTabs.findIndex(t => t.id === tab.id)

      if (existingIndex !== -1) {
        // Tab exists - just activate it
        return currentTabs.map(t => ({
          ...t,
          isActive: t.id === tab.id
        }))
      } else {
        // Tab doesn't exist - add it
        return [
          ...currentTabs.map(t => ({ ...t, isActive: false })),
          { ...tab, isActive: true }
        ]
      }
    })
  }, [])

  /**
   * Update a specific tab (useful for setting initialMessage on chat tabs)
   */
  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs(currentTabs =>
      currentTabs.map(tab =>
        tab.id === tabId ? { ...tab, ...updates } : tab
      )
    )
  }, [])

  /**
   * Get the currently active tab
   */
  const getActiveTab = useCallback(() => {
    return tabs.find(t => t.isActive)
  }, [tabs])

  /**
   * Check if a tab exists
   */
  const hasTab = useCallback((tabId: string) => {
    return tabs.some(t => t.id === tabId)
  }, [tabs])

  /**
   * Clear all tabs
   */
  const clearTabs = useCallback(() => {
    setTabs([])
  }, [])

  /**
   * Replace all tabs with a new set
   */
  const replaceTabs = useCallback((newTabs: Tab[]) => {
    setTabs(newTabs)
  }, [])

  return {
    tabs,
    setTabs,
    activateTab,
    closeTab,
    reorderTab,
    addTab,
    removeTab,
    upsertTab,
    updateTab,
    getActiveTab,
    hasTab,
    clearTabs,
    replaceTabs,
  }
}
