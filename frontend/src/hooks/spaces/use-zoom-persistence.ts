import { useState, useEffect, useMemo, useCallback } from 'react'
import { SpaceStorage } from '@/utils/local-storage'

interface ZoomState {
  scale: number
  isFitToWidth: boolean
}

interface UseZoomPersistenceProps {
  spaceId: string
}

export function useZoomPersistence({ spaceId }: UseZoomPersistenceProps) {
  // Zoom state persistence per TAB ID (not document ID)
  const [tabZoomStates, setTabZoomStates] = useState<Record<string, ZoomState>>({})

  // Load tab zoom states from localStorage on mount
  useEffect(() => {
    const storedZooms = SpaceStorage.get<Record<string, ZoomState>>(spaceId, 'tabZooms')
    if (storedZooms) {
      setTabZoomStates(storedZooms)
    }
  }, [spaceId])

  // Debounced save for tab zoom states
  const debouncedSaveZooms = useMemo(() => {
    let timeoutId: NodeJS.Timeout
    return () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        SpaceStorage.set(spaceId, 'tabZooms', tabZoomStates)
      }, 300)
    }
  }, [spaceId, tabZoomStates])

  useEffect(() => {
    debouncedSaveZooms()
  }, [tabZoomStates, debouncedSaveZooms])

  // Create stable callback for zoom state changes
  const handleZoomStateChange = useCallback((tabId: string, state: ZoomState) => {
    setTabZoomStates(prev => ({
      ...prev,
      [tabId]: state
    }))
  }, [])

  const getZoomState = useCallback((tabId: string): ZoomState | undefined => {
    return tabZoomStates[tabId]
  }, [tabZoomStates])

  return {
    tabZoomStates,
    handleZoomStateChange,
    getZoomState,
  }
}
