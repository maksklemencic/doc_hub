import { useState, useEffect, useCallback } from 'react'
import { SpaceStorage } from '@/utils/local-storage'

type ViewMode = 'list' | 'grid'

interface UseLayoutPersistenceProps {
  spaceId: string
}

export function useLayoutPersistence({ spaceId }: UseLayoutPersistenceProps) {
  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return SpaceStorage.get<ViewMode>(spaceId, 'viewMode') ?? 'grid'
  })

  // Grid columns state
  const [gridColumns, setGridColumns] = useState(4)

  // Callback to handle pane width changes from SplitPaneView
  const handlePaneWidthChange = useCallback((paneWidth: number) => {
    if (paneWidth <= 0) return

    // Account for padding: px-6 on the container = 24px each side = 48px total
    const padding = 48
    const availableWidth = paneWidth - padding

    // Card width: ~280px minimum with gaps
    const minCardWidth = 280
    const gap = 16 // gap-4 in tailwind = 16px

    // Calculate how many cards can fit
    let cols = Math.floor((availableWidth + gap) / (minCardWidth + gap))
    cols = Math.max(1, Math.min(4, cols)) // Between 1 and 4

    // Only update if different to avoid unnecessary re-renders
    setGridColumns(prevCols => prevCols === cols ? prevCols : cols)
  }, [])

  // Persist view mode changes
  useEffect(() => {
    SpaceStorage.set(spaceId, 'viewMode', viewMode)
  }, [spaceId, viewMode])

  return {
    viewMode,
    setViewMode,
    gridColumns,
    handlePaneWidthChange, // Export callback for SplitPaneView
  }
}
