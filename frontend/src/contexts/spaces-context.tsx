'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { SpaceResponse } from '@/lib/api'
import { useSpaces } from '@/hooks/use-spaces'

interface SpacesContextType {
  spaces: SpaceResponse[]
  isLoading: boolean
  error: any
  getSpaceById: (id: string) => SpaceResponse | undefined
  getSpaceContext: (spaceId: string) => string[]
  setSpaceContext: (spaceId: string, documentIds: string[]) => void
  addToSpaceContext: (spaceId: string, documentIds: string[]) => void
  removeFromSpaceContext: (spaceId: string, documentIds: string[]) => void
}

const SpacesContext = createContext<SpacesContextType | undefined>(undefined)

interface SpacesProviderProps {
  children: React.ReactNode
}

export function SpacesProvider({ children }: SpacesProviderProps) {
  const { data: spaces = [], isLoading, error } = useSpaces()

  // Store selected document IDs per space - empty array means "all documents"
  const [spaceContexts, setSpaceContexts] = useState<Record<string, string[]>>({})

  const getSpaceById = (id: string): SpaceResponse | undefined => {
    return spaces.find(space => space.id === id)
  }

  const getSpaceContext = useCallback((spaceId: string): string[] => {
    return spaceContexts[spaceId] || []
  }, [spaceContexts])

  const setSpaceContext = useCallback((spaceId: string, documentIds: string[]) => {
    setSpaceContexts(prev => ({
      ...prev,
      [spaceId]: documentIds
    }))
  }, [])

  const addToSpaceContext = useCallback((spaceId: string, documentIds: string[]) => {
    setSpaceContexts(prev => {
      const current = prev[spaceId] || []
      const newSet = new Set([...current, ...documentIds])
      return {
        ...prev,
        [spaceId]: Array.from(newSet)
      }
    })
  }, [])

  const removeFromSpaceContext = useCallback((spaceId: string, documentIds: string[]) => {
    setSpaceContexts(prev => {
      const current = prev[spaceId] || []
      const idsToRemove = new Set(documentIds)
      return {
        ...prev,
        [spaceId]: current.filter(id => !idsToRemove.has(id))
      }
    })
  }, [])

  return (
    <SpacesContext.Provider value={{
      spaces,
      isLoading,
      error,
      getSpaceById,
      getSpaceContext,
      setSpaceContext,
      addToSpaceContext,
      removeFromSpaceContext
    }}>
      {children}
    </SpacesContext.Provider>
  )
}

export function useSpacesContext(): SpacesContextType {
  const context = useContext(SpacesContext)
  if (context === undefined) {
    throw new Error('useSpacesContext must be used within a SpacesProvider')
  }
  return context
}