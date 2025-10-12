'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/auth/use-auth'
import { useMessagesInfinite, useCreateMessage } from '@/hooks/chat/use-messages'
import { useInfiniteScroll } from '@/hooks/chat/use-infinite-scroll'
import { useChatMessages } from '@/hooks/chat/use-chat-messages'
import { useSpacesContext } from '@/contexts/spaces-context'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'

type ChatState = 'visible' | 'hidden' | 'fullscreen'

interface SpaceChatProps {
  spaceId: string
  spaceName: string
  className?: string
  chatState?: ChatState
  onChatStateChange?: (state: ChatState) => void
  initialMessage?: string
  hideHeader?: boolean
  documents?: Array<{ id: string; filename: string }>
}

export function SpaceChat({ spaceId, spaceName, className, chatState = 'visible', onChatStateChange, initialMessage, hideHeader = false, documents = [] }: SpaceChatProps) {
  const { user } = useAuth()
  const { getSpaceContext, setSpaceContext } = useSpacesContext()
  const [inputValue, setInputValue] = useState('')
  const initialMessageSentRef = useRef(false)
  const processedInitialMessageRef = useRef<string | undefined>(undefined)
  const [messageContexts, setMessageContexts] = useState<Record<string, string>>({})
  const [editValue, setEditValue] = useState('')

  // Get context for this space
  const selectedDocumentIds = getSpaceContext(spaceId)

  // Fetch messages with infinite scroll and mutation hooks
  const {
    data: infiniteData,
    isLoading: isLoadingMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error
  } = useMessagesInfinite(spaceId, 20)
  const createMessageMutation = useCreateMessage(spaceId)

  // Use the infinite scroll hook
  const { scrollAreaRef, isLoadingMore } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  })

  // Flatten pages into messages array (newest messages are in first page)
  const backendMessages = infiniteData?.pages
    .slice()
    .reverse()
    .flatMap(page => page.messages) ?? []

  // Use the chat messages hook
  const {
    messages,
    editingMessageId,
    copiedMessageId,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleCopyMessage,
    formatTime
  } = useChatMessages({
    backendMessages,
    messageContexts
  })

  const isLoading = createMessageMutation.isPending

  // Track previous message count for scroll-to-bottom logic
  const previousMessageCountRef = useRef(0)

  // Scroll to bottom functionality
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }, 100)
      }
    }
  }

  // Auto-scroll to bottom when new messages arrive (but not when loading older messages)
  useEffect(() => {
    const currentMessageCount = messages.length
    const previousMessageCount = previousMessageCountRef.current

    // Only scroll to bottom if:
    // 1. First load (previousCount is 0)
    // 2. New messages were added at the end (not loading older messages)
    if (previousMessageCount === 0 || (currentMessageCount > previousMessageCount && !isLoadingMore)) {
      scrollToBottom()
    }

    previousMessageCountRef.current = currentMessageCount
  }, [messages, isLoadingMore])

  // Initial scroll to bottom when chat opens with messages
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages.length])

  // Send initial message if provided - using ref to prevent double sends
  useEffect(() => {
    // Only send if:
    // 1. We have an initial message
    // 2. We haven't sent this exact message before
    // 3. We're not already sending a message
    // 4. Messages have finished loading (important for context!)
    if (
      initialMessage &&
      !initialMessageSentRef.current &&
      processedInitialMessageRef.current !== initialMessage &&
      !createMessageMutation.isPending &&
      !isLoadingMessages
    ) {
      initialMessageSentRef.current = true
      processedInitialMessageRef.current = initialMessage

      console.log('Sending message with context from documents:', selectedDocumentIds.map(id => documents.find(d => d.id === id)?.filename || id))
      console.log('Document IDs being sent:', selectedDocumentIds)
      console.log('Total documents in space:', documents.length)

      createMessageMutation.mutateAsync({
        content: initialMessage,
        use_context: true,
        only_space_documents: true,
        top_k: 5,
        document_ids: selectedDocumentIds
      }).catch((error) => {
        initialMessageSentRef.current = false
      })
    }
  }, [initialMessage, createMessageMutation, isLoadingMessages])

  // Auto-focus input when typing
  useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't interfere with special keys, shortcuts, or if already focused on input
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      e.key === 'Tab' ||
      e.key === 'Enter' ||
      e.key === 'Escape' ||
      e.key.startsWith('Arrow') ||
      e.key.startsWith('F') ||
      (document.activeElement && document.activeElement.tagName === 'INPUT') ||
      (document.activeElement && document.activeElement.tagName === 'TEXTAREA')
    ) {
      return
    }

    // If it's a printable character and input is not loading, focus it
    if (e.key.length === 1 && !isLoading) {
      // The input will be focused within the ChatInput component
      // Don't prevent default - let the character be typed in the input
    }
  }

    // Only add listener when chat is visible
    if (chatState !== 'hidden') {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [chatState, isLoading])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    const messageContent = inputValue.trim()
    setInputValue('')

    console.log('Sending message with context from documents:', selectedDocumentIds.map(id => documents.find(d => d.id === id)?.filename || id))
    console.log('Document IDs being sent:', selectedDocumentIds)
    console.log('Total documents in space:', documents.length)

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Enhanced edit handlers that work with the hook
  const handleSaveEditMessage = async (messageId: string, editContent: string) => {
    setEditValue(editContent)

    console.log('Sending edited message with context from documents:', selectedDocumentIds.map(id => documents.find(d => d.id === id)?.filename || id))
    console.log('Document IDs being sent:', selectedDocumentIds)
    console.log('Total documents in space:', documents.length)

    try {
      await createMessageMutation.mutateAsync({
        content: editContent,
        use_context: true,
        only_space_documents: true,
        top_k: 5,
        document_ids: selectedDocumentIds
      })
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  const handleStopStreaming = () => {
    createMessageMutation.stopStreaming()
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", chatState !== 'fullscreen' && "border-l", className)}>
      {/* Header - Simple and matching toolbar height */}
      {!hideHeader && (
        <div className="flex items-center gap-3 px-6 h-[52px] border-b border-border bg-background">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">AI Chat</h3>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <ChatMessages
            messages={messages}
            editingMessageId={editingMessageId}
            editValue={editValue}
            copiedMessageId={copiedMessageId}
            isLoadingMore={isLoadingMore}
            isLoading={isLoading}
            onStartEdit={handleStartEdit}
            onCancelEdit={handleCancelEdit}
            onSaveEdit={handleSaveEditMessage}
            onUpdateEditValue={setEditValue}
            onCopyMessage={handleCopyMessage}
            onStopStreaming={handleStopStreaming}
            formatTime={formatTime}
          />
        </ScrollArea>
      </div>

      {/* Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={isLoading}
        documents={documents}
        selectedDocumentIds={selectedDocumentIds}
        onDocumentContextChange={(documentIds) => setSpaceContext(spaceId, documentIds)}
        spaceName={spaceName}
      />
    </div>
  )
}
