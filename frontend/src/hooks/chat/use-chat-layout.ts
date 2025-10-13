import { useCallback, useMemo } from 'react'
import { useChatLayoutContext } from '@/contexts/chat-layout-context'
import { ChatPosition, ChatLayoutState } from '@/types'

interface UseChatLayoutProps {
  spaceId: string
}

interface UseChatLayoutReturn {
  // Current layout state
  layout: ChatLayoutState

  // Position queries
  position: ChatPosition
  isBottomFull: boolean
  isBottomLeft: boolean
  isBottomRight: boolean
  isTabLeft: boolean
  isTabRight: boolean
  isHidden: boolean
  isBottomMode: boolean
  isTabMode: boolean

  // History state (for bottom mode)
  showHistory: boolean

  // Actions
  moveTo: (position: ChatPosition) => void
  moveToBottomFull: () => void
  moveToBottomLeft: () => void
  moveToBottomRight: () => void
  moveToTabLeft: () => void
  moveToTabRight: () => void
  hide: () => void
  toggleHistory: () => void
  openHistory: () => void
  closeHistory: () => void
  reset: () => void
}

/**
 * Hook for managing chat layout for a specific space
 * Provides convenient helpers and position-specific actions
 */
export function useChatLayout({ spaceId }: UseChatLayoutProps): UseChatLayoutReturn {
  const context = useChatLayoutContext()

  // Get current layout
  const layout = context.getChatLayout(spaceId)

  // Position checks
  const position = layout.position
  const isBottomFull = position === 'bottom-full'
  const isBottomLeft = position === 'bottom-left'
  const isBottomRight = position === 'bottom-right'
  const isTabLeft = position === 'tab-left'
  const isTabRight = position === 'tab-right'
  const isHidden = position === 'hidden'
  const isBottomMode = context.isBottomMode(spaceId)
  const isTabMode = context.isTabMode(spaceId)

  // History state
  const showHistory = layout.showHistory

  // Action creators
  const moveTo = useCallback((newPosition: ChatPosition) => {
    context.moveChatTo(spaceId, newPosition)
  }, [context, spaceId])

  const moveToBottomFull = useCallback(() => {
    context.moveChatTo(spaceId, 'bottom-full')
  }, [context, spaceId])

  const moveToBottomLeft = useCallback(() => {
    context.moveChatTo(spaceId, 'bottom-left')
  }, [context, spaceId])

  const moveToBottomRight = useCallback(() => {
    context.moveChatTo(spaceId, 'bottom-right')
  }, [context, spaceId])

  const moveToTabLeft = useCallback(() => {
    context.moveChatTo(spaceId, 'tab-left')
  }, [context, spaceId])

  const moveToTabRight = useCallback(() => {
    context.moveChatTo(spaceId, 'tab-right')
  }, [context, spaceId])

  const hide = useCallback(() => {
    context.moveChatTo(spaceId, 'hidden')
  }, [context, spaceId])

  const toggleHistory = useCallback(() => {
    context.toggleHistory(spaceId)
  }, [context, spaceId])

  const openHistory = useCallback(() => {
    context.setHistoryVisible(spaceId, true)
  }, [context, spaceId])

  const closeHistory = useCallback(() => {
    context.setHistoryVisible(spaceId, false)
  }, [context, spaceId])

  const reset = useCallback(() => {
    context.resetChatLayout(spaceId)
  }, [context, spaceId])

  return useMemo(() => ({
    // State
    layout,
    position,
    isBottomFull,
    isBottomLeft,
    isBottomRight,
    isTabLeft,
    isTabRight,
    isHidden,
    isBottomMode,
    isTabMode,
    showHistory,

    // Actions
    moveTo,
    moveToBottomFull,
    moveToBottomLeft,
    moveToBottomRight,
    moveToTabLeft,
    moveToTabRight,
    hide,
    toggleHistory,
    openHistory,
    closeHistory,
    reset,
  }), [
    layout,
    position,
    isBottomFull,
    isBottomLeft,
    isBottomRight,
    isTabLeft,
    isTabRight,
    isHidden,
    isBottomMode,
    isTabMode,
    showHistory,
    moveTo,
    moveToBottomFull,
    moveToBottomLeft,
    moveToBottomRight,
    moveToTabLeft,
    moveToTabRight,
    hide,
    toggleHistory,
    openHistory,
    closeHistory,
    reset,
  ])
}
