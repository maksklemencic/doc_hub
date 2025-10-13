'use client'

import { X, PanelRightOpen, PanelLeftOpen, MoveDown, LayoutPanelTop, MoveHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRef } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TabDocumentType, TabType, iconMap, colorMap } from '@/utils/tab-utils'

export type DocumentType = TabDocumentType

export interface Tab {
  id: string
  title: string
  type: TabType
  isActive: boolean
  closable?: boolean
  initialMessage?: string
}

interface TabBarProps {
  tabs: Tab[]
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
  pane?: 'left' | 'right'
  onSplitRight?: (tabId: string) => void
  onMoveToLeft?: (tabId: string) => void
  isOnlyTabInPane?: (tabId: string) => boolean
  onTabDragToOtherPane?: (tabId: string, targetPane: 'left' | 'right') => void
  onTabReorder?: (tabId: string, newIndex: number) => void
  isDragging?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  // Chat-specific handlers
  onMoveChatToBottom?: (position: 'bottom-full' | 'bottom-left' | 'bottom-right') => void
  hasRightPane?: boolean
}

// Sortable Tab Item Component
function SortableTab({
  tab,
  isOnlyTab,
  pane,
  onTabClick,
  onTabClose,
  onSplitRight,
  onMoveToLeft,
  onMoveChatToBottom,
  hasRightPane,
}: {
  tab: Tab
  isOnlyTab: boolean
  pane: 'left' | 'right'
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onSplitRight?: (tabId: string) => void
  onMoveToLeft?: (tabId: string) => void
  onMoveChatToBottom?: (position: 'bottom-full' | 'bottom-left' | 'bottom-right') => void
  hasRightPane?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, disabled: tab.id === 'documents' })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const Icon = iconMap[tab.type]
  const colorClass = colorMap[tab.type]

  const isDocumentsTab = tab.id === 'documents'

  const tabButton = (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isDocumentsTab ? {} : listeners)}
      onClick={() => onTabClick(tab.id)}
      className={cn(
        'group flex items-center gap-2 px-3 h-8 rounded-md transition-all duration-150 flex-shrink-0 min-w-0 max-w-[200px]',
        'hover:bg-muted',
        tab.isActive
          ? 'bg-background border border-border shadow-sm'
          : 'bg-transparent',
        isDragging && 'cursor-grabbing',
        !isDocumentsTab && 'cursor-grab'
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', colorClass)} />
      <span className="text-sm truncate flex-1 min-w-0">
        {tab.title}
      </span>
      {tab.closable !== false && (
        <div
          className={cn(
            'h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 flex items-center justify-center rounded cursor-pointer',
            'hover:bg-destructive/10 hover:text-destructive'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onTabClose(tab.id)
          }}
        >
          <X className="h-3 w-3" />
        </div>
      )}
    </button>
  )

  // Don't add context menu to the documents tab
  if (tab.id === 'documents') {
    return tabButton
  }

  const isChatTab = tab.type === 'ai-chat'

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {tabButton}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {/* Regular tab options */}
        {!isChatTab && pane === 'left' && onSplitRight && (
          <ContextMenuItem
            onClick={() => onSplitRight(tab.id)}
            className="focus:bg-teal-50 focus:text-teal-900"
          >
            <PanelRightOpen className="mr-2 h-4 w-4" />
            Split Right
          </ContextMenuItem>
        )}
        {!isChatTab && pane === 'right' && onMoveToLeft && (
          <ContextMenuItem
            onClick={() => onMoveToLeft(tab.id)}
            className="focus:bg-teal-50 focus:text-teal-900"
          >
            <PanelLeftOpen className="mr-2 h-4 w-4" />
            Move to Left
          </ContextMenuItem>
        )}

        {/* Chat-specific options */}
        {isChatTab && onMoveChatToBottom && (
          <>
            <ContextMenuItem onClick={() => onMoveChatToBottom('bottom-full')}>
              <MoveHorizontal className="mr-2 h-4 w-4" />
              Move to Bottom Full
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onMoveChatToBottom('bottom-left')}>
              <LayoutPanelTop className="mr-2 h-4 w-4 rotate-90" />
              Move to Bottom Left
            </ContextMenuItem>
            {/* Only show bottom-right if:
                - Right pane exists (hasRightPane)
                - AND we're NOT in right pane OR we're not the only tab in right pane */}
            {hasRightPane && (pane === 'left' || !isOnlyTab) && (
              <ContextMenuItem onClick={() => onMoveChatToBottom('bottom-right')}>
                <LayoutPanelTop className="mr-2 h-4 w-4 -rotate-90" />
                Move to Bottom Right
              </ContextMenuItem>
            )}
          </>
        )}

        {tab.closable !== false && (
          <>
            {((pane === 'left' && onSplitRight) || (pane === 'right' && onMoveToLeft) || isChatTab) ? (
              <ContextMenuSeparator />
            ) : null}
            <ContextMenuItem
              onClick={() => onTabClose(tab.id)}
              className="text-destructive focus:bg-red-50 focus:text-destructive"
            >
              <X className="mr-2 h-4 w-4" />
              Close
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function TabBar({
  tabs,
  onTabClick,
  onTabClose,
  pane = 'left',
  onSplitRight,
  onMoveToLeft,
  isOnlyTabInPane,
  onTabDragToOtherPane,
  onTabReorder,
  isDragging,
  onMoveChatToBottom,
  hasRightPane,
}: TabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Make this tab bar a droppable zone
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `tabbar-${pane}`,
    data: {
      pane,
    },
  })

  return (
    <div
      ref={setDroppableRef}
      className={cn(
        "h-10 bg-card border-b border-border flex items-center relative transition-colors",
        isOver && "bg-teal-50/50"
      )}
    >
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin px-2 flex-1"
      >
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          {tabs.map((tab) => {
            const isOnlyTab = isOnlyTabInPane?.(tab.id) ?? false
            return (
              <SortableTab
                key={tab.id}
                tab={tab}
                isOnlyTab={isOnlyTab}
                pane={pane}
                onTabClick={onTabClick}
                onTabClose={onTabClose}
                onSplitRight={onSplitRight}
                onMoveToLeft={onMoveToLeft}
                onMoveChatToBottom={onMoveChatToBottom}
                hasRightPane={hasRightPane}
              />
            )
          })}
        </SortableContext>
      </div>
    </div>
  )
}
