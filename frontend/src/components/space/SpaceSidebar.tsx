import React from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  TooltipProvider,
} from '@/components/ui/tooltip'
import { SpaceEditPopover } from '@/components/shared/space-edit-popover'
import { SpaceListItem } from './SpaceListItem'
import { CreateSpaceButton } from './CreateSpaceButton'
import { SpaceReorderControls } from './SpaceReorderControls'
import { useSpaceCRUD } from '@/hooks/space/useSpaceCRUD'
import { useSpaceReorder } from '@/hooks/space/useSpaceReorder'
import { useSpaceSidebarState } from '@/hooks/space/useSpaceSidebarState'
import { cn } from '@/lib/utils'
import { Trash2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

interface SpaceSidebarProps {
  isExpanded: boolean
}

export function SpaceSidebar({ isExpanded }: SpaceSidebarProps) {
  const { spaces, isLoading } = useSpaceSidebarState()

  const {
    handleCreateSpace,
    handleUpdateSpace,
    handleDeleteSpaceClick,
    handleSpaceClick,
    handleEditPopoverOpenChange,
    handleCreatePopoverOpenChange,
    editingSpaceId,
    createPopoverOpen,
    isCreatePending,
    isUpdatePending,
    isDeletePending,
    deleteDialogOpen,
    spaceToDelete,
    setDeleteDialogOpen,
    setSpaceToDelete,
    handleConfirmDelete,
  } = useSpaceCRUD({ spaces })

  const {
    currentSpaces,
    isReorderMode,
    reorderContainerRef,
    sensors,
    handleDragEnd,
    handleToggleReorderMode,
  } = useSpaceReorder(spaces)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="sm" />
      </div>
    )
  }

  if (spaces.length === 0) {
    return (
      <div className="px-2 py-8 text-center text-sm text-muted-foreground">
        No spaces yet
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div>
      {/* Create space button */}
      <CreateSpaceButton
        isExpanded={isExpanded}
        isOpen={createPopoverOpen}
        onOpenChange={handleCreatePopoverOpenChange}
        onCreate={handleCreateSpace}
        disabled={isCreatePending}
        isLoading={isCreatePending}
      />

      {/* Wrapper for reorder mode with single border */}
      <div
        ref={reorderContainerRef}
        className={cn(
          isReorderMode && isExpanded && spaces.length > 1 && "border-2 border-teal-500"
        )}
      >
        {/* Reorder mode controls */}
        <SpaceReorderControls
          isExpanded={isExpanded}
          isReorderMode={isReorderMode}
          totalSpaces={spaces.length}
          onToggleReorderMode={handleToggleReorderMode}
        />

        {/* Spaces list */}
        <div
          className={cn(
            "spaces-list",
            "transition-all duration-200"
          )}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={currentSpaces.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {currentSpaces.map((space) => (
                <SpaceListItem
                  key={space.id}
                  space={space}
                  isActive={space.isActive}
                  isExpanded={isExpanded}
                  isReorderMode={isReorderMode}
                  totalSpaces={spaces.length}
                  updateMutationPending={isUpdatePending}
                  editPopoverOpen={editingSpaceId === space.id}
                  onSpaceClick={handleSpaceClick}
                  onUpdate={handleUpdateSpace}
                  onDelete={(e) => {
                    e.stopPropagation()
                    handleDeleteSpaceClick(space)
                  }}
                  onEditPopoverOpenChange={(open) => {
                    handleEditPopoverOpenChange(space.id, open)
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Create space popover for collapsed sidebar */}
      {!isExpanded && (
        <SpaceEditPopover
          mode="create"
          open={createPopoverOpen}
          onOpenChange={handleCreatePopoverOpenChange}
          onCreate={handleCreateSpace}
          disabled={isCreatePending}
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
        loading={isDeletePending}
        disabled={isDeletePending}
        icon={Trash2}
        variant="destructive"
      />
      </div>
    </TooltipProvider>
  )
}