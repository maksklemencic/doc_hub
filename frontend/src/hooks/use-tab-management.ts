import { useState, useCallback, useRef, useEffect } from 'react'

export interface TabItem {
  id: string
  title: string
  documentId?: string
}

export function useTabManagement() {
  const [tabs, setTabs] = useState<TabItem[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const tabsCreatedRef = useRef<Set<string>>(new Set())

  const openTab = useCallback((tab: TabItem) => {
    if (tabsCreatedRef.current.has(tab.id)) {
      setActiveTabId(tab.id)
      return
    }

    tabsCreatedRef.current.add(tab.id)

    setTabs((prevTabs) => {
      const exists = prevTabs.some((t) => t.id === tab.id)
      if (exists) {
        return prevTabs
      }
      return [...prevTabs, tab]
    })
    setActiveTabId(tab.id)
  }, [])

  const closeTab = useCallback((tabId: string) => {
    tabsCreatedRef.current.delete(tabId)

    setTabs((prevTabs) => {
      const tabIndex = prevTabs.findIndex((t) => t.id === tabId)
      const newTabs = prevTabs.filter((t) => t.id !== tabId)

      if (activeTabId === tabId && newTabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, newTabs.length - 1)
        setActiveTabId(newTabs[newActiveIndex].id)
      } else if (newTabs.length === 0) {
        setActiveTabId(null)
      }

      return newTabs
    })
  }, [activeTabId])

  const closeAllTabs = useCallback(() => {
    tabsCreatedRef.current.clear()
    setTabs([])
    setActiveTabId(null)
  }, [])

  const reorderTabs = useCallback((newTabs: TabItem[]) => {
    setTabs(newTabs)
  }, [])

  const getActiveTab = useCallback(() => {
    return tabs.find((tab) => tab.id === activeTabId)
  }, [tabs, activeTabId])

  return {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    closeAllTabs,
    setActiveTabId,
    reorderTabs,
    getActiveTab,
  }
}
