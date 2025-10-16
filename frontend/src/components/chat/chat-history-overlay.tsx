'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessages } from './chat-messages'
import { useMessagesInfinite } from '@/hooks/chat/use-messages'
import { useInfiniteScroll } from '@/hooks/chat/use-infinite-scroll'
import { useChatMessages } from '@/hooks/chat/use-chat-messages'
import { cn } from '@/lib/utils'
import { chatLogger } from '@/utils/logger'

interface ChatHistoryOverlayProps {
  spaceId: string
  onClose: () => void
  className?: string
  anchorRef: React.RefObject<HTMLElement>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  isLoading?: boolean
  onStopStreaming?: () => void
}

export function ChatHistoryOverlay({
  spaceId,
  onClose,
  className,
  anchorRef,
  isOpen,
  onOpenChange,
  isLoading = false,
  onStopStreaming,
}: ChatHistoryOverlayProps) {
  // Focus management: focus popover when opened
  useEffect(() => {
    if (isOpen && popoverRef.current) {
      popoverRef.current.focus();
    }
  }, [isOpen]);
  const popoverRef = useRef<HTMLDivElement>(null)

  // State for message actions
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Copy message handler
  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (err) {
      chatLogger.error('Failed to copy message to clipboard in history overlay', err, {
        action: 'copyMessageHistory',
        messageId,
        contentLength: content.length,
        spaceId
      })
    }
  }

  // Edit handlers
  const handleStartEdit = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId)
    setEditValue(currentContent)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditValue('')
  }

  const handleSaveEdit = async (messageId: string, newContent: string) => {
    // In history view, we don't allow actual editing
    // This would require API integration to update the message
    handleCancelEdit()
  }

  const handleUpdateEditValue = (value: string) => {
    setEditValue(value)
  }

  // Fetch messages with infinite scroll
  const {
    data: infiniteData,
    isLoading: isLoadingMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessagesInfinite(spaceId, 20)

  // Use the infinite scroll hook
  const { scrollAreaRef, isLoadingMore } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  })

  // Flatten pages into messages array
  const backendMessages = infiniteData?.pages
    .slice()
    .reverse()
    .flatMap(page => page.messages) ?? []

  // Use the chat messages hook
  const {
    messages,
    formatTime
  } = useChatMessages({
    backendMessages,
    messageContexts: {}
  })

  // Handle Esc key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onOpenChange])

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onOpenChange, anchorRef])
  
  // Auto-scroll to bottom when popover opens and when messages change
  useEffect(() => {
    if (scrollAreaRef.current && isOpen) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        // Multiple attempts to ensure scroll happens after content is rendered
        const scrollToBottom = () => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }

        // Immediate scroll
        scrollToBottom()

        // Delayed scroll to ensure content is fully rendered
        setTimeout(scrollToBottom, 100)

        // Final scroll attempt for any late-rendering content
        setTimeout(scrollToBottom, 300)
      }
    }
  }, [messages.length, scrollAreaRef, isOpen])

  if (!isOpen) return null;
  return (
    <div
      ref={popoverRef}
      className={cn(
        "bg-white overflow-hidden rounded-2xl border border-border",
        className
      )}
      style={{
        height: '640px',
      }}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-label="Chat History"
    >
      {/* Messages - full height with scrollable content */}
      {isLoadingMessages ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-muted-foreground">Loading messages...</div>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start a conversation to see your chat history</p>
          </div>
        </div>
      ) : (
        <ScrollArea ref={scrollAreaRef} className="h-full rounded-2xl">
          <div className="px-4 py-3">
            <ChatMessages
              messages={messages}
              editingMessageId={editingMessageId}
              editValue={editValue}
              copiedMessageId={copiedMessageId}
              isLoadingMore={isLoadingMore}
              isLoading={isLoading}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onUpdateEditValue={handleUpdateEditValue}
              onCopyMessage={handleCopyMessage}
              onStopStreaming={onStopStreaming}
              formatTime={formatTime}
            />
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
