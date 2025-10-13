'use client'

import { TabBar, Tab } from '@/components/shared/tab-bar'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { iconMap, colorMap } from '@/utils/tab-utils'

interface SplitPaneViewProps {
  leftTabs: Tab[]
  rightTabs?: Tab[]
  spaceId: string // For loading layout - forces remount via key prop
  onTabClick: (tabId: string, pane: 'left' | 'right') => void
  onTabClose: (tabId: string, pane: 'left' | 'right') => void
  onSplitRight?: (tabId: string) => void
  onMoveToLeft?: (tabId: string) => void
  onTabReorderLeft?: (tabId: string, newIndex: number) => void
  onTabReorderRight?: (tabId: string, newIndex: number) => void
  onTabDragBetweenPanes?: (tabId: string, fromPane: 'left' | 'right', toPane: 'left' | 'right') => void
  onPanelResize?: () => void
  onLeftPaneWidthChange?: (width: number) => void // Callback to report left pane width
  children: React.ReactNode
  rightContent?: React.ReactNode
  // Bottom chat positioning
  bottomChatLeft?: React.ReactNode
  bottomChatRight?: React.ReactNode
  bottomChatFull?: React.ReactNode
  // Chat tab context menu handler
  onMoveChatToBottom?: (position: 'bottom-full' | 'bottom-left' | 'bottom-right') => void
}

