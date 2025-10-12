/**
 * Sidebar Context
 *
 * Provides sidebar state to all components in the app.
 * Manages the collapsible sidebar behavior with hover and pin functionality.
 */

'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useSidebarState, SidebarState } from '@/hooks/ui/use-sidebar-state'

interface SidebarContextValue {
  state: SidebarState
  isPinned: boolean
  isExpanded: boolean
  isHovering: boolean
  handleMouseEnter: () => void
  handleMouseLeave: () => void
  togglePin: () => void
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const sidebarState = useSidebarState()

  return (
    <SidebarContext.Provider value={sidebarState}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
