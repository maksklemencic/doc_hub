'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/hooks/use-auth'
import { useMessages, useCreateMessage } from '@/hooks/use-messages'
import { MessageResponse } from '@/lib/api'
import {
  Send,
  Sparkles,
  Minimize2,
  Maximize2,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

// Transform backend MessageResponse to ChatMessage format
const transformMessage = (msg: MessageResponse, role: 'user' | 'assistant' = 'user'): ChatMessage => ({
  id: msg.id,
  content: role === 'user' ? msg.content : (msg.response || msg.content),
  role,
  timestamp: msg.created_at
})

export function SpaceChat({ spaceId, spaceName, className, chatState = 'visible', onChatStateChange }: SpaceChatProps) {
  const { user } = useAuth()
  const [inputValue, setInputValue] = useState('')
  const [messageContexts, setMessageContexts] = useState<Record<string, string>>({})

  // Fetch messages and mutation hooks
  const { data: messagesData, isLoading: isLoadingMessages, error } = useMessages(spaceId)
  const createMessageMutation = useCreateMessage(spaceId)


  // Transform backend messages to chat format
  const messages: ChatMessage[] = messagesData?.messages ?
    messagesData.messages.flatMap(msg => {
      const chatMessages: ChatMessage[] = []

      // Add user message
      chatMessages.push(transformMessage(msg, 'user'))

      // Add assistant response if exists
      if (msg.response) {
        const responseId = `${msg.id}-response`
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

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
      const response = await createMessageMutation.mutateAsync({
        content: messageContent,
        use_context: true,
        only_space_documents: true,
        top_k: 5
      })

      console.log('✅ Message sent successfully:', response)
      console.log('📥 Received response data:', response.data)
      console.log('💬 Message object:', response.message)

      // Store context for displaying with the response
      if (response?.data?.context && response?.message?.id) {
        setMessageContexts(prev => ({
          ...prev,
          [response.message.id]: response.data.context
        }))
      }
    } catch (error) {
      console.error('Failed to send message:', error)
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
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", chatState !== 'fullscreen' && "border-l", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-muted/20">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Space Assistant</h3>
          <p className="text-xs text-muted-foreground">Ask about documents in {spaceName}</p>
        </div>
        
        {/* Chat Controls */}
        <div className="flex items-center gap-1">
          {chatState === 'fullscreen' ? (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onChatStateChange?.('visible')}
              className="h-8 w-8 p-0"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onChatStateChange?.('fullscreen')}
              className="h-8 w-8 p-0"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onChatStateChange?.('hidden')}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full p-4">
          <div className="space-y-4">
          {messages.map((message: ChatMessage) => {
            if (message.role === 'user') {
              // Keep user messages as chat bubbles
              return (
                <div key={message.id} className="flex gap-3 max-w-full justify-end">
                  <div className="rounded-lg px-3 py-2 max-w-[80%] bg-white border border-primary/20 ml-auto">
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )
            } else {
              // AI messages: clean full-width layout
              return (
                <div key={message.id} className="w-full space-y-4">
                  {/* AI Response */}
                  <div className="w-full">
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                    <p className="text-xs opacity-70 mt-1">
                      {formatTime(message.timestamp)}
                    </p>
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
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-sm text-muted-foreground">Analyzing your documents...</span>
              </div>
            </div>
          )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about documents in this space..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}