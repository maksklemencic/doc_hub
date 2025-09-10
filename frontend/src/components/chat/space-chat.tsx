'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/use-auth'
import { 
  Send,
  Bot,
  User,
  FileText,
  Sparkles,
  MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string
  sources?: string[]
}

interface SpaceChatProps {
  spaceName: string
  className?: string
}

const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    content: 'Hello! I can help you find information from your documents in this space. What would you like to know?',
    role: 'assistant',
    timestamp: '2024-01-15T10:30:00Z'
  }
]

export function SpaceChat({ spaceName, className }: SpaceChatProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
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

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      role: 'user',
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Simulate API call
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Based on the documents in "${spaceName}", here's what I found: This is a mock response that would normally come from your RAG system analyzing the documents in this space.`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sources: ['Project Requirements.pdf', 'Meeting Notes Q1.docx']
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1500)
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
      minute: '2-digit' 
    })
  }

  return (
    <div className={cn("flex flex-col h-full bg-background border-l", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-muted/20">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Space Assistant</h3>
          <p className="text-xs text-muted-foreground">Ask about documents in {spaceName}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full p-4">
          <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 max-w-full",
                message.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {message.role === 'assistant' && (
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="w-4 h-4 text-primary" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={cn(
                  "rounded-lg px-3 py-2 max-w-[80%]",
                  message.role === 'user' 
                    ? "bg-primary text-primary-foreground ml-auto" 
                    : "bg-muted"
                )}
              >
                <p className="text-sm">{message.content}</p>
                
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                    <div className="flex flex-wrap gap-1">
                      {message.sources.map((source, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="text-xs px-2 py-0.5 h-auto"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <p className="text-xs opacity-70 mt-1">
                  {formatTime(message.timestamp)}
                </p>
              </div>

              {message.role === 'user' && (
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="bg-primary/10">
                  <Bot className="w-4 h-4 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                </div>
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