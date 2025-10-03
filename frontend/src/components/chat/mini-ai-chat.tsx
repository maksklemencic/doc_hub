'use client'

import { useState } from 'react'
import { Sparkles, Send, FileText, MessageSquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MiniAIChatProps {
  contextText: string
  onSend: (message: string) => void
  onOpenChat: () => void
  isMinimized?: boolean
  onExpand?: () => void
}

export function MiniAIChat({
  contextText,
  onSend,
  onOpenChat,
  isMinimized = false,
  onExpand,
}: MiniAIChatProps) {
  const [message, setMessage] = useState('')
  const [isHovered, setIsHovered] = useState(false)
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false)

  const handleSend = () => {
    if (message.trim()) {
      onSend(message)
      setMessage('')
      setIsManuallyExpanded(false)
    }
  }

  const handleOpenChat = () => {
    onOpenChat()
    setIsManuallyExpanded(false)
  }

  const handleExpand = () => {
    if (onExpand) {
      onExpand()
    } else {
      setIsManuallyExpanded(true)
    }
  }

  const showExpanded = isHovered || !isMinimized || isManuallyExpanded

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 bg-card border border-border rounded-lg shadow-xl transition-all duration-200 cursor-pointer',
        showExpanded ? 'w-96' : 'w-12 h-12'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => !isManuallyExpanded && setIsHovered(false)}
      onClick={() => !showExpanded && handleExpand()}
    >
      {showExpanded ? (
        <div className="p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
          {/* Context */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-xs text-muted-foreground">Context:</span>
              <span className="text-xs font-medium text-foreground truncate">{contextText}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 flex-shrink-0"
              onClick={handleOpenChat}
              title="Open chat"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Input */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Ask about your documents..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="flex-1 text-sm"
            />
            <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleSend}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
        </div>
      )}
    </div>
  )
}
