'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/hooks/use-auth'
import { useMessagesInfinite, useCreateMessage } from '@/hooks/use-messages'
import { MessageResponse } from '@/lib/api'
import { QueryBar } from './query-bar'
import {
  Sparkles,
  Square,
  Edit3,
  Check,
  X as XIcon,
  Copy
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string
  context?: string
}

type ChatState = 'visible' | 'hidden' | 'fullscreen'

interface SpaceChatProps {
  spaceId: string
  spaceName: string
  className?: string
  chatState?: ChatState
  onChatStateChange?: (state: ChatState) => void
  initialMessage?: string
  hideHeader?: boolean
}

// Transform backend MessageResponse to ChatMessage format
const transformMessage = (msg: MessageResponse, role: 'user' | 'assistant' = 'user'): ChatMessage => ({
  id: msg.id,
  content: role === 'user' ? msg.content : (msg.response || msg.content),
  role,
  timestamp: msg.created_at
})

export function SpaceChat({ spaceId, spaceName, className, chatState = 'visible', onChatStateChange, initialMessage, hideHeader = false }: SpaceChatProps) {
  const { user } = useAuth()
  const [inputValue, setInputValue] = useState('')
  const initialMessageSentRef = useRef(false)
  const processedInitialMessageRef = useRef<string | undefined>(undefined)
  const [messageContexts, setMessageContexts] = useState<Record<string, string>>({})
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

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

  // Flatten pages into messages array (newest messages are in first page)
  // const backendMessages = infiniteData?.pages.flatMap(page => page.messages) ?? []

  const backendMessages = infiniteData?.pages
  // 1. Create a shallow copy and reverse the order of the pages array.
  .slice()
  .reverse() 
  // 2. Flatten the reversed array.
  .flatMap(page => page.messages) ?? []

  // Transform backend messages to chat format
  const messages: ChatMessage[] = backendMessages.length > 0 ?
    backendMessages.flatMap((msg, index) => {
      const chatMessages: ChatMessage[] = []

      // Add user message (from content field)
      chatMessages.push(transformMessage(msg, 'user'))

      // Add assistant response if exists (from response field)
      if (msg.response) {
        const responseId = `${msg.id}-response-${index}`
        chatMessages.push({
          id: responseId,
          content: msg.response,
          role: 'assistant',
          timestamp: msg.created_at,
          context: messageContexts[msg.id]
        })
      }

      return chatMessages
    }) : [
      {
        id: 'welcome',
        content: 'Hello! I can help you find information from your documents in this space. What would you like to know?',
        role: 'assistant',
        timestamp: new Date().toISOString()
      }
    ]

  const isLoading = createMessageMutation.isPending
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Track if we're loading more messages to preserve scroll position
  const isLoadingMoreRef = useRef(false)
  const previousMessageCountRef = useRef(0)
  const previousScrollHeightRef = useRef(0)

  // Handle scroll to load older messages - attach listener to viewport
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollContainer) return

    const handleScroll = (event: Event) => {
      const target = event.target as HTMLDivElement
      const scrollTop = target.scrollTop

      // Load more when scrolled near top (within 100px)
      if (scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
        isLoadingMoreRef.current = true
        previousScrollHeightRef.current = scrollContainer.scrollHeight
        fetchNextPage()
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Preserve scroll position when loading older messages
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollContainer || !isLoadingMoreRef.current) return

    const currentScrollHeight = scrollContainer.scrollHeight
    const previousScrollHeight = previousScrollHeightRef.current
    const scrollDiff = currentScrollHeight - previousScrollHeight

    if (scrollDiff > 0) {
      scrollContainer.scrollTop += scrollDiff
    }
  }, [messages])

  // Only scroll to bottom for new messages, not when loading older ones
  useEffect(() => {
    const currentMessageCount = messages.length
    const previousMessageCount = previousMessageCountRef.current

    // Only scroll to bottom if:
    // 1. First load (previousCount is 0)
    // 2. New messages were added at the end (not loading older messages)
    if (previousMessageCount === 0 || (currentMessageCount > previousMessageCount && !isLoadingMoreRef.current)) {
      scrollToBottom()
    }

    // Reset the loading more flag after messages update
    if (isLoadingMoreRef.current && currentMessageCount > previousMessageCount) {
      isLoadingMoreRef.current = false
    }

    previousMessageCountRef.current = currentMessageCount
  }, [messages])

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

      createMessageMutation.mutateAsync({
        content: initialMessage,
        use_context: true,
        only_space_documents: true,
        top_k: 5
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
        document.activeElement === inputRef.current ||
        (document.activeElement && document.activeElement.tagName === 'INPUT') ||
        (document.activeElement && document.activeElement.tagName === 'TEXTAREA')
      ) {
        return
      }

      // If it's a printable character, focus the input and let the character through
      if (e.key.length === 1 && inputRef.current && !isLoading) {
        inputRef.current.focus()
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

    try {
      await createMessageMutation.mutateAsync({
        content: messageContent,
        use_context: true,
        only_space_documents: true,
        top_k: 5
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    const isToday = date.toDateString() === now.toDateString()
    const isYesterday = date.toDateString() === yesterday.toDateString()
    const isThisWeek = (now.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000

    // Get user locale, default to European format if not available
    const userLocale = typeof navigator !== 'undefined' ? navigator.language : 'de-DE'

    const timeStr = date.toLocaleTimeString(userLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

    if (isToday) {
      return timeStr
    } else if (isYesterday) {
      return `Yesterday, ${timeStr}`
    } else if (isThisWeek) {
      const dayName = date.toLocaleDateString(userLocale, { weekday: 'long' })
      return `${dayName}, ${timeStr}`
    } else {
      // European format DD.MM.YYYY
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}.${month}.${year}, ${timeStr}`
    }
  }

  // Edit message handlers
  const handleStartEdit = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId)
    setEditValue(currentContent)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditValue('')
  }

  const handleSaveEdit = async (messageId: string) => {
    if (!editValue.trim() || editValue === editingMessageId) return

    try {
      const currentEditValue = editValue.trim()

      setEditingMessageId(null)
      setEditValue('')

      await createMessageMutation.mutateAsync({
        content: currentEditValue,
        use_context: true,
        only_space_documents: true,
        top_k: 5
      })
    } catch (error) {
      setEditingMessageId(messageId)
      setEditValue(editValue)
    }
  }

  // Copy message content
  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
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

      {/* Messages - Centered container for wide layouts */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="p-4 flex justify-center">
            <div className="space-y-4 w-full" style={{ maxWidth: 'min(100%, 800px)' }}>
          {/* Loading indicator for older messages */}
          {isFetchingNextPage && (
            <div className="flex justify-center py-2">
              <Spinner size="sm" />
            </div>
          )}

          {messages.map((message: ChatMessage) => {
            if (message.role === 'user') {
              // User messages with edit functionality
              const isEditing = editingMessageId === message.id

              return (
                <div key={message.id} className="flex gap-3 max-w-full justify-end">
                  <div className="rounded-lg px-3 py-2 max-w-[80%] bg-white border border-primary/20 ml-auto group relative">
                    {isEditing ? (
                      // Edit mode
                      <div className="space-y-3">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full text-sm resize-none border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-w-[300px]"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(message.id)}
                            disabled={!editValue.trim() || editValue === message.content}
                            className="h-7 px-3 text-xs"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Save & Re-generate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelEdit()}
                            className="h-7 px-3 text-xs"
                          >
                            <XIcon className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Display mode
                      <>
                        {/* Edit button - positioned outside bubble, top right with outline */}
                        <button
                          onClick={() => handleStartEdit(message.id, message.content)}
                          className="absolute -top-6 right-0 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 px-2 py-1 rounded group-hover:outline group-hover:outline-1 group-hover:outline-border"
                        >
                          Edit
                        </button>

                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatTime(message.timestamp)}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )
            } else {
              // AI messages: clean full-width layout with padding
              return (
                <div key={message.id} className="w-full space-y-2 group">
                  {/* AI Response */}
                  <div className="w-full px-4">
                    <article className="prose prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:font-bold prose-strong:text-gray-900 prose-code:bg-gray-100 prose-code:text-gray-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-3 prose-pre:rounded prose-pre:text-xs">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </article>
                  </div>

                  {/* Copy button - below content, left aligned */}
                  <div className="w-full px-4">
                    <button
                      onClick={() => handleCopyMessage(message.id, message.content)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-2 py-1 rounded hover:bg-gray-100 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      title="Copy message"
                    >
                      {copiedMessageId === message.id ? (
                        <>
                          <Check className="w-3 h-3 text-green-600" />
                          <span className="text-green-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Context Section */}
                  {message.context && (
                    <div className="w-full">
                      <div className="mb-2">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Context Used
                        </h4>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                        <details className="group">
                          <summary className="cursor-pointer text-xs text-amber-700 hover:text-amber-800 font-medium">
                            Click to view context ({message.context.length} characters)
                          </summary>
                          <div className="mt-2 pt-2 border-t border-amber-200">
                            <pre className="text-xs text-amber-800 whitespace-pre-wrap font-mono bg-amber-100 p-2 rounded max-h-40 overflow-y-auto">
                              {message.context}
                            </pre>
                          </div>
                        </details>
                      </div>
                    </div>
                  )}
                </div>
              )
            }
          })}
          
          {isLoading && (
            <div className="w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Spinner size="sm" />
                  <span className="text-sm text-muted-foreground">
                    {createMessageMutation.isPending
                      ? "Streaming response..."
                      : "Analyzing your documents..."
                    }
                  </span>
                </div>

                {createMessageMutation.isPending && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      createMessageMutation.stopStreaming()
                    }}
                    className="h-8 px-3 text-xs"
                  >
                    <Square className="w-3 h-3 mr-1" />
                    Stop
                  </Button>
                )}
              </div>
            </div>
          )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Input - Claude AI style, centered for wide layouts */}
      <div className="p-4 bg-background flex justify-center">
        <QueryBar
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          contextText={`All documents in ${spaceName}`}
          disabled={isLoading}
          variant="default"
          className="relative bg-white border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow w-full max-w-[min(100%,1200px)]"
          style={{ width: 'min(100%, 800px)' }}
        />
      </div>
    </div>
  )
}