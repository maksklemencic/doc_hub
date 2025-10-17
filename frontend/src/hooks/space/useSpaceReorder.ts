import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { spacesKeys } from '@/hooks/spaces/use-spaces'
import { spacesApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { spaceLogger } from '@/utils/logger'

export function useSpaceReorder(spaces: any[]) {
  const queryClient = useQueryClient()
  const reorderContainerRef = useRef<HTMLDivElement>(null)

  // Reorder state
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [pendingReorderedSpaces, setPendingReorderedSpaces] = useState<any[] | null>(null)

  // Drag and drop sensors with better performance
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before drag starts (reduces accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Click outside to close reorder mode
  useEffect(() => {
    if (!isReorderMode) return

    const handleClickOutside = (event: MouseEvent) => {
      if (reorderContainerRef.current && !reorderContainerRef.current.contains(event.target as Node)) {
        handleSaveReorder()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isReorderMode, pendingReorderedSpaces])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const currentSpaces = pendingReorderedSpaces || spaces
    const oldIndex = currentSpaces.findIndex((space: any) => space.id === active.id)
    const newIndex = currentSpaces.findIndex((space: any) => space.id === over.id)

    // Reorder the array locally without API call
    const reorderedSpaces = arrayMove(currentSpaces, oldIndex, newIndex)
    setPendingReorderedSpaces(reorderedSpaces)
  }

  const handleSaveReorder = async () => {
    if (!pendingReorderedSpaces) {
      setIsReorderMode(false)
      return
    }

    const toastId = toast.loading('Saving space order...')

    try {
      // Update display_order for all spaces with partial failure handling
      const results = await Promise.allSettled(
        pendingReorderedSpaces.map(async (space, index) => {
          await spacesApi.updateSpace(space.id, { display_order: index })
          return space.id
        })
      )

      // Check for failures
      const failures = results.filter(r => r.status === 'rejected')
      if (failures.length > 0) {
        toast.error(`Failed to update ${failures.length} space(s). Changes reverted.`, { id: toastId })
        // Revert pending changes
        setPendingReorderedSpaces(null)
        // Invalidate to restore original order
        queryClient.invalidateQueries({ queryKey: spacesKeys.lists() })
        return
      }

      // All succeeded
      // Invalidate the query to refetch with new order
      queryClient.invalidateQueries({ queryKey: spacesKeys.lists() })

      toast.success('Space order updated!', { id: toastId })
      setPendingReorderedSpaces(null)
      setIsReorderMode(false)
    } catch (error) {
      spaceLogger.error('Failed to update space order', error, {
        action: 'saveReorder',
        spaceCount: pendingReorderedSpaces?.length,
        isReorderMode
      })
      toast.error('Failed to update space order.', { id: toastId })
      // Revert pending changes
      setPendingReorderedSpaces(null)
      queryClient.invalidateQueries({ queryKey: spacesKeys.lists() })
    }
  }

  const handleToggleReorderMode = () => {
    if (isReorderMode) {
      handleSaveReorder()
    } else {
      setIsReorderMode(true)
    }
  }

  // Use pending reordered spaces if available (during reorder mode)
  const currentSpaces = pendingReorderedSpaces || spaces

  return {
    // State
    isReorderMode,
    pendingReorderedSpaces,
    currentSpaces,
    reorderContainerRef,

    // DnD setup
    sensors,
    handleDragEnd,

    // Actions
    handleSaveReorder,
    handleToggleReorderMode,
    setIsReorderMode,
  }
}