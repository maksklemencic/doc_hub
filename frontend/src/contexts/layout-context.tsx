'use client'

import { createContext, useContext, useReducer, ReactNode, useEffect } from 'react'
import { SpaceStorage } from '@/utils/local-storage'

type ViewMode = 'list' | 'grid'

interface LayoutState {
  [spaceId: string]: {
    viewMode: ViewMode
    gridColumns: number
  }
}

type LayoutAction =
  | { type: 'SET_VIEW_MODE'; payload: { spaceId: string; viewMode: ViewMode } }
  | { type: 'SET_GRID_COLUMNS'; payload: { spaceId: string; gridColumns: number } }
  | { type: 'HYDRATE'; payload: { spaceId: string; viewMode: ViewMode; gridColumns: number } }

interface LayoutContextType {
  setViewMode: (spaceId: string, viewMode: ViewMode) => void
  setGridColumns: (spaceId: string, gridColumns: number) => void
  getViewMode: (spaceId: string) => ViewMode
  getGridColumns: (spaceId: string) => number
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

const initialState: LayoutState = {}

function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case 'SET_VIEW_MODE':
      return {
        ...state,
        [action.payload.spaceId]: {
          ...state[action.payload.spaceId],
          viewMode: action.payload.viewMode,
        },
      }
    case 'SET_GRID_COLUMNS':
      return {
        ...state,
        [action.payload.spaceId]: {
          ...state[action.payload.spaceId],
          gridColumns: action.payload.gridColumns,
        },
      }
    case 'HYDRATE':
      return {
        ...state,
        [action.payload.spaceId]: {
          viewMode: action.payload.viewMode,
          gridColumns: action.payload.gridColumns,
        },
      }
    default:
      return state
  }
}

interface LayoutProviderProps {
  children: ReactNode
}

export function LayoutProvider({ children }: LayoutProviderProps) {
  const [state, dispatch] = useReducer(layoutReducer, initialState)

  const setViewMode = (spaceId: string, viewMode: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: { spaceId, viewMode } })
    // Persist to localStorage
    SpaceStorage.set(spaceId, 'viewMode', viewMode)
  }

  const setGridColumns = (spaceId: string, gridColumns: number) => {
    dispatch({ type: 'SET_GRID_COLUMNS', payload: { spaceId, gridColumns } })
    // Persist to localStorage
    SpaceStorage.set(spaceId, 'gridColumns', gridColumns)
  }

  const getViewMode = (spaceId: string): ViewMode => {
    // If state doesn't exist, get from localStorage (synchronous, no state updates)
    if (!state[spaceId]) {
      const viewMode = SpaceStorage.get<ViewMode>(spaceId, 'viewMode') ?? 'grid'
      return viewMode
    }
    return state[spaceId]?.viewMode ?? 'grid'
  }

  const getGridColumns = (spaceId: string): number => {
    // If state doesn't exist, get from localStorage (synchronous, no state updates)
    if (!state[spaceId]) {
      const gridColumns = SpaceStorage.get<number>(spaceId, 'gridColumns') ?? 4
      return gridColumns
    }
    return state[spaceId]?.gridColumns ?? 4
  }

  const value: LayoutContextType = {
    setViewMode,
    setGridColumns,
    getViewMode,
    getGridColumns,
  }

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayoutContext(): LayoutContextType {
  const context = useContext(LayoutContext)
  if (context === undefined) {
    throw new Error('useLayoutContext must be used within a LayoutProvider')
  }
  return context
}