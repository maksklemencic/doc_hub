'use client'

import * as React from 'react'
import { memo } from 'react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRouter, usePathname } from 'next/navigation'
import * as Icons from 'lucide-react'
import {
  Plus,
  Edit2,
  Trash2,
  Settings,
  PanelLeftClose,
  PanelLeft,
  MoreVertical,
  ImageIcon,
  GripVertical
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { useSpaces, useCreateSpace, useUpdateSpace, useDeleteSpace, spacesKeys } from '@/hooks/spaces/use-spaces'
import { useSpaceDocumentCounts } from '@/hooks/spaces/use-space-document-counts'
import { SpaceEditPopover } from '@/components/shared/space-edit-popover'
import { spacesApi } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { safeGetItem, safeSetItem } from '@/utils/safe-storage'
import { ROUTES } from '@/constants'
import { useSidebar } from '@/contexts/sidebar-context'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { spaceLogger } from '@/utils/logger'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SidebarProps {
  className?: string
}

const STORAGE_KEY = 'sidebar-pinned'

// Sortable Space Item Component
interface SortableSpaceItemProps {
  space: any
  isActive: boolean
  isExpanded: boolean
  isReorderMode: boolean
  onSpaceClick: (spaceId: string) => void
  onUpdate: (spaceId: string, data: any) => Promise<void>
  onDelete: (space: any) => void
  updateMutationPending: boolean
  editPopoverOpen: boolean
  onEditPopoverOpenChange: (open: boolean) => void
  totalSpaces: number
}

function SortableSpaceItem({
  space,
  isActive,
  isExpanded,
  isReorderMode,
  onSpaceClick,
  onUpdate,
  onDelete,
  updateMutationPending,
  editPopoverOpen,
  onEditPopoverOpenChange,
  totalSpaces,
}: SortableSpaceItemProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  const handleEditClick = (e?: React.MouseEvent) => {
    // Prevent space navigation
    e?.stopPropagation()

    // Close dropdown menu
    setDropdownOpen(false)

    // Small delay to ensure menus close before popover opens
    setTimeout(() => {
      onEditPopoverOpenChange(true)
    }, 150)
  }

  const handleDropdownOpenChange = (open: boolean) => {
    setDropdownOpen(open)
  }

  const handleContextMenuOpenChange = (open: boolean) => {
    // Close dropdown when context menu opens
    if (open) {
      setDropdownOpen(false)
    }
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: space.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Get the icon component dynamically
  const IconComponent = (Icons as any)[space.icon || 'Folder'] || Icons.Folder

  const spaceContent = (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center cursor-pointer transition-all duration-200 h-[56px]",
        isExpanded ? "gap-3 px-4" : "justify-center",
        isActive
          ? "bg-teal-50 text-teal-900 border-l-2 border-teal-600"
          : "hover:bg-muted text-foreground"
      )}
      onClick={() => onSpaceClick(space.id)}
      id={`space-${space.id}`}
    >
      {/* Drag handle - only visible when expanded and in reorder mode */}
      {isExpanded && isReorderMode && (
        <div
          {...attributes}
          {...(isReorderMode ? listeners : {})}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      {/* Icon */}
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        <IconComponent className={cn(
          "w-4 h-4 transition-none",
          space.icon_color || 'text-gray-600'
        )} />
      </div>

      {/* Space name and count - only visible when expanded */}
      {isExpanded && (
        <>
          <div className="flex-1 min-w-0 max-w-[168px] group-hover:max-w-[140px] overflow-hidden transition-all">
            <p className={cn(
              "text-sm font-medium overflow-hidden whitespace-nowrap text-ellipsis w-full",
              isActive ? "text-teal-900" : "text-foreground"
            )}>
              {space.name}
            </p>
            <p className={cn(
              "text-xs whitespace-nowrap w-full",
              isActive ? "text-teal-600" : "text-muted-foreground"
            )}>
              {space.documentCount} documents
            </p>
          </div>

          {/* Dots menu - shown on hover, hidden in reorder mode */}
          {!isReorderMode && (
            <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                  title="Space actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-52"
              onCloseAutoFocus={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleEditClick(e as any)
                }}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Space
              </DropdownMenuItem>
              {totalSpaces > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(space)
                    }}
                    className="text-destructive focus:bg-red-50 focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Space
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </>
      )}
    </div>
  )

  // Create invisible popover trigger positioned at the vertical center of the space (only when not in reorder mode)
  const popover = !isReorderMode ? (
    <SpaceEditPopover
      mode="edit"
      space={space}
      onUpdate={(data) => onUpdate(space.id, data)}
      disabled={updateMutationPending}
      open={editPopoverOpen}
      onOpenChange={onEditPopoverOpenChange}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          transform: 'translateY(-50%)',
          width: '100%',
          height: '1px',
          pointerEvents: 'none'
        }}
        aria-hidden="true"
      />
    </SpaceEditPopover>
  ) : null

  // Wrap with tooltip when collapsed
  if (!isExpanded) {
    return (
      <>
        <Tooltip>
          <ContextMenu onOpenChange={handleContextMenuOpenChange}>
            <ContextMenuTrigger asChild>
              <TooltipTrigger asChild>
                {spaceContent}
              </TooltipTrigger>
            </ContextMenuTrigger>
            <TooltipContent side="right">
              <div className="text-center">
                <p className="font-medium">{space.name}</p>
                <p className="text-xs text-gray-300">{space.documentCount} documents</p>
              </div>
            </TooltipContent>
            <ContextMenuContent
              className="w-52"
              onCloseAutoFocus={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
            >
              <ContextMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleEditClick(e as any)
                }}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Space
              </ContextMenuItem>
              {totalSpaces > 1 && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(space)
                    }}
                    className="text-destructive focus:bg-red-50 focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Space
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        </Tooltip>
        {popover}
      </>
    )
  }

  return (
    <>
      {spaceContent}
      {popover}
    </>
  )
}

