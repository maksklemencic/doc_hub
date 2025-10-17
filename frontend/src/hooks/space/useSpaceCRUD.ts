import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateSpace, useUpdateSpace, useDeleteSpace, spacesKeys } from '@/hooks/spaces/use-spaces'
import { spacesApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { spaceLogger } from '@/utils/logger'

interface UseSpaceCRUDProps {
  spaces?: any[]
}

export function useSpaceCRUD({ spaces = [] }: UseSpaceCRUDProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()

  // Mutations from existing hooks
  const createSpaceMutation = useCreateSpace()
  const updateSpaceMutation = useUpdateSpace()
  const deleteSpaceMutation = useDeleteSpace()

  // UI state for modals
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [spaceToDelete, setSpaceToDelete] = useState<any>(null)
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [createPopoverOpen, setCreatePopoverOpen] = useState(false)

  // Determine active space from pathname
  const pathMatch = pathname.match(/^\/spaces\/([^/]+)/)
  const activeSpaceId = pathMatch ? pathMatch[1] : null

  const handleCreateSpace = async (data: { name: string; icon: string; icon_color: string }) => {
    if (createSpaceMutation.isPending) return

    try {
      const newSpace = await createSpaceMutation.mutateAsync(data)
      setCreatePopoverOpen(false)
      if (newSpace?.id) {
        router.push(`/spaces/${newSpace.id}`)
      }
    } catch (error) {
      throw error // Re-throw to let popover handle it
    }
  }

  const handleUpdateSpace = async (spaceId: string, data: any) => {
    await updateSpaceMutation.mutateAsync({
      spaceId,
      data
    })
  }

  const handleDeleteSpaceClick = (space: any) => {
    setSpaceToDelete(space)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!spaceToDelete) return

    try {
      await deleteSpaceMutation.mutateAsync(spaceToDelete.id)

      // If deleting the currently active space, redirect to the first remaining space
      if (activeSpaceId === spaceToDelete.id) {
        const remainingSpaces = spaces.filter(s => s.id !== spaceToDelete.id)
        if (remainingSpaces.length > 0) {
          router.push(`/spaces/${remainingSpaces[0].id}`)
        } else {
          router.push('/')
        }
      }

      setDeleteDialogOpen(false)
      setSpaceToDelete(null)
    } catch (error) {
      spaceLogger.error('Failed to delete space', error, {
        action: 'deleteSpace',
        spaceId: spaceToDelete.id,
        spaceName: spaceToDelete.name
      })
    }
  }

  const handleSpaceClick = (spaceId: string) => {
    router.push(`/spaces/${spaceId}`)
  }

  const handleEditPopoverOpenChange = (spaceId: string | null, open: boolean) => {
    setEditingSpaceId(open ? spaceId : null)
    // Close create popover when edit opens
    if (open) {
      setCreatePopoverOpen(false)
    }
  }

  const handleCreatePopoverOpenChange = (open: boolean) => {
    setCreatePopoverOpen(open)
    // Close edit popover when create opens
    if (open) {
      setEditingSpaceId(null)
    }
  }

  return {
    // State
    deleteDialogOpen,
    spaceToDelete,
    editingSpaceId,
    createPopoverOpen,
    activeSpaceId,

    // Mutation states
    isCreatePending: createSpaceMutation.isPending,
    isUpdatePending: updateSpaceMutation.isPending,
    isDeletePending: deleteSpaceMutation.isPending,

    // Actions
    handleCreateSpace,
    handleUpdateSpace,
    handleDeleteSpaceClick,
    handleConfirmDelete,
    handleSpaceClick,
    handleEditPopoverOpenChange,
    handleCreatePopoverOpenChange,
    setDeleteDialogOpen,
    setSpaceToDelete,
  }
}