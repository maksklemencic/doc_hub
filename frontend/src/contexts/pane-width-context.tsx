'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

interface PaneWidthState {
  leftWidth: number        // Left pane width (always available)
  rightWidth: number       // Right pane width (0 if not split)
  isSplit: boolean         // Whether in split mode
  mode: 'left-only' | 'split' // Pane mode
}

interface PaneWidthContextValue extends PaneWidthState {
  updateSplitterWidths: (left: number, right: number, isSplit: boolean) => void
  requestRecalculation: () => void
}

const PaneWidthContext = createContext<PaneWidthContextValue | null>(null)

export const usePaneWidthContext = () => {
  const context = useContext(PaneWidthContext)
  if (!context) {
    throw new Error('usePaneWidthContext must be used within a PaneWidthProvider')
  }
  return context
}

interface PaneWidthProviderProps {
  children: React.ReactNode
}

export function PaneWidthProvider({ children }: PaneWidthProviderProps) {
  const [state, setState] = useState<PaneWidthState>({
    leftWidth: 0,
    rightWidth: 0,
    isSplit: false,
    mode: 'left-only'
  })

  // Track if recalculation is requested
  const recalcRequestedRef = useRef(false)

  const updateSplitterWidths = useCallback((left: number, right: number, isSplit: boolean) => {
    setState({
      leftWidth: Math.round(left),
      rightWidth: Math.round(right),
      isSplit,
      mode: isSplit ? 'split' : 'left-only'
    })
    recalcRequestedRef.current = false
  }, [])

  const requestRecalculation = useCallback(() => {
    recalcRequestedRef.current = true
  }, [])

  const value = {
    ...state,
    updateSplitterWidths,
    requestRecalculation
  }

  return (
    <PaneWidthContext.Provider value={value}>
      {children}
    </PaneWidthContext.Provider>
  )
}
