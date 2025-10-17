import React from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpaceReorderControlsProps {
  isExpanded: boolean
  isReorderMode: boolean
  totalSpaces: number
  onToggleReorderMode: () => void
}

export function SpaceReorderControls({
  isExpanded,
  isReorderMode,
  totalSpaces,
  onToggleReorderMode
}: SpaceReorderControlsProps) {
  // Don't show reorder controls if not expanded or only one space
  if (!isExpanded || totalSpaces <= 1) return null

  return (
    <div
      className={cn(
        "group flex items-center cursor-pointer transition-all duration-200 h-10 hover:bg-muted gap-3 px-4 border-b border-border",
        isReorderMode && "bg-teal-50 text-teal-900"
      )}
      onClick={onToggleReorderMode}
    >
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        <GripVertical className={cn(
          "w-4 h-4 transition-colors",
          isReorderMode ? "text-teal-600" : "text-muted-foreground group-hover:text-foreground"
        )} />
      </div>
      <span className={cn(
        "text-sm transition-colors",
        isReorderMode ? "text-teal-900 font-medium" : "text-muted-foreground group-hover:text-foreground"
      )}>
        {isReorderMode ? "Done Reordering" : "Change Order"}
      </span>
    </div>
  )
}