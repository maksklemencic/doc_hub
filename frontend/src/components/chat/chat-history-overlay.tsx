'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ChatMessages } from './chat-messages'
import { useMessagesInfinite } from '@/hooks/chat/use-messages'
import { useInfiniteScroll } from '@/hooks/chat/use-infinite-scroll'
import { useChatMessages } from '@/hooks/chat/use-chat-messages'
import { cn } from '@/lib/utils'

interface ChatHistoryOverlayProps {
  spaceId: string
  onClose: () => void
  className?: string
  anchorRef: React.RefObject<HTMLElement>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ChatHistoryOverlay({
  spaceId,
  onClose,
  className,
  anchorRef,
  isOpen,
  onOpenChange,
}: ChatHistoryOverlayProps) {
  // Focus management: focus popover when opened
  useEffect(() => {
    if (isOpen && popoverRef.current) {
      popoverRef.current.focus();
    }
  }, [isOpen]);
  const popoverRef = useRef<HTMLDivElement>(null)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})

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
  // Position popover ABOVE anchor, like context popover
  useEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    const anchorRect = anchorRef.current.getBoundingClientRect();
    // Calculate position above anchor
    const bottom = window.innerHeight - anchorRect.top + window.scrollY + 8;
    const left = anchorRect.left + window.scrollX;
    const width = anchorRect.width;

    setPopoverStyle({
      position: 'absolute',
      bottom: `${bottom}px`,
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: '480px',
      zIndex: 50,
    });
  }, [isOpen, anchorRef]);

  // Auto-scroll to bottom on mount
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }, 100)
      }
    }
  }, [messages.length])

  if (!isOpen) return null;
  return (
    <div
      ref={popoverRef}
      className={cn(
        "bg-background/98 border border-border rounded-2xl shadow-2xl",
        isOpen ? "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-300" : "animate-out fade-out-0 zoom-out-95 slide-out-to-bottom-2 duration-200",
        className
      )}
      style={popoverStyle}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-label="Chat History"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Chat History</h3>
            <p className="text-xs text-muted-foreground">
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 64px)' }}>
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start a conversation to see your chat history</p>
            </div>
          </div>
        ) : (
          <ScrollArea ref={scrollAreaRef} className="h-full">
            <ChatMessages
              messages={messages}
              editingMessageId={null}
              editValue=""
              copiedMessageId={null}
              isLoadingMore={isLoadingMore}
              isLoading={false}
              onStartEdit={() => {}}
              onCancelEdit={() => {}}
              onSaveEdit={() => Promise.resolve()}
              onUpdateEditValue={() => {}}
              onCopyMessage={() => {}}
              onStopStreaming={() => {}}
              formatTime={formatTime}
            />
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
