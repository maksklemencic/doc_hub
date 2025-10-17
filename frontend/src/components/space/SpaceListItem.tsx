import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { SpaceEditPopover } from '@/components/shared/space-edit-popover'
import { SpaceReorderHandle } from './SpaceReorderHandle'
import { SpaceActionsDropdown } from './SpaceActionsDropdown'
import { cn } from '@/lib/utils'
import * as Icons from 'lucide-react'
import { Edit2, Trash2 } from 'lucide-react'

interface SpaceListItemProps {
  space: any
  isActive: boolean
  isExpanded: boolean
  isReorderMode: boolean
  totalSpaces: number
  updateMutationPending: boolean
  editPopoverOpen: boolean
  onSpaceClick: (spaceId: string) => void
  onUpdate: (spaceId: string, data: any) => Promise<void>
  onDelete: (e: React.MouseEvent) => void
  onEditPopoverOpenChange: (open: boolean) => void
}

export function SpaceListItem({
  space,
  isActive,
  isExpanded,
  isReorderMode,
  totalSpaces,
  updateMutationPending,
  editPopoverOpen,
  onSpaceClick,
  onUpdate,
  onDelete,
  onEditPopoverOpenChange,
}: SpaceListItemProps) {

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

  const handleEditClick = (e?: React.MouseEvent) => {
    // Prevent space navigation
    e?.stopPropagation()

    // Small delay to ensure menus close before popover opens
    setTimeout(() => {
      onEditPopoverOpenChange(true)
    }, 150)
  }

  const handleContextMenuOpenChange = (open: boolean) => {
    // This will be handled by the dropdown component
  }

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
      {/* Drag handle */}
      <SpaceReorderHandle
        attributes={attributes}
        listeners={isReorderMode ? listeners : {}}
        isReorderMode={isReorderMode}
      />

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

          {/* Actions dropdown */}
          <SpaceActionsDropdown
            space={space}
            totalSpaces={totalSpaces}
            isExpanded={isExpanded}
            isReorderMode={isReorderMode}
            onEdit={handleEditClick}
            onDelete={onDelete}
            disabled={updateMutationPending}
          />
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
                      onDelete(e)
                    }}
                    className="text-destructive focus:bg-red-50 focus:text-destructive"
                  >
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