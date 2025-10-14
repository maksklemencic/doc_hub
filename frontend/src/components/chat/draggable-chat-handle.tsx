'use client'

import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DraggableChatHandleProps {
  className?: string
}

export function DraggableChatHandle({ className }: DraggableChatHandleProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: 'chat-drag-handle',
    data: {
      type: 'chat-drag',
    },
  })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors",
        isDragging && "opacity-50",
        className
      )}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-4 w-4" />
    </div>
  )
}