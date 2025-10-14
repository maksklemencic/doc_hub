'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { ChatPosition, ChatLayoutState } from '@/types'
import { SpaceStorage } from '@/utils/local-storage'

interface ChatLayoutContextType {
  // Get the current chat layout for a specific space
  getChatLayout: (spaceId: string) => ChatLayoutState

  // Move chat to a new position
  moveChatTo: (spaceId: string, position: ChatPosition) => void

  // Toggle history overlay (only relevant for bottom positions)
  toggleHistory: (spaceId: string) => void

  // Set history visibility explicitly
  setHistoryVisible: (spaceId: string, visible: boolean) => void

  // Check if chat is in bottom mode (any bottom position)
  isBottomMode: (spaceId: string) => boolean

  // Check if chat is in tab mode
  isTabMode: (spaceId: string) => boolean

  // Reset chat to default position
  resetChatLayout: (spaceId: string) => void

  // Handle chat drag and drop position changes
  handleChatDragEnd: (spaceId: string, position: ChatPosition) => void
}

const ChatLayoutContext = createContext<ChatLayoutContextType | undefined>(undefined)

interface ChatLayoutProviderProps {
  children: React.ReactNode
}

// Default layout state
const DEFAULT_LAYOUT: ChatLayoutState = {
  position: 'bottom-full',
  showHistory: false,
}

export function ChatLayoutProvider({ children }: ChatLayoutProviderProps) {
  // Store layout state for each space
  // Key: spaceId, Value: ChatLayoutState
  const [layouts, setLayouts] = useState<Record<string, ChatLayoutState>>({})

  // Get chat layout for a space
  const getChatLayout = useCallback((spaceId: string): ChatLayoutState => {
    if (layouts[spaceId]) {
      return layouts[spaceId]
    }

    // If not in state, return from storage or default without setting state
    const stored = SpaceStorage.get<ChatLayoutState>(spaceId, 'chatLayout')
    if (stored && isValidChatLayout(stored)) {
      return stored
    }

    return DEFAULT_LAYOUT
  }, [layouts])

  // Move chat to a new position
  const moveChatTo = useCallback((spaceId: string, position: ChatPosition) => {
    setLayouts(prev => {
      const current = prev[spaceId] || DEFAULT_LAYOUT
      const newLayout: ChatLayoutState = {
        position,
        // Reset showHistory when moving to tab mode or hidden
        showHistory: position.startsWith('bottom') ? current.showHistory : false,
      }

      // Persist to localStorage
      SpaceStorage.set(spaceId, 'chatLayout', newLayout)

      return {
        ...prev,
        [spaceId]: newLayout
      }
    })
  }, [])

  // Toggle history overlay
  const toggleHistory = useCallback((spaceId: string) => {
    setLayouts(prev => {
      const current = prev[spaceId] || DEFAULT_LAYOUT

      // Only toggle if in bottom mode
      if (!current.position.startsWith('bottom')) {
        return prev
      }

      const newLayout: ChatLayoutState = {
        ...current,
        showHistory: !current.showHistory,
      }

      // Persist to localStorage
      SpaceStorage.set(spaceId, 'chatLayout', newLayout)

      return {
        ...prev,
        [spaceId]: newLayout
      }
    })
  }, [])

  // Set history visibility explicitly
  const setHistoryVisible = useCallback((spaceId: string, visible: boolean) => {
    setLayouts(prev => {
      const current = prev[spaceId] || DEFAULT_LAYOUT

      // Only set if in bottom mode
      if (!current.position.startsWith('bottom')) {
        return prev
      }

      const newLayout: ChatLayoutState = {
        ...current,
        showHistory: visible,
      }

      // Persist to localStorage
      SpaceStorage.set(spaceId, 'chatLayout', newLayout)

      return {
        ...prev,
        [spaceId]: newLayout
      }
    })
  }, [])

  // Check if in bottom mode
  const isBottomMode = useCallback((spaceId: string): boolean => {
    const layout = getChatLayout(spaceId)
    return layout.position.startsWith('bottom')
  }, [getChatLayout])

  // Check if in tab mode
  const isTabMode = useCallback((spaceId: string): boolean => {
    const layout = getChatLayout(spaceId)
    return layout.position.startsWith('tab')
  }, [getChatLayout])

  // Reset to default
  const resetChatLayout = useCallback((spaceId: string) => {
    const newLayout = DEFAULT_LAYOUT

    setLayouts(prev => ({
      ...prev,
      [spaceId]: newLayout
    }))

    SpaceStorage.set(spaceId, 'chatLayout', newLayout)
  }, [])

  // Handle chat drag and drop position changes
  const handleChatDragEnd = useCallback((spaceId: string, position: ChatPosition) => {
    moveChatTo(spaceId, position)
  }, [moveChatTo])

  return (
    <ChatLayoutContext.Provider value={{
      getChatLayout,
      moveChatTo,
      toggleHistory,
      setHistoryVisible,
      isBottomMode,
      isTabMode,
      resetChatLayout,
      handleChatDragEnd,
    }}>
      {children}
    </ChatLayoutContext.Provider>
  )
}

// Hook to use the chat layout context
export function useChatLayoutContext(): ChatLayoutContextType {
  const context = useContext(ChatLayoutContext)
  if (context === undefined) {
    throw new Error('useChatLayoutContext must be used within a ChatLayoutProvider')
  }
  return context
}

// Validation helper
function isValidChatLayout(layout: unknown): layout is ChatLayoutState {
  if (!layout || typeof layout !== 'object') return false

  const validPositions: ChatPosition[] = [
    'bottom-full',
    'bottom-left',
    'bottom-right',
    'tab-left',
    'tab-right',
    'hidden'
  ]

  const obj = layout as Record<string, unknown>

  return (
    typeof obj.position === 'string' &&
    validPositions.includes(obj.position as ChatPosition) &&
    typeof obj.showHistory === 'boolean'
  )
}
