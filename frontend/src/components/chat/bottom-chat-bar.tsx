'use client'

import { useState, useRef } from 'react'
import { History, MoreVertical, PanelLeft, PanelRight, LayoutPanelTop, MoveHorizontal, StopCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { QueryBar } from './query-bar'
import { useChatLayout } from '@/hooks/chat/use-chat-layout'
import { useCreateMessage } from '@/hooks/chat/use-messages'
import { cn } from '@/lib/utils'

interface BottomChatBarProps {
  spaceId: string
  spaceName: string
  documents?: Array<{ id: string; filename: string }>
  selectedDocumentIds?: string[]
  onDocumentContextChange?: (documentIds: string[]) => void
  className?: string
  // For smart menu options
  hasRightPane?: boolean
  onMoveToTab?: (pane: 'left' | 'right') => void
}

export function BottomChatBar({
  spaceId,
  spaceName,
  documents = [],
  selectedDocumentIds = [],
  onDocumentContextChange,
  className,
  hasRightPane = false,
  onMoveToTab,
}: BottomChatBarProps) {
  const [message, setMessage] = useState('')
  const queryBarRef = useRef<HTMLDivElement>(null)

  const {
    showHistory,
    toggleHistory,
    openHistory,
    moveToTabLeft,
    moveToTabRight,
    moveToBottomLeft,
    moveToBottomRight,
    moveToBottomFull,
    position,
    isBottomFull,
    isBottomLeft,
    isBottomRight,
    isTabLeft,
    isTabRight,
  } = useChatLayout({ spaceId })

  // Handle moving to tab - needs to call parent function to create tab
  const handleMoveToLeftTab = () => {
    if (onMoveToTab) {
      onMoveToTab('left')
    }
    moveToTabLeft()
  }

  const handleMoveToRightTab = () => {
    if (onMoveToTab) {
      onMoveToTab('right')
    }
    moveToTabRight()
  }

  // Use the message creation hook
  const createMessageMutation = useCreateMessage(spaceId)
  const isLoading = createMessageMutation.isPending

  // Handle send
  const handleSend = async () => {
    if (!message.trim() || isLoading) return

    const messageContent = message.trim()
    setMessage('')

    // Auto-open history immediately if in bottom position (full, left, or right)
    if (isBottomFull || isBottomLeft || isBottomRight) {
      openHistory()
    }

    try {
      await createMessageMutation.mutateAsync({
        content: messageContent,
        use_context: true,
        only_space_documents: true,
        top_k: 5,
        document_ids: selectedDocumentIds
      })
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  // Handle stop streaming
  const handleStopStreaming = () => {
    createMessageMutation.stopStreaming()
  }

  return (
    <>
      {/* Bottom bar - transparent background, full width */}
      <div
        className={cn(
          "relative w-full",
          className
        )}
      >
        {/* Centered container for QueryBar - with padding for breathing room */}
        <div className="max-w-4xl mx-auto px-6 py-4">
          {/* QueryBar with white background, rounded, and shadow - positioned relative for history popover */}
          <div ref={queryBarRef} className="relative bg-white rounded-2xl shadow-lg border border-primary/60 shadow-primary/20">
            <QueryBar
              value={message}
              onChange={setMessage}
              onSend={handleSend}
              disabled={isLoading}
              documents={documents}
              selectedDocumentIds={selectedDocumentIds}
              onDocumentContextChange={onDocumentContextChange}
              spaceName={spaceName}
              placeholder="Ask about your documents..."
              className="border-0"
              // History props
              historyProps={{
                spaceId,
                showHistory,
                onToggleHistory: toggleHistory,
                isLoading,
                onStopStreaming: handleStopStreaming,
              }}
              extraLeftButtons={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-[22px] px-2 gap-1.5 text-xs",
                    showHistory && "bg-primary/10 text-primary"
                  )}
                  onClick={toggleHistory}
                >
                  <History className="h-3 w-3" />
                  <span>History</span>
                </Button>
              }
              extraRightButtons={
                <>
                  {/* Stop button when loading */}
                  {isLoading && (
                    <Button
                      onClick={handleStopStreaming}
                      size="sm"
                      variant="destructive"
                      className="h-[22px] px-2 gap-1.5 text-xs"
                    >
                      <StopCircle className="h-3 w-3" />
                      <span>Stop</span>
                    </Button>
                  )}

                  {/* Position menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-[22px] w-[22px] p-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* Move to Left Tab (unless already there) */}
                      {!isTabLeft && (
                        <DropdownMenuItem onClick={handleMoveToLeftTab}>
                          <PanelLeft className="mr-2 h-4 w-4" />
                          Move to Left Tab
                        </DropdownMenuItem>
                      )}

                      {/* Move to Right Tab (unless already there) */}
                      {!isTabRight && (
                        <DropdownMenuItem onClick={handleMoveToRightTab}>
                          <PanelRight className="mr-2 h-4 w-4" />
                          Move to Right Tab
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      {/* Bottom Full (unless already there) */}
                      {!isBottomFull && (
                        <DropdownMenuItem onClick={moveToBottomFull}>
                          <MoveHorizontal className="mr-2 h-4 w-4" />
                          Bottom Full Width
                        </DropdownMenuItem>
                      )}

                      {/* Bottom Left - only show if right pane exists (unless already there) */}
                      {hasRightPane && !isBottomLeft && (
                        <DropdownMenuItem onClick={moveToBottomLeft}>
                          <LayoutPanelTop className="mr-2 h-4 w-4 rotate-90" />
                          Bottom Left
                        </DropdownMenuItem>
                      )}

                      {/* Bottom Right - only show if right pane exists (unless already there) */}
                      {hasRightPane && !isBottomRight && (
                        <DropdownMenuItem onClick={moveToBottomRight}>
                          <LayoutPanelTop className="mr-2 h-4 w-4 -rotate-90" />
                          Bottom Right
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              }
            />
          </div>
        </div>
      </div>

          </>
  )
}
