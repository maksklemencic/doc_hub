import React from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SpaceEditPopover } from '@/components/shared/space-edit-popover'

interface CreateSpaceButtonProps {
  isExpanded: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (data: { name: string; icon: string; icon_color: string }) => Promise<void>
  disabled?: boolean
  isLoading?: boolean
}

export function CreateSpaceButton({
  isExpanded,
  isOpen,
  onOpenChange,
  onCreate,
  disabled = false,
  isLoading = false
}: CreateSpaceButtonProps) {
  const handleClick = () => {
    setTimeout(() => {
      onOpenChange(true)
    }, 150)
  }

  const buttonContent = (
    <div
      className={cn(
        "group flex items-center cursor-pointer transition-all duration-200 h-10 hover:bg-muted",
        isExpanded ? "gap-3 px-4" : "justify-center",
        "border-b border-border",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={disabled ? undefined : handleClick}
    >
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        <Plus className={cn(
          "w-4 h-4 text-muted-foreground",
          !disabled && "group-hover:text-foreground transition-colors"
        )} />
      </div>
      {isExpanded && (
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
          Create Space
        </span>
      )}
    </div>
  )

  if (isExpanded) {
    return (
      <SpaceEditPopover
        mode="create"
        open={isOpen}
        onOpenChange={onOpenChange}
        onCreate={onCreate}
        disabled={disabled || isLoading}
      >
        {buttonContent}
      </SpaceEditPopover>
    )
  }

  // For collapsed sidebar, the popover is handled by the parent
  return buttonContent
}