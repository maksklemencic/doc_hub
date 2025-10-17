import React from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpaceReorderHandleProps {
  attributes: any
  listeners: any
  isReorderMode: boolean
  className?: string
}

export function SpaceReorderHandle({
  attributes,
  listeners,
  isReorderMode,
  className
}: SpaceReorderHandleProps) {
  if (!isReorderMode) return null

  return (
    <div
      {...attributes}
      {...listeners}
      className={cn(
        "flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground",
        "hover:text-foreground transition-colors",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical className="h-4 w-4" />
    </div>
  )
}