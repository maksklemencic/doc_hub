'use client'

import * as React from 'react'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRouter } from 'next/navigation'
import {
  Settings,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants'
import { useSidebar } from '@/contexts/sidebar-context'
import { SpaceSidebar } from '@/components/space/SpaceSidebar'

interface SidebarProps {
  className?: string
}

export const Sidebar = memo(function Sidebar({ className }: SidebarProps) {
  const router = useRouter()

  // Use global sidebar state from context
  const { isExpanded, togglePin } = useSidebar()

  // For local UI state that depends on sidebar state
  const isPinned = isExpanded

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
        <SpaceSidebar isExpanded={isExpanded} />
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
    </div>
  )
})
