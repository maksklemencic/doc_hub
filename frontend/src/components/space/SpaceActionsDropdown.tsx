import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Edit2, Trash2, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpaceActionsDropdownProps {
  space: any
  totalSpaces: number
  isExpanded: boolean
  isReorderMode: boolean
  onEdit: (e?: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  disabled?: boolean
}

export function SpaceActionsDropdown({
  space,
  totalSpaces,
  isExpanded,
  isReorderMode,
  onEdit,
  onDelete,
  disabled = false
}: SpaceActionsDropdownProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  const handleEditClick = (e?: React.MouseEvent) => {
    // Prevent space navigation
    e?.stopPropagation()

    // Close dropdown menu
    setDropdownOpen(false)

    // Small delay to ensure menus close before popover opens
    setTimeout(() => {
      onEdit(e)
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

  // Don't show actions in reorder mode
  if (isReorderMode) return null

  const dropdownContent = (
    <>
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
              onDelete(e)
            }}
            className="text-destructive focus:bg-red-50 focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Space
          </DropdownMenuItem>
        </>
      )}
    </>
  )

  // For expanded sidebar: show dropdown menu
  if (isExpanded) {
    return (
      <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "flex-shrink-0 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={(e) => {
              e.stopPropagation()
            }}
            title="Space actions"
            disabled={disabled}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-52"
          onCloseAutoFocus={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          {dropdownContent}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // For collapsed sidebar: use context menu (handled by parent)
  return null
}