export const Sidebar = memo(function Sidebar({ className }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()

  // Use global sidebar state from context
  const { isExpanded, togglePin } = useSidebar()

  // TanStack Query hooks
  const { data: spacesData = [], isLoading } = useSpaces()
  const createSpaceMutation = useCreateSpace()
  const updateSpaceMutation = useUpdateSpace()
  const deleteSpaceMutation = useDeleteSpace()

  // UI state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [spaceToDelete, setSpaceToDelete] = useState<any>(null)
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [createPopoverOpen, setCreatePopoverOpen] = useState(false)
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [pendingReorderedSpaces, setPendingReorderedSpaces] = useState<any[] | null>(null)
  const reorderContainerRef = React.useRef<HTMLDivElement>(null)

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

  // For local UI state that depends on sidebar state
  const isPinned = isExpanded

  // Get document counts for all spaces (exclude temporary IDs from optimistic updates)
  const spaceIds = spacesData.filter(space => !space.id.startsWith('temp-')).map(space => space.id)
  const { data: documentCounts = {} } = useSpaceDocumentCounts(spaceIds)

  // Determine active space
  const pathMatch = pathname.match(/^\/spaces\/([^/]+)/)
  const activeSpaceId = pathMatch ? pathMatch[1] : null

  // Sort spaces by display_order (nulls last) and map to include extra props
  // Use pending reordered spaces if available (during reorder mode)
  const baseSpaces = [...spacesData]
    .sort((a, b) => {
      if (a.display_order === null && b.display_order === null) return 0
      if (a.display_order === null) return 1
      if (b.display_order === null) return -1
      return (a.display_order ?? 0) - (b.display_order ?? 0)
    })
    .map((space) => ({
      ...space,
      isActive: space.id === activeSpaceId,
      documentCount: documentCounts[space.id] || 0,
    }))

  const spaces = pendingReorderedSpaces || baseSpaces

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

    }
  }

  const handleSpaceClick = (spaceId: string) => {
    router.push(`/spaces/${spaceId}`)
  }

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

  return (
    <div
      className={cn(
        'flex h-full flex-col bg-background border-r border-border transition-all duration-200',
        isExpanded ? 'w-[240px]' : 'w-[64px]',
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex h-14 items-center border-b border-border",
        isExpanded ? "justify-between px-4" : "justify-center px-2"
      )}>
        {isExpanded && <h2 className="text-sm font-semibold text-foreground">Spaces</h2>}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={togglePin}
              >
                {isPinned ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{isExpanded ? "Unpin sidebar" : "Pin sidebar"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Spaces List */}
      <ScrollArea className="flex-1">
        <TooltipProvider delayDuration={300}>
          <div>
            {/* Create space button - first item with tab height */}
            {!isLoading && !isExpanded && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "group flex items-center cursor-pointer transition-all duration-200 h-10 hover:bg-muted justify-center border-b border-border"
                    )}
                    onClick={() => {
                      setEditingSpaceId(null)
                      setTimeout(() => {
                        setCreatePopoverOpen(true)
                      }, 150)
                    }}
                  >
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Create Space</p>
                </TooltipContent>
              </Tooltip>
            )}
            {!isLoading && isExpanded && (
              <SpaceEditPopover
                mode="create"
                open={createPopoverOpen}
                onOpenChange={(open) => {
                  setCreatePopoverOpen(open)
                  // Close edit popover when create opens
                  if (open) {
                    setEditingSpaceId(null)
                  }
                }}
                onCreate={handleCreateSpace}
                disabled={createSpaceMutation.isPending}
              >
                <div
                  className={cn(
                    "group flex items-center cursor-pointer transition-all duration-200 h-10 hover:bg-muted gap-3 px-4 border-b border-border"
                  )}
                  onClick={() => {
                    setEditingSpaceId(null)
                    setTimeout(() => {
                      setCreatePopoverOpen(true)
                    }, 150)
                  }}
                >
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Create Space</span>
                </div>
              </SpaceEditPopover>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : spaces.length === 0 ? (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                No spaces yet
              </div>
            ) : (
              <>
                {/* Wrapper for reorder mode with single border */}
                <div
                  ref={reorderContainerRef}
                  className={cn(
                    isReorderMode && isExpanded && spaces.length > 1 && "border-2 border-teal-500"
                  )}
                >
                  {/* Reorder mode toggle button - only when expanded and multiple spaces */}
                  {!isLoading && isExpanded && spaces.length > 1 && (
                    <div
                      className={cn(
                        "group flex items-center cursor-pointer transition-all duration-200 h-10 hover:bg-muted gap-3 px-4 border-b border-border",
                        isReorderMode && "bg-teal-50 text-teal-900"
                      )}
                      onClick={() => {
                        if (isReorderMode) {
                          handleSaveReorder()
                        } else {
                          setIsReorderMode(true)
                        }
                      }}
                    >
                      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                        <GripVertical className={cn(
                          "w-4 h-4",
                          isReorderMode ? "text-teal-600" : "text-muted-foreground"
                        )} />
                      </div>
                      <span className={cn(
                        "text-sm",
                        isReorderMode ? "text-teal-900 font-medium" : "text-muted-foreground"
                      )}>
                        {isReorderMode ? "Done Reordering" : "Change Order"}
                      </span>
                    </div>
                  )}

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={spaces.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {spaces.map((space) => (
                        <SortableSpaceItem
                          key={space.id}
                          space={space}
                          isActive={space.isActive}
                          isExpanded={isExpanded}
                          isReorderMode={isReorderMode}
                          onSpaceClick={handleSpaceClick}
                          onUpdate={handleUpdateSpace}
                          onDelete={handleDeleteSpaceClick}
                          updateMutationPending={updateSpaceMutation.isPending}
                          editPopoverOpen={editingSpaceId === space.id}
                          onEditPopoverOpenChange={(open) => {
                            setEditingSpaceId(open ? space.id : null)
                            // Close create popover when edit opens
                            if (open) {
                              setCreatePopoverOpen(false)
                            }
                          }}
                          totalSpaces={spaces.length}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </>
            )}
          </div>

          {/* Create space popover for collapsed sidebar */}
          {!isExpanded && (
            <SpaceEditPopover
              mode="create"
              open={createPopoverOpen}
              onOpenChange={(open) => {
                setCreatePopoverOpen(open)
                if (open) {
                  setEditingSpaceId(null)
                }
              }}
              onCreate={handleCreateSpace}
              disabled={createSpaceMutation.isPending}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 0,
                  width: '100%',
                  height: '1px',
                  pointerEvents: 'none'
                }}
                aria-hidden="true"
              />
            </SpaceEditPopover>
          )}
        </TooltipProvider>
      </ScrollArea>

      {/* Settings at bottom */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          className={cn(
            "w-full text-foreground hover:text-foreground hover:bg-muted",
            isExpanded ? "justify-start" : "justify-center p-2"
          )}
          onClick={() => {
            router.push(ROUTES.SETTINGS)
          }}
          title={!isExpanded ? "Settings" : undefined}
        >
          <Settings className={cn("h-4 w-4", isExpanded && "mr-2")} />
          {isExpanded && "Settings"}
        </Button>
      </div>

      {/* Delete Space Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Space"
        description={
          <>
            Are you sure you want to delete "<strong>{spaceToDelete?.name}</strong>"?
            This action cannot be undone and will permanently remove the space and all its contents.
          </>
        }
        confirmText="Delete Space"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false)
          setSpaceToDelete(null)
        }}
        loading={deleteSpaceMutation.isPending}
        disabled={deleteSpaceMutation.isPending}
        icon={Trash2}
        variant="destructive"
      />
    </div>
  )
})
