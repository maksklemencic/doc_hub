import { useState, useEffect, useCallback } from 'react'
import { safeGetItem, safeSetItem } from '@/utils/safe-storage'

export type SidebarState = 'collapsed' | 'expanded' | 'pinned'

const STORAGE_KEY = 'sidebar-state'
const STORAGE_PINNED_KEY = 'sidebar-pinned'

export function useSidebarState() {
  // Check if pinned on initial load
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = safeGetItem<string>(STORAGE_PINNED_KEY, 'false')
    return stored === 'true'
  })

  // Initialize state based on pinned preference
  const [state, setState] = useState<SidebarState>(() => {
    if (typeof window === 'undefined') return 'collapsed'
    const pinned = safeGetItem<string>(STORAGE_PINNED_KEY, 'false') === 'true'
    return pinned ? 'pinned' : 'collapsed'
  })

  // Temporary hover expansion state
  const [isHovering, setIsHovering] = useState(false)

  // Persist pinned state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    safeSetItem(STORAGE_PINNED_KEY, isPinned.toString(), {
      showToast: false, // Don't show toast for UI state
      retryWithCleanup: true,
    })
  }, [isPinned])

  // Handle hover expand (only if not pinned)
  const handleMouseEnter = useCallback(() => {
    if (state === 'collapsed') {
      setIsHovering(true)
      setState('expanded')
    }
  }, [state])

  // Handle hover collapse (only if not pinned)
  const handleMouseLeave = useCallback(() => {
    if (state === 'expanded' && !isPinned) {
      setIsHovering(false)
      // Add small delay to prevent flickering
      setTimeout(() => {
        setState('collapsed')
      }, 100)
    }
  }, [state, isPinned])

  // Toggle pin state
  const togglePin = useCallback(() => {
    setIsPinned(prev => {
      const newPinned = !prev
      if (newPinned) {
        setState('pinned')
      } else {
        setState('collapsed')
      }
      return newPinned
    })
  }, [])

  // Manual toggle (for keyboard shortcut)
  const toggle = useCallback(() => {
    if (isPinned) {
      setIsPinned(false)
      setState('collapsed')
    } else {
      setIsPinned(true)
      setState('pinned')
    }
  }, [isPinned])

  // Check if sidebar is currently visible (expanded or pinned)
  const isExpanded = state === 'expanded' || state === 'pinned'

  return {
    state,
    isPinned,
    isExpanded,
    isHovering,
    handleMouseEnter,
    handleMouseLeave,
    togglePin,
    toggle,
  }
}