export function SplitPaneView({
  leftTabs,
  rightTabs,
  spaceId,
  onTabClick,
  onTabClose,
  onSplitRight,
  onMoveToLeft,
  onTabReorderLeft,
  onTabReorderRight,
  onTabDragBetweenPanes,
  onPanelResize,
  onLeftPaneWidthChange,
  children,
  rightContent,
  bottomChatLeft,
  bottomChatRight,
  bottomChatFull,
  onMoveChatToBottom,
}: SplitPaneViewProps) {
  const hasSplit = !!(rightTabs && rightTabs.length > 0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showRightDropZone, setShowRightDropZone] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftPaneRef = useRef<HTMLDivElement>(null)
  const mouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null)
  const mouseUpHandlerRef = useRef<(() => void) | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Track left pane width and report changes via callback
  useEffect(() => {
    if (!onLeftPaneWidthChange) return

    const pane = leftPaneRef.current
    if (!pane) return

    // Initial measurement
    const reportWidth = () => {
      const width = pane.getBoundingClientRect().width
      if (width > 0) {
        onLeftPaneWidthChange(width)
      }
    }

    // Report initial width after a brief delay to ensure layout is ready
    const timeout = setTimeout(reportWidth, 0)

    // Set up ResizeObserver for dynamic updates
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry && entry.contentRect.width > 0) {
        onLeftPaneWidthChange(entry.contentRect.width)
      }
    })

    resizeObserver.observe(pane)

    return () => {
      clearTimeout(timeout)
      resizeObserver.disconnect()
    }
  }, [onLeftPaneWidthChange, hasSplit]) // Re-run when split mode changes

  useEffect(() => {
    return () => {
      if (mouseMoveHandlerRef.current) {
        document.removeEventListener('mousemove', mouseMoveHandlerRef.current)
      }
      if (mouseUpHandlerRef.current) {
        document.removeEventListener('mouseup', mouseUpHandlerRef.current)
      }
    }
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)

    const handleMouseMove = (e: MouseEvent) => {
      if (!hasSplit && containerRef.current) {
        const isDraggingFromLeft = leftTabs.find(t => t.id === event.active.id)
        if (!isDraggingFromLeft) return

        const rect = containerRef.current.getBoundingClientRect()
        const mouseX = e.clientX
        const mouseY = e.clientY
        const threshold80Percent = rect.left + (rect.width * 0.8)

        const isBelowTabBar = mouseY > rect.top + 40
        const isPastThreshold = mouseX > threshold80Percent

        setShowRightDropZone(isPastThreshold && isBelowTabBar)
      }
    }

    const handleMouseUp = () => {
      if (mouseMoveHandlerRef.current) {
        document.removeEventListener('mousemove', mouseMoveHandlerRef.current)
        mouseMoveHandlerRef.current = null
      }
      if (mouseUpHandlerRef.current) {
        document.removeEventListener('mouseup', mouseUpHandlerRef.current)
        mouseUpHandlerRef.current = null
      }
    }

    mouseMoveHandlerRef.current = handleMouseMove
    mouseUpHandlerRef.current = handleMouseUp

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!hasSplit && showRightDropZone && onSplitRight) {
      const isDraggingFromLeft = leftTabs.find(t => t.id === active.id)
      if (isDraggingFromLeft) {
        onSplitRight(active.id as string)
        setActiveId(null)
        setShowRightDropZone(false)
        return
      }
    }

    if (!over) {
      setActiveId(null)
      setShowRightDropZone(false)
      return
    }

    // Check if dropped on another pane's tab bar
    if (over.id === 'tabbar-left' || over.id === 'tabbar-right') {
      const targetPane = over.id === 'tabbar-left' ? 'left' : 'right'
      const sourcePane = leftTabs.find(t => t.id === active.id) ? 'left' : 'right'

      if (sourcePane !== targetPane && onTabDragBetweenPanes) {
        onTabDragBetweenPanes(active.id as string, sourcePane, targetPane)
      }
    } else if (active.id !== over.id) {
      // Reordering within the same pane
      const isInLeftPane = leftTabs.find(t => t.id === active.id)
      const isOverInLeftPane = leftTabs.find(t => t.id === over.id)

      if (isInLeftPane && isOverInLeftPane && onTabReorderLeft) {
        const oldIndex = leftTabs.findIndex((t) => t.id === active.id)
        const newIndex = leftTabs.findIndex((t) => t.id === over.id)

        // Prevent reordering documents tab or placing tabs before it
        const activeTab = leftTabs[oldIndex]
        const documentsIndex = leftTabs.findIndex((t) => t.id === 'documents')

        if (activeTab?.id !== 'documents' && newIndex > documentsIndex) {
          onTabReorderLeft(active.id as string, newIndex)
        }
      } else if (!isInLeftPane && !isOverInLeftPane && onTabReorderRight && rightTabs) {
        const oldIndex = rightTabs.findIndex((t) => t.id === active.id)
        const newIndex = rightTabs.findIndex((t) => t.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          onTabReorderRight(active.id as string, newIndex)
        }
      }
    }

    setActiveId(null)
    setShowRightDropZone(false)
  }

  const activeTab = [...leftTabs, ...(rightTabs || [])].find((t) => t.id === activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
        {hasSplit ? (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={50} minSize={30} onResize={onPanelResize}>
              <div ref={leftPaneRef} className="h-full flex flex-col relative">
                <TabBar
                  tabs={leftTabs}
                  pane="left"
                  onTabClick={(id) => onTabClick(id, 'left')}
                  onTabClose={(id) => onTabClose(id, 'left')}
                  onSplitRight={onSplitRight}
                  onTabReorder={onTabReorderLeft}
                  isDragging={!!activeId}
                  onMoveChatToBottom={onMoveChatToBottom}
                  hasRightPane={hasSplit}
                />
                <div className="flex-1 overflow-hidden">{children}</div>
                {/* Bottom chat in left pane only */}
                {bottomChatLeft && (
                  <div className="absolute bottom-0 left-0 right-0 z-10">
                    {bottomChatLeft}
                  </div>
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={50} minSize={30} onResize={onPanelResize}>
              <div className="h-full flex flex-col relative">
                <TabBar
                  tabs={rightTabs}
                  pane="right"
                  onTabClick={(id) => onTabClick(id, 'right')}
                  onTabClose={(id) => onTabClose(id, 'right')}
                  onMoveToLeft={onMoveToLeft}
                  isOnlyTabInPane={(tabId) => rightTabs.length === 1}
                  onTabReorder={onTabReorderRight}
                  isDragging={!!activeId}
                  onMoveChatToBottom={onMoveChatToBottom}
                  hasRightPane={hasSplit}
                />
                <div className="flex-1 overflow-hidden">{rightContent}</div>
                {/* Bottom chat in right pane only */}
                {bottomChatRight && (
                  <div className="absolute bottom-0 left-0 right-0 z-10">
                    {bottomChatRight}
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div ref={leftPaneRef} className="h-full flex flex-col relative">
            <TabBar
              tabs={leftTabs}
              pane="left"
              onTabClick={(id) => onTabClick(id, 'left')}
              onTabClose={(id) => onTabClose(id, 'left')}
              onSplitRight={onSplitRight}
              onTabReorder={onTabReorderLeft}
              isDragging={!!activeId}
              onMoveChatToBottom={onMoveChatToBottom}
              hasRightPane={hasSplit}
            />
            <div className="flex-1 overflow-hidden">{children}</div>
            {/* Bottom chat in single pane / full width */}
            {(bottomChatLeft || bottomChatFull) && (
              <div className="absolute bottom-0 left-0 right-0 z-10">
                {bottomChatLeft || bottomChatFull}
              </div>
            )}
          </div>
        )}

        {/* Bottom chat full width - spans entire container when split */}
        {hasSplit && bottomChatFull && (
          <div className="absolute bottom-0 left-0 right-0 z-10">
            {bottomChatFull}
          </div>
        )}

        {/* Visual drop zone indicator for right pane when dragging */}
        {showRightDropZone && !hasSplit && (
          <div className="absolute top-10 left-0 right-0 bottom-0 pointer-events-none flex z-50">
            {/* Left 50% - transparent */}
            <div className="flex-1" />
            {/* Right 50% - highlighted drop zone */}
            <div className="flex-1 bg-teal-50/80 border-l-2 border-teal-400" />
          </div>
        )}
      </div>
      <DragOverlay>
        {activeTab ? (
          <div className="bg-background border border-border shadow-lg px-3 h-8 rounded-md flex items-center gap-2 max-w-[200px]">
            {(() => {
              const Icon = iconMap[activeTab.type]
              const colorClass = colorMap[activeTab.type]
              return (
                <>
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', colorClass)} />
                  <span className="text-sm truncate">{activeTab.title}</span>
                </>
              )
            })()}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
