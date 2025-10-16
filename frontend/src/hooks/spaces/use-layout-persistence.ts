import { useCallback } from 'react'
import { useLayoutContext } from '@/contexts/layout-context'

type ViewMode = 'list' | 'grid'

interface UseLayoutPersistenceProps {
  spaceId: string
}

export function useLayoutPersistence({ spaceId }: UseLayoutPersistenceProps) {
  const { getViewMode, setViewMode, getGridColumns, setGridColumns: setContextGridColumns } = useLayoutContext()

  // Get current state from context
  const viewMode = getViewMode(spaceId)
  const gridColumns = getGridColumns(spaceId)

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
    const currentCols = getGridColumns(spaceId)
    if (currentCols !== cols) {
      setContextGridColumns(spaceId, cols)
    }
  }, [spaceId, getGridColumns, setContextGridColumns])

  return {
    viewMode,
    setViewMode: (mode: ViewMode) => setViewMode(spaceId, mode),
    gridColumns,
    handlePaneWidthChange, // Export callback for SplitPaneView
  }
}
