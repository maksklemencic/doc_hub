'use client'

import React, { createContext, useContext } from 'react'
import { SpaceResponse } from '@/lib/api'
import { useSpaces } from '@/hooks/use-spaces'

interface SpacesContextType {
  spaces: SpaceResponse[]
  isLoading: boolean
  error: any
  getSpaceById: (id: string) => SpaceResponse | undefined
}

const SpacesContext = createContext<SpacesContextType | undefined>(undefined)

interface SpacesProviderProps {
  children: React.ReactNode
}

export function SpacesProvider({ children }: SpacesProviderProps) {
  const { data: spaces = [], isLoading, error } = useSpaces()

  const getSpaceById = (id: string): SpaceResponse | undefined => {
    return spaces.find(space => space.id === id)
  }

  return (
    <SpacesContext.Provider value={{
      spaces,
      isLoading,
      error,
      getSpaceById
